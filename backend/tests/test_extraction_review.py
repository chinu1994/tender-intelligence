"""Structured extraction schemas, review & correction workflow."""
import pytest

from tests import factories as f

RFP_PAGES = [
    [
        "Invitation to Tender: Regional Network Modernisation",
        "",
        "Tenders must be received no later than 14 November 2026, 12:00 CET.",
        "",
        "Clarification questions are due by 31 October 2026.",
    ],
    [
        "Lot 1 comprises supply of core switches.",
        "",
        "Lot 2 comprises five years of managed support.",
        "",
        "Award criteria: price 40% and technical quality 60%.",
    ],
    [
        "Bidders must provide a copy of their ISO 27001 certificate.",
        "",
        "The bidder shall complete the price schedule in Annex B.",
        "",
        "This page intentionally describes the background of the authority.",
    ],
]


@pytest.fixture()
def case(client, org):
    case_id = client.post("/tender-cases", headers=org.editor, json={"name": "Network RFP"}).json()["id"]
    client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                files=[f.upload("ITT.pdf", f.pdf_bytes(RFP_PAGES), f.PDF_MIME)])
    return case_id


def by_text(items, needle):
    return next(item for item in items if needle in item["requirement"])


def test_extraction_classifies_and_cites(client, org, case):
    items = client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()
    assert len(items) == 7  # the background paragraph and title are not requirements

    deadline = by_text(items, "no later than")
    assert deadline["category"] == "deadline"
    assert deadline["deadline_value"] == "14 November 2026, 12:00 CET"
    assert (deadline["source_document"], deadline["source_page"], deadline["source_paragraph"]) == ("ITT.pdf", 1, 2)
    assert deadline["mandatory"] is True
    assert deadline["source_excerpt"] == deadline["original_requirement"]

    lot = by_text(items, "Lot 2")
    assert lot["category"] == "lots" and lot["lot_bundle"] == "Lot 2" and lot["source_page"] == 2

    criteria = by_text(items, "Award criteria")
    assert criteria["category"] == "evaluation"
    assert criteria["evaluation_criteria"]

    evidence = by_text(items, "ISO 27001")
    assert evidence["category"] == "evidence" and evidence["required_evidence"]

    annex = by_text(items, "Annex B")
    assert annex["category"] == "mandatory" and annex["document_reference"] == "Annex B"

    assert all(0 <= i["confidence"] <= 1 and i["review_status"] == "pending" for i in items)
    assert all(i["flags"] == [] for i in items)


def test_structured_extraction_endpoint(client, org, case):
    data = client.get(f"/tender-cases/{case}/extraction", headers=org.reviewer).json()
    assert {d["value"] for d in data["deadlines"]} == {"14 November 2026, 12:00 CET", "31 October 2026"}
    assert {lot["name"] for lot in data["lots"]} == {"Lot 1", "Lot 2"}
    assert data["evaluation_criteria"][0]["weight"] == "40%, 60%"
    assert "ISO 27001" in data["required_evidence"][0]["evidence"]
    assert [r["reference"] for r in data["document_references"]] == ["Annex B"]
    assert any("Annex B" in r["requirement"] for r in data["requirements"])
    for group in data.values():
        for entry in group:
            assert entry["requirement_id"] and entry["source_document"] == "ITT.pdf" and entry["source_page"]


def test_category_filter_and_validation(client, org, case):
    lots = client.get(f"/tender-cases/{case}/requirements?category=lots", headers=org.editor).json()
    assert {i["category"] for i in lots} == {"lots"} and len(lots) == 2
    assert client.get(f"/tender-cases/{case}/requirements?category=nope", headers=org.editor).status_code == 400
    assert client.get(f"/tender-cases/{case}/requirements?review_status=nope", headers=org.editor).status_code == 400


def test_correction_preserves_original_and_attributes_reviewer(client, org, case):
    item = by_text(client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json(), "no later than")
    response = client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={
        "requirement": "Tenders must be submitted via the e-procurement portal by 14 November 2026 12:00 CET.",
        "deadline_value": "2026-11-14 12:00 CET",
        "review_note": "Portal requirement added from section 2.1",
        "review_status": "verified",
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["requirement"].startswith("Tenders must be submitted via the e-procurement portal")
    assert body["original_requirement"] == item["original_requirement"]
    assert body["deadline_value"] == "2026-11-14 12:00 CET"
    assert body["review_status"] == "verified"
    assert body["reviewed_by_email"] == org.emails["reviewer"]
    assert body["reviewed_at"]
    assert "corrected" in body["flags"]

    verified = client.get(f"/tender-cases/{case}/requirements?review_status=verified", headers=org.editor).json()
    assert [v["id"] for v in verified] == [item["id"]]

    # back to pending clears the attribution
    reset = client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"review_status": "pending"}).json()
    assert reset["reviewed_by_id"] is None and reset["reviewed_at"] is None


def test_invalid_corrections_rejected(client, org, case):
    item = client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()[0]
    assert client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"category": "bogus"}).status_code == 400
    assert client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"review_status": "maybe"}).status_code == 422
    assert client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"requirement": ""}).status_code == 422


def test_reextraction_keeps_reviewed_items_without_duplicates(client, org, case):
    items = client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()
    verified, rejected = items[0], items[1]
    client.patch(f"/requirements/{verified['id']}", headers=org.reviewer, json={"review_status": "verified"})
    client.patch(f"/requirements/{rejected['id']}", headers=org.reviewer, json={"review_status": "rejected"})

    rerun = client.post(f"/tender-cases/{case}/extract-requirements", headers=org.editor)
    assert rerun.status_code == 200
    assert rerun.json()["created"] == len(items) - 2

    after = client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()
    assert len(after) == len(items)
    statuses = {i["id"]: i["review_status"] for i in after}
    assert statuses[verified["id"]] == "verified" and statuses[rejected["id"]] == "rejected"

    # rejected items are excluded from the structured view
    structured = client.get(f"/tender-cases/{case}/extraction", headers=org.reviewer).json()
    ids = {e["requirement_id"] for group in structured.values() for e in group}
    assert rejected["id"] not in ids


def test_manual_requirement(client, org, case):
    documents = client.get(f"/tender-cases/{case}/documents", headers=org.editor).json()
    by_reviewer = client.post(f"/tender-cases/{case}/requirements", headers=org.reviewer, json={
        "requirement": "Bidders must attend the site visit on 20 October 2026.",
        "category": "deadline", "deadline_value": "20 October 2026",
        "source_document_id": documents[0]["id"], "source_page": 1,
    })
    assert by_reviewer.status_code == 201
    body = by_reviewer.json()
    assert body["review_status"] == "verified" and body["source_document"] == "ITT.pdf"
    assert body["confidence"] == 1.0

    by_editor = client.post(f"/tender-cases/{case}/requirements", headers=org.editor,
                            json={"requirement": "Provide two customer references."})
    assert by_editor.json()["review_status"] == "pending"
    assert "missing_source" in by_editor.json()["flags"]

    foreign = client.post(f"/tender-cases/{case}/requirements", headers=org.editor,
                          json={"requirement": "x", "source_document_id": "00000000-0000-0000-0000-000000000000"})
    assert foreign.status_code == 400


def test_low_confidence_flag(client, org, case, db_session):
    import sqlalchemy as sa

    item = client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()[0]
    db_session.execute(sa.text("UPDATE extracted_requirements SET confidence = 40 WHERE id = :i"), {"i": item["id"]})
    db_session.commit()
    refreshed = next(i for i in client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()
                     if i["id"] == item["id"])
    assert "low_confidence" in refreshed["flags"]


def test_extraction_requires_processed_documents(client, org):
    case_id = client.post("/tender-cases", headers=org.editor, json={"name": "Empty"}).json()["id"]
    response = client.post(f"/tender-cases/{case_id}/extract-requirements", headers=org.editor)
    assert response.status_code == 400
    assert "No processed documents" in response.json()["detail"]


def test_requirement_matches_from_knowledge_base(client, org, case):
    client.post("/knowledge-base/documents", headers=org.editor, data={"source_type": "successful_bid", "outcome": "won"},
                files=[f.upload("bid.docx", f.docx_bytes([
                    "We attach our ISO 27001 certificate issued by an accredited body.",
                    "Our canteen serves vegetarian food.",
                ]), f.DOCX_MIME)])
    item = by_text(client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json(), "ISO 27001")
    matches = client.get(f"/requirements/{item['id']}/matches?limit=2", headers=org.editor).json()
    assert matches["query"] == item["requirement"]
    assert matches["results"][0]["text"].startswith("We attach our ISO 27001 certificate")
    assert matches["results"][0]["document_name"] == "bid.docx"
    assert matches["results"][0]["paragraph_number"] == 1
    assert matches["results"][0]["score"] > matches["results"][1]["score"]
