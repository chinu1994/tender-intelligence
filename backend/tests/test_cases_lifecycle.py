"""Tender case CRUD and lifecycle: new -> analysis -> review_required ->
proposal_draft -> approved -> completed."""
import pytest

from tests import factories as f


def create_case(client, headers, **extra):
    response = client.post("/tender-cases", headers=headers, json={"name": "Data centre services", **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_case_generates_sequential_reference(client, org):
    first = create_case(client, org.editor)
    second = create_case(client, org.editor)
    custom = create_case(client, org.editor, reference="RFP-77", submission_deadline="2026-12-01", description="desc")
    assert first["reference"].endswith("-0001")
    assert second["reference"].endswith("-0002")
    assert custom["reference"] == "RFP-77"
    assert custom["submission_deadline"] == "2026-12-01"
    assert first["status"] == "new"
    assert first["owner"] == org.emails["editor"]


def test_case_validation(client, org):
    assert client.post("/tender-cases", headers=org.editor, json={"name": ""}).status_code == 422
    assert client.post("/tender-cases", headers=org.editor, json={}).status_code == 422
    assert client.get("/tender-cases/not-a-uuid", headers=org.editor).status_code == 422


def test_update_case_details(client, org):
    case = create_case(client, org.editor)
    response = client.patch(f"/tender-cases/{case['id']}", headers=org.editor,
                            json={"name": "  Renamed  ", "submission_deadline": "2027-01-15"})
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
    assert response.json()["submission_deadline"] == "2027-01-15"


def test_upload_moves_case_into_analysis_then_review(client, org):
    case = create_case(client, org.editor)
    transitions = client.get(f"/tender-cases/{case['id']}/transitions", headers=org.editor).json()
    assert transitions == {"status": "new", "allowed": ["analysis"]}

    client.post(f"/tender-cases/{case['id']}/documents", headers=org.editor,
                files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)])
    # eager processing completes immediately and extraction runs automatically
    assert client.get(f"/tender-cases/{case['id']}", headers=org.editor).json()["status"] == "review_required"


@pytest.mark.parametrize(
    "path,expected",
    [
        (["analysis", "review_required", "proposal_draft"], 200),
        (["analysis", "new"], 200),
        (["review_required"], 409),           # cannot skip analysis
        (["proposal_draft"], 409),
        (["completed"], 409),                 # completed only after approval
        (["approved"], 400),                  # approval only via the approval gate
    ],
)
def test_manual_transitions(client, org, path, expected):
    case = create_case(client, org.editor)
    status_code = None
    for target in path:
        response = client.patch(f"/tender-cases/{case['id']}", headers=org.editor, json={"status": target})
        status_code = response.status_code
        if status_code != 200:
            break
    assert status_code == expected


def test_full_lifecycle_through_approval_and_completion(client, org):
    case = create_case(client, org.editor)
    cid = case["id"]
    client.post(f"/tender-cases/{cid}/documents", headers=org.editor,
                files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)])
    for item in client.get(f"/tender-cases/{cid}/requirements", headers=org.reviewer).json():
        client.patch(f"/requirements/{item['id']}", headers=org.reviewer, json={"review_status": "verified"})
    workspace = client.get(f"/tender-cases/{cid}/proposal", headers=org.editor).json()
    for section in workspace["sections"]:
        r = client.patch(f"/proposal/sections/{section['id']}", headers=org.editor,
                         json={"content": f"Our {section['title']}.", "status": "complete"})
        assert r.status_code == 200
    assert client.get(f"/tender-cases/{cid}", headers=org.editor).json()["status"] == "proposal_draft"

    approved = client.post(f"/tender-cases/{cid}/proposal/approve", headers=org.reviewer)
    assert approved.status_code == 200 and approved.json()["status"] == "approved"

    # read-only once approved
    assert client.patch(f"/tender-cases/{cid}", headers=org.editor, json={"name": "x"}).status_code == 409
    assert client.post(f"/tender-cases/{cid}/documents", headers=org.editor,
                       files=[f.upload("late.pdf", f.simple_rfp_pdf(), f.PDF_MIME)]).status_code == 409

    # editors may not re-open; reviewers may
    assert client.patch(f"/tender-cases/{cid}", headers=org.editor, json={"status": "proposal_draft"}).status_code == 403
    assert client.get(f"/tender-cases/{cid}/transitions", headers=org.reviewer).json()["allowed"] == ["proposal_draft"]
    assert client.get(f"/tender-cases/{cid}/transitions", headers=org.editor).json()["allowed"] == ["completed"]

    completed = client.patch(f"/tender-cases/{cid}", headers=org.editor, json={"status": "completed"})
    assert completed.status_code == 200 and completed.json()["status"] == "completed"
    assert client.get(f"/tender-cases/{cid}/transitions", headers=org.admin).json()["allowed"] == []


def test_reviewer_can_reopen_approved_proposal(client, org, monkeypatch):
    case = create_case(client, org.editor)
    from app.db.session import SessionLocal
    from app.models import TenderCase, TenderCaseStatus

    with SessionLocal() as session:
        session.get(TenderCase, case["id"]).status = TenderCaseStatus.APPROVED
        session.commit()
    reopened = client.patch(f"/tender-cases/{case['id']}", headers=org.reviewer, json={"status": "proposal_draft"})
    assert reopened.status_code == 200 and reopened.json()["status"] == "proposal_draft"
    # reviewers cannot otherwise edit cases
    assert client.patch(f"/tender-cases/{case['id']}", headers=org.reviewer, json={"name": "x"}).status_code == 403


def test_delete_case_removes_everything(client, org, db_session):
    import sqlalchemy as sa

    case = create_case(client, org.editor)
    client.post(f"/tender-cases/{case['id']}/documents", headers=org.editor,
                files=[f.upload("pack.zip", f.zip_bytes({"a.pdf": f.simple_rfp_pdf(),
                                                          "b.docx": f.docx_bytes(["Bidders must sign Form 3."])}), f.ZIP_MIME)])
    client.get(f"/tender-cases/{case['id']}/proposal", headers=org.editor)
    assert client.delete(f"/tender-cases/{case['id']}", headers=org.admin).status_code == 204
    assert client.get(f"/tender-cases/{case['id']}", headers=org.admin).status_code == 404
    for table in ("documents", "document_chunks", "extracted_requirements", "proposal_sections"):
        assert db_session.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar() == 0, table
