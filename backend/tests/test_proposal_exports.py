"""Proposal workspace, approval gate and DOCX/XLSX exports."""
import io

import docx
import openpyxl
import pytest

from tests import factories as f


@pytest.fixture()
def case(client, org):
    case_id = client.post("/tender-cases", headers=org.editor, json={
        "name": "Network RFP", "reference": "RFP-2026-17", "submission_deadline": "2026-11-14",
    }).json()["id"]
    client.post(f"/tender-cases/{case_id}/documents", headers=org.editor, files=[
        f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME),
        f.upload("Price Schedule.xlsx", f.xlsx_bytes({"Positions": [
            ["Pos", "Description", "Unit", "Qty"],
            ["1.1", "Core switch 48 port", "pcs", 4],
            ["1.2", "Installation", "days", 10],
        ]}), f.XLSX_MIME),
    ])
    return case_id


def workspace(client, org, case_id):
    response = client.get(f"/tender-cases/{case_id}/proposal", headers=org.editor)
    assert response.status_code == 200
    return response.json()


def complete_everything(client, org, case_id):
    ws = workspace(client, org, case_id)
    for item in ws["requirements"]:
        client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"review_status": "verified"})
    for section in ws["sections"]:
        client.patch(f"/proposal/sections/{section['id']}", headers=org.editor,
                     json={"content": f"## Overview\nOur **{section['title']}** response.\n- Point one\n- Point two",
                           "status": "complete"})
    for issue in ws["issues"]:
        client.patch(f"/proposal/issues/{issue['id']}", headers=org.editor, json={"resolved": True})


def test_workspace_defaults_and_requirements(client, org, case):
    ws = workspace(client, org, case)
    assert [s["title"] for s in ws["sections"]][:2] == ["Executive Summary", "Understanding of Requirements"]
    assert len(ws["sections"]) == 6
    assert ws["case_reference"] == "RFP-2026-17" and ws["submission_deadline"] == "2026-11-14"
    assert ws["requirements"], "extracted requirements are part of the workspace"
    assert ws["approval"]["ready"] is False
    assert any("pending" in b for b in ws["approval"]["blockers"])
    # idempotent
    assert len(workspace(client, org, case)["sections"]) == 6


def test_section_editing_and_validation(client, org, case):
    section = workspace(client, org, case)["sections"][0]
    bad = client.patch(f"/proposal/sections/{section['id']}", headers=org.editor, json={"status": "complete"})
    assert bad.status_code == 400  # empty section cannot be complete
    ok = client.patch(f"/proposal/sections/{section['id']}", headers=org.editor,
                      json={"content": "Summary text", "title": "Summary"})
    assert ok.status_code == 200 and ok.json()["title"] == "Summary"
    assert client.get(f"/tender-cases/{case}", headers=org.editor).json()["status"] == "proposal_draft"

    extra = client.post(f"/tender-cases/{case}/proposal/sections", headers=org.editor,
                        json={"title": "Pricing Notes", "sort_order": 99})
    assert extra.status_code == 201
    assert client.delete(f"/proposal/sections/{extra.json()['id']}", headers=org.editor).status_code == 204
    assert len(workspace(client, org, case)["sections"]) == 6


def test_draft_generation_uses_requirements_and_historical_snippets(client, org, case):
    client.post("/knowledge-base/documents", headers=org.editor, data={"source_type": "successful_bid", "outcome": "won"},
                files=[f.upload("past.docx", f.docx_bytes(["We hold ISO 27001 certification and attach a copy of the certificate."]), f.DOCX_MIME)])
    section = workspace(client, org, case)["sections"][5]
    response = client.post(f"/proposal/sections/{section['id']}/draft", headers=org.editor, json={})
    assert response.status_code == 200, response.text
    content = response.json()["content"]
    assert response.json()["status"] == "draft"
    assert "ISO 27001 certificate" in content          # requirement addressed
    assert "[rfp.pdf, p. 1" in content                 # with its citation
    assert "Source: past.docx, paragraph 1" in content  # matched precedent, cited
    assert "Draft generated for review" in content


def test_issue_checklist_generation_and_crud(client, org, case):
    generated = client.post(f"/tender-cases/{case}/proposal/issues/generate", headers=org.editor)
    assert generated.status_code == 200
    titles = [i["title"] for i in generated.json()["issues"]]
    assert any(t.startswith("Provide evidence:") and "ISO 27001" in t for t in titles)
    assert "Confirm deadline: 14 November 2026 at 12:00 CET" in titles
    assert "Complete review of extracted requirements" in titles
    # no duplicates on second run
    assert client.post(f"/tender-cases/{case}/proposal/issues/generate", headers=org.editor).json()["created"] == 0

    issue = client.post(f"/tender-cases/{case}/proposal/issues", headers=org.editor,
                        json={"title": "Confirm subcontractor", "severity": "high"}).json()
    assert client.patch(f"/proposal/issues/{issue['id']}", headers=org.editor, json={"resolved": True}).json()["resolved"]
    assert client.post(f"/tender-cases/{case}/proposal/issues", headers=org.editor,
                       json={"title": "x", "severity": "urgent"}).status_code == 422
    assert client.delete(f"/proposal/issues/{issue['id']}", headers=org.editor).status_code == 204


def test_approval_gate(client, org, case):
    approve = lambda: client.post(f"/tender-cases/{case}/proposal/approve", headers=org.reviewer)
    ws = workspace(client, org, case)
    client.post(f"/tender-cases/{case}/proposal/issues", headers=org.editor, json={"title": "Open point"})

    first = approve()
    assert first.status_code == 400
    for fragment in ("Complete every proposal section", "Resolve all open issues", "Review all extracted requirements"):
        assert fragment in first.json()["detail"]

    complete_everything(client, org, case)
    ready = workspace(client, org, case)["approval"]
    assert ready == {"ready": True, "blockers": []}

    assert client.post(f"/tender-cases/{case}/proposal/approve", headers=org.editor).status_code == 403
    assert approve().status_code == 200
    assert approve().status_code == 400  # already approved

    # everything is read-only after approval
    section = ws["sections"][0]
    assert client.patch(f"/proposal/sections/{section['id']}", headers=org.editor, json={"content": "x"}).status_code == 409
    assert client.post(f"/tender-cases/{case}/proposal/issues", headers=org.editor, json={"title": "late"}).status_code == 409
    req = ws["requirements"][0]
    assert client.patch(f"/requirements/{req['id']}", headers=org.reviewer, json={"review_note": "x"}).status_code == 409
    assert client.post(f"/tender-cases/{case}/extract-requirements", headers=org.editor).status_code == 409


def test_docx_export(client, org, case):
    complete_everything(client, org, case)
    client.post(f"/tender-cases/{case}/proposal/issues", headers=org.editor,
                json={"title": "Confirm bank guarantee", "severity": "high"})
    response = client.get(f"/tender-cases/{case}/proposal/export.docx", headers=org.reviewer)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.wordprocessingml")
    assert 'filename="RFP-2026-17-proposal.docx"' in response.headers["content-disposition"]

    document = docx.Document(io.BytesIO(response.content))
    text = "\n".join(p.text for p in document.paragraphs)
    headings = [p.text for p in document.paragraphs if p.style.name.startswith("Heading")]
    assert "Network RFP" in text and "Proposal / Bid Response" in text
    assert "1. Executive Summary" in headings and "6. Compliance and Evidence" in headings
    assert "Appendix A - Requirement Compliance Matrix" in headings
    assert "Appendix B - Open Issues" in headings and "Confirm bank guarantee" in text
    bullets = [p.text for p in document.paragraphs if p.style.name == "List Bullet"]
    assert "Point one" in bullets
    assert any(run.bold and "Executive Summary" in run.text for p in document.paragraphs for run in p.runs)

    cover = document.tables[0]
    cover_values = {row.cells[0].text: row.cells[1].text for row in cover.rows}
    assert cover_values["Tender reference"] == "RFP-2026-17"
    assert cover_values["Submission deadline"] == "2026-11-14"
    assert cover_values["Submitted by"] == org.name
    matrix = document.tables[1]
    assert [c.text for c in matrix.rows[0].cells] == ["#", "Requirement", "Category", "Mandatory", "Review status", "Source"]
    assert len(matrix.rows) - 1 == len(workspace(client, org, case)["requirements"])
    assert "DRAFT" in document.sections[0].header.paragraphs[0].text


def test_xlsx_export(client, org, case):
    response = client.get(f"/tender-cases/{case}/proposal/export.xlsx", headers=org.editor)
    assert response.status_code == 200
    assert 'filename="RFP-2026-17-compliance.xlsx"' in response.headers["content-disposition"]
    workbook = openpyxl.load_workbook(io.BytesIO(response.content))
    assert workbook.sheetnames == ["Summary", "Compliance Matrix", "Lots", "Positions", "Deadlines", "Evidence", "Open Issues"]

    matrix = workbook["Compliance Matrix"]
    header = [c.value for c in matrix[1]]
    assert header[:4] == ["ID", "Requirement", "Category", "Mandatory"]
    assert "Compliance (Yes/No/Partial)" in header
    rows = list(matrix.iter_rows(min_row=2, values_only=True))
    requirements = client.get(f"/tender-cases/{case}/requirements", headers=org.editor).json()
    assert len(rows) == len(requirements)
    assert rows[0][0] == "REQ-001"
    assert all(r[header.index("Source document")] for r in rows)
    assert matrix.data_validations.dataValidation, "compliance column has a Yes/No/Partial dropdown"

    lots = list(workbook["Lots"].iter_rows(min_row=2, values_only=True))
    assert lots[0][0] == "Lot 1" and lots[0][1] == 1

    positions = list(workbook["Positions"].iter_rows(min_row=2, values_only=True))
    assert positions[1][:7] == (2, "Price Schedule.xlsx", "Positions", 2, "1.1", "Core switch 48 port", "pcs")
    assert positions[1][7] == "4"

    deadlines = list(workbook["Deadlines"].iter_rows(min_row=2, values_only=True))
    assert deadlines[0][0] == "14 November 2026 at 12:00 CET"
    evidence = list(workbook["Evidence"].iter_rows(min_row=2, values_only=True))
    assert any("ISO 27001" in row[0] for row in evidence)

    summary = {row[0]: row[1] for row in workbook["Summary"].iter_rows(min_row=3, values_only=True)}
    assert summary["Tender reference"] == "RFP-2026-17"
    assert summary["Requirements (excl. rejected)"] == len(requirements)
    assert summary["Tender positions"] == 3


def test_docx_export_requires_sections(client, org):
    case_id = client.post("/tender-cases", headers=org.editor, json={"name": "Blank"}).json()["id"]
    assert client.get(f"/tender-cases/{case_id}/proposal/export.docx", headers=org.editor).status_code == 404
    # xlsx export works even before any extraction
    assert client.get(f"/tender-cases/{case_id}/proposal/export.xlsx", headers=org.editor).status_code == 200
