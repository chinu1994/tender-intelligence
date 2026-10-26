"""Pilot acceptance case: the reference tender package end to end.

Walks the 14-step pilot workflow from the specification through the public
API exactly as the frontend does:

 1 authentication  2 case creation  3 lifecycle  4 multi-file/ZIP ingestion
 5 archive unpacking  6 processing status  7 historical knowledge base
 8 similarity search with sources  9 structured extraction  10 review &
 correction  11 proposal workspace  12 DOCX export  13 XLSX export
 14 acceptance (approval, completion, isolation)
"""
import io

import docx
import openpyxl

from tests import factories as f
from tests import pilot_package as pilot
from tests.conftest import create_org


def find(items, needle, key="requirement"):
    matches = [item for item in items if needle in item[key]]
    assert matches, f"no item containing {needle!r}"
    return matches[0]


def test_pilot_reference_tender_end_to_end(client):
    # 1. Authentication & roles ------------------------------------------------
    org = create_org(client, "Northwind Networks")
    me = client.get("/auth/me", headers=org.editor).json()
    assert me["role"] == "editor" and me["tenant_id"] == org.tenant_id

    # 7. Historical knowledge base (won and lost bids) -----------------------------
    bids = pilot.historical_bids()
    kb = client.post("/knowledge-base/documents", headers=org.editor,
                     files=[f.upload("Bid_Riverside_2024.docx", bids["Bid_Riverside_2024.docx"], f.DOCX_MIME)],
                     data={"source_type": "successful_bid", "outcome": "won", "notes": "Riverside County"})
    assert kb.status_code == 201
    kb = client.post("/knowledge-base/documents", headers=org.editor,
                     files=[f.upload("Bid_Lakeside_2023.pdf", bids["Bid_Lakeside_2023.pdf"], f.PDF_MIME)],
                     data={"source_type": "unsuccessful_bid", "outcome": "lost"})
    assert kb.status_code == 201
    assert {d["status"] for d in client.get("/knowledge-base/documents", headers=org.editor).json()} == {"completed"}

    # 2. Case creation --------------------------------------------------------------
    case = client.post("/tender-cases", headers=org.editor, json={
        "name": pilot.TITLE, "reference": pilot.REFERENCE, "submission_deadline": "2026-11-14",
        "description": f"Tender issued by {pilot.AUTHORITY}",
    })
    assert case.status_code == 201
    case_id = case.json()["id"]
    assert case.json()["status"] == "new"

    # 4/5. ZIP ingestion and server-side unpacking ---------------------------------
    upload = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                         files=[f.upload("EB-IT-2026-041.zip", pilot.tender_package_zip(), f.ZIP_MIME)])
    assert upload.status_code == 201
    documents = client.get(f"/tender-cases/{case_id}/documents", headers=org.reviewer).json()
    archive = next(d for d in documents if d["file_type"] == "zip")
    children = [d for d in documents if d["parent_document_id"] == archive["id"]]
    assert sorted(d["name"] for d in children) == [
        "01_Invitation_to_Tender.pdf", "02_Price_Schedule.xlsx", "03_Requirements_Matrix.xlsx",
        "04_Response_Template.docx", "05_Evidence_Checklist.pdf",
    ]

    # 6. Processing status --------------------------------------------------------
    assert {d["status"] for d in documents} == {"completed"}
    assert all(d["processing_error"] is None for d in documents)
    summary = client.get(f"/tender-cases/{case_id}", headers=org.editor).json()
    assert (summary["documents_total"], summary["documents_processed"], summary["documents_failed"]) == (5, 5, 0)

    # 3. Lifecycle advanced automatically after processing + extraction ------------
    assert summary["status"] == "review_required"

    # 9. Structured extraction ----------------------------------------------------
    structured = client.get(f"/tender-cases/{case_id}/extraction", headers=org.reviewer).json()
    deadlines = {d["value"]: d for d in structured["deadlines"]}
    assert "14 November 2026, 12:00 CET" in deadlines
    assert "30 October 2026" in deadlines
    assert deadlines["14 November 2026, 12:00 CET"]["source_document"] == "01_Invitation_to_Tender.pdf"
    assert deadlines["14 November 2026, 12:00 CET"]["source_page"] == 1

    assert {"Lot 1", "Lot 2"} <= {lot["name"] for lot in structured["lots"]}
    assert any(c["weight"] == "40%, 45%, 15%" for c in structured["evaluation_criteria"])

    evidence_text = " ".join(e["evidence"] for e in structured["required_evidence"])
    for needle in ("ISO 27001", "public liability insurance", "company registration certificate", "three client references"):
        assert needle in evidence_text, needle
    references = {r["reference"] for r in structured["document_references"]}
    assert {"Annex B", "02_Price_Schedule.xlsx"} <= references

    mandatory = structured["requirements"]
    matrix_req = find(mandatory, "IPv6")
    assert (matrix_req["source_document"], matrix_req["source_paragraph"]) == ("03_Requirements_Matrix.xlsx", 2)
    assert not any("appreciated" in r["requirement"] for r in mandatory)  # optional row is not mandatory
    find(mandatory, "declaration of compliance must be signed")  # from the DOCX table

    # 8. Similarity search with visible source references -----------------------------
    hits = client.post("/knowledge-base/search", headers=org.editor,
                       json={"query": "helpdesk response to priority 1 incidents within 15 minutes"}).json()["results"]
    top = hits[0]
    assert top["document_name"] == "Bid_Riverside_2024.docx" and top["outcome"] == "won"
    assert top["paragraph_number"] == 2 and "15 minutes" in top["text"]

    # 10. Review & correction -----------------------------------------------------
    requirements = client.get(f"/tender-cases/{case_id}/requirements", headers=org.reviewer).json()
    assert all(r["source_document"] and r["review_status"] == "pending" for r in requirements)
    turnover = find(requirements, "annual turnover")
    corrected = client.patch(f"/requirements/{turnover['id']}", headers=org.reviewer, json={
        "requirement": "The bidder must demonstrate an average annual turnover of at least EUR 2 million over the last 3 years.",
        "review_note": "Clarified with procurement (Q&A no. 4).",
        "required_evidence": ["Audited accounts for the last 3 financial years"],
        "review_status": "verified",
    }).json()
    assert corrected["original_requirement"] == turnover["original_requirement"]
    assert corrected["reviewed_by_email"] == org.emails["reviewer"]

    optional_lot = find(requirements, "one or both lots")
    client.patch(f"/requirements/{optional_lot['id']}", headers=org.reviewer,
                 json={"review_status": "rejected", "review_note": "Informational, not a requirement."})
    for item in requirements:
        if item["id"] not in {turnover["id"], optional_lot["id"]}:
            assert client.patch(f"/requirements/{item['id']}", headers=org.reviewer,
                                json={"review_status": "verified"}).status_code == 200
    assert client.get(f"/tender-cases/{case_id}/requirements?review_status=pending", headers=org.reviewer).json() == []

    # 11. Proposal workspace --------------------------------------------------------
    workspace = client.get(f"/tender-cases/{case_id}/proposal", headers=org.editor).json()
    assert len(workspace["requirements"]) == len(requirements) - 1  # rejected item excluded
    iso = find(workspace["requirements"], "ISO 27001")
    matches = client.get(f"/requirements/{iso['id']}/matches", headers=org.editor).json()["results"]
    assert matches[0]["document_name"] == "Bid_Riverside_2024.docx" and "ISO 27001" in matches[0]["text"]

    for section in workspace["sections"]:
        drafted = client.post(f"/proposal/sections/{section['id']}/draft", headers=org.editor, json={"replace": True})
        assert drafted.status_code == 200
        final = drafted.json()["content"].replace("[Draft generated for review - verify and tailor before submission.]", "")
        saved = client.patch(f"/proposal/sections/{section['id']}", headers=org.editor,
                             json={"content": final.strip(), "status": "complete"})
        assert saved.status_code == 200
    technical = client.get(f"/tender-cases/{case_id}/proposal", headers=org.editor).json()["sections"][2]
    assert "Source: Bid_Riverside_2024.docx" in technical["content"]

    generated = client.post(f"/tender-cases/{case_id}/proposal/issues/generate", headers=org.editor).json()
    assert generated["created"] >= 4
    blocked = client.post(f"/tender-cases/{case_id}/proposal/approve", headers=org.reviewer)
    assert blocked.status_code == 400 and "open issues" in blocked.json()["detail"]
    for issue in client.get(f"/tender-cases/{case_id}/proposal", headers=org.editor).json()["issues"]:
        client.patch(f"/proposal/issues/{issue['id']}", headers=org.editor, json={"resolved": True})
    readiness = client.get(f"/tender-cases/{case_id}/proposal", headers=org.editor).json()["approval"]
    assert readiness == {"ready": True, "blockers": []}

    # 14a. Approval by the reviewer -------------------------------------------------
    approval = client.post(f"/tender-cases/{case_id}/proposal/approve", headers=org.reviewer)
    assert approval.status_code == 200 and approval.json()["status"] == "approved"

    # 12. DOCX export ----------------------------------------------------------------
    docx_response = client.get(f"/tender-cases/{case_id}/proposal/export.docx", headers=org.editor)
    assert docx_response.status_code == 200
    proposal = docx.Document(io.BytesIO(docx_response.content))
    headings = [p.text for p in proposal.paragraphs if p.style.name.startswith("Heading")]
    assert headings[1:3] == ["1. Executive Summary", "2. Understanding of Requirements"]
    assert "Appendix A - Requirement Compliance Matrix" in headings
    assert "Appendix B - Open Issues" not in headings
    assert len(proposal.tables[1].rows) - 1 == len(requirements) - 1
    assert "DRAFT" not in proposal.sections[0].header.paragraphs[0].text
    body = "\n".join(p.text for p in proposal.paragraphs)
    assert "average annual turnover" in body  # reviewer correction flows into the proposal

    # 13. XLSX export -----------------------------------------------------------------
    xlsx_response = client.get(f"/tender-cases/{case_id}/proposal/export.xlsx", headers=org.editor)
    workbook = openpyxl.load_workbook(io.BytesIO(xlsx_response.content))
    matrix_rows = list(workbook["Compliance Matrix"].iter_rows(min_row=2, values_only=True))
    assert len(matrix_rows) == len(requirements) - 1
    assert all(row[10] == "verified" for row in matrix_rows)
    positions = list(workbook["Positions"].iter_rows(min_row=2, values_only=True))
    assert {row[1] for row in positions} == {"02_Price_Schedule.xlsx"}  # BoQ preferred over other sheets
    assert ("2.1", "24x7 helpdesk service", "months", "60", "Lot 2") in {tuple(row[4:9]) for row in positions}
    lots = {row[0] for row in workbook["Lots"].iter_rows(min_row=2, values_only=True)}
    assert {"Lot 1", "Lot 2"} <= lots
    deadlines = {row[0] for row in workbook["Deadlines"].iter_rows(min_row=2, values_only=True)}
    assert "14 November 2026, 12:00 CET" in deadlines
    evidence = [row[0] for row in workbook["Evidence"].iter_rows(min_row=2, values_only=True)]
    assert "Audited accounts for the last 3 financial years" in evidence

    # 14b. Completion and dashboard ---------------------------------------------------
    done = client.patch(f"/tender-cases/{case_id}", headers=org.editor, json={"status": "completed"})
    assert done.status_code == 200 and done.json()["status"] == "completed"
    stats = client.get("/dashboard/summary", headers=org.admin).json()["stats"]
    assert stats["opportunities"] == 1 and stats["pending_reviews"] == 0 and stats["open_proposal_issues"] == 0
    assert stats["historical_documents"] == 2

    # 14c. Another organisation sees none of it ---------------------------------------
    rival = create_org(client, "Rival Bidders")
    assert client.get("/tender-cases", headers=rival.admin).json() == []
    assert client.get(f"/tender-cases/{case_id}", headers=rival.admin).status_code == 404
    assert client.post("/knowledge-base/search", headers=rival.admin,
                       json={"query": "ISO 27001 helpdesk"}).json()["results"] == []
