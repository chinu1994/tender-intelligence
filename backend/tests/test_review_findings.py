"""Regression tests for issues found in the independent code review."""
import io
import uuid
from datetime import datetime, timedelta, timezone

import docx
import openpyxl
import pytest
import sqlalchemy as sa

from app.core.config import settings
from app.db.session import SessionLocal, reset_rls_cache
from app.models import Document, DocumentStatus, TenderCase, TenderCaseStatus
from app.services.exporters import ExportBundle, ExportRequirement, ExportSection, build_compliance_xlsx, build_proposal_docx
from app.services.extraction import CaseReadOnly, run_case_extraction
from tests import factories as f


@pytest.fixture()
def case(client, org):
    case_id = client.post("/tender-cases", headers=org.editor, json={"name": "Findings"}).json()["id"]
    client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)])
    return case_id


# 1 ---------------------------------------------------------------------------
def test_reextraction_preserves_manual_and_edited_pending_items(client, org, case):
    manual = client.post(f"/tender-cases/{case}/requirements", headers=org.editor,
                         json={"requirement": "Provide two customer references."}).json()
    assert manual["review_status"] == "pending"
    edited = client.get(f"/tender-cases/{case}/requirements?category=evidence", headers=org.reviewer).json()[0]
    client.patch(f"/requirements/{edited['id']}", headers=org.reviewer,
                 json={"review_note": "Check validity date"})          # still pending
    untouched = {r["id"] for r in client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()} - {manual["id"], edited["id"]}

    # a new document triggers automatic re-extraction
    client.post(f"/tender-cases/{case}/documents", headers=org.editor,
                files=[f.upload("annex.docx", f.docx_bytes(["Bidders must provide a bank guarantee."]), f.DOCX_MIME)])
    after = {r["id"]: r for r in client.get(f"/tender-cases/{case}/requirements", headers=org.reviewer).json()}
    assert manual["id"] in after and after[manual["id"]]["requirement"] == "Provide two customer references."
    assert edited["id"] in after and after[edited["id"]]["review_note"] == "Check validity date"
    assert not untouched & set(after)  # untouched machine output was replaced...
    texts = [r["original_requirement"] for r in after.values()]
    assert len(texts) == len(set(texts))  # ...without duplicating preserved items
    assert any("bank guarantee" in t for t in texts)


# 2 ---------------------------------------------------------------------------
def test_approval_blocked_while_documents_in_flight_or_failed(client, org, case, db_session):
    doc = client.get(f"/tender-cases/{case}/documents", headers=org.editor).json()[0]
    db_session.execute(sa.text("UPDATE documents SET status = 'processing' WHERE id = :i"), {"i": doc["id"]})
    db_session.commit()
    blockers = client.get(f"/tender-cases/{case}/proposal", headers=org.editor).json()["approval"]["blockers"]
    assert any("still in progress" in b for b in blockers)

    db_session.execute(sa.text("UPDATE documents SET status = 'failed' WHERE id = :i"), {"i": doc["id"]})
    db_session.commit()
    blockers = client.get(f"/tender-cases/{case}/proposal", headers=org.editor).json()["approval"]["blockers"]
    assert any("failed processing" in b for b in blockers)


def test_extraction_refuses_case_approved_meanwhile(client, org, case):
    with SessionLocal() as session:
        tender = session.get(TenderCase, uuid.UUID(case))
        session.execute(sa.text("UPDATE tender_cases SET status = 'approved' WHERE id = :i"), {"i": case})
        session.commit()
        # the in-memory object still says review_required (stale), the locked re-read must win
        tender.status = TenderCaseStatus.REVIEW_REQUIRED
        with pytest.raises(CaseReadOnly):
            run_case_extraction(session, tender)
        session.rollback()


# 3 ---------------------------------------------------------------------------
def test_duplicate_task_delivery_is_ignored(client, org, case):
    from app.tasks.document_processing import process_document

    doc_id = client.get(f"/tender-cases/{case}/documents", headers=org.editor).json()[0]["id"]
    with SessionLocal() as session:
        before = session.execute(sa.text("SELECT count(*) FROM document_chunks WHERE document_id = :i"), {"i": doc_id}).scalar()
    # A second delivery of an already processed document must not run again.
    assert process_document(doc_id)["status"] == "skipped"
    with SessionLocal() as session:
        assert session.execute(sa.text("SELECT count(*) FROM document_chunks WHERE document_id = :i"), {"i": doc_id}).scalar() == before


def test_reprocess_rules_for_queued_and_stuck_documents(client, org, case, db_session):
    doc = client.get(f"/tender-cases/{case}/documents", headers=org.editor).json()[0]
    url = f"/tender-cases/{case}/documents/{doc['id']}/reprocess"
    db_session.execute(sa.text("UPDATE documents SET status = 'pending', updated_at = now() WHERE id = :i"), {"i": doc["id"]})
    db_session.commit()
    assert client.post(url, headers=org.editor).status_code == 409  # already queued

    stale = datetime.now(timezone.utc) - timedelta(hours=2)
    db_session.execute(sa.text("UPDATE documents SET status = 'processing', updated_at = :t WHERE id = :i"),
                       {"i": doc["id"], "t": stale})
    db_session.commit()
    retried = client.post(url, headers=org.editor)  # stuck -> allowed
    assert retried.status_code == 200 and retried.json()["status"] == "completed"


def test_zip_is_not_unpacked_twice(client, org):
    from app.tasks.document_processing import process_document

    case_id = client.post("/tender-cases", headers=org.editor, json={"name": "Zip twice"}).json()["id"]
    parent = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                         files=[f.upload("p.zip", f.zip_bytes({"a.pdf": f.simple_rfp_pdf()}), f.ZIP_MIME)]).json()[0]
    assert process_document(parent["id"])["status"] == "skipped"
    assert len(client.get(f"/tender-cases/{case_id}/documents", headers=org.editor).json()) == 2


# 4 ---------------------------------------------------------------------------
def _bundle():
    nasty = "Lot\x01 1 \x0b= requirement"
    return ExportBundle(
        case_name="Case\x02", reference="=HYPERLINK(\"http://evil\")", submission_deadline=None,
        status="proposal_draft", organization="Org",
        sections=[ExportSection("Intro\x03", "=== Heading ===\nText with \x07 bell", "draft")],
        requirements=[ExportRequirement(id="1", requirement="=1+1", category="mandatory", mandatory=True,
                                        confidence=0.9, review_status="pending", lot_bundle=nasty,
                                        required_evidence=["@SUM(A1)", "-cmd"], source_document="x\x08.pdf")],
        issues=[],
    )


def test_exports_survive_control_characters_and_never_create_formulas():
    document = docx.Document(io.BytesIO(build_proposal_docx(_bundle())))
    text = "\n".join(p.text for p in document.paragraphs)
    assert "Text with  bell" in text and "\x07" not in text

    workbook = openpyxl.load_workbook(io.BytesIO(build_compliance_xlsx(_bundle())))
    matrix = workbook["Compliance Matrix"]
    for row in matrix.iter_rows():
        for cell in row:
            assert cell.data_type != "f", cell.coordinate
    assert matrix["B2"].value == "=1+1"  # preserved as literal text
    summary = {r[0]: r[1] for r in workbook["Summary"].iter_rows(min_row=3, values_only=True)}
    assert summary["Tender reference"].startswith("=HYPERLINK")
    assert workbook["Summary"]["B4"].data_type == "s"


def test_parsed_text_has_no_control_characters():
    from app.processing.chunking import chunk_paragraphs
    from app.processing.parsers import ParsedParagraph

    chunks = chunk_paragraphs([ParsedParagraph("Bidders must sign\x01 Form 2\x0b", 1, 1)])
    assert chunks[0].text == "Bidders must sign Form 2"


# 6 ---------------------------------------------------------------------------
def test_production_refuses_to_start_without_rls(monkeypatch):
    from app import main

    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "validate", lambda: None)  # isolate the RLS check
    monkeypatch.setattr(main, "rls_available", lambda: False)
    import asyncio

    async def start():
        async with main.lifespan(main.app):
            pass

    with pytest.raises(RuntimeError, match="Row-level security"):
        asyncio.run(start())
    reset_rls_cache()


# minor ------------------------------------------------------------------------
def test_failed_zip_extraction_leaves_no_partial_files(tmp_path):
    from app.processing.parsers import DocumentParseError, unpack_zip

    archive = tmp_path / "a.zip"
    archive.write_bytes(f.zip_bytes({"a.pdf": b"x" * 10, "b.pdf": b"y" * 5000}))
    out = tmp_path / "out"
    with pytest.raises(DocumentParseError):
        unpack_zip(archive, out, max_member_bytes=1000)
    assert not out.exists() or list(out.iterdir()) == []


def test_very_long_member_names_are_shortened(tmp_path):
    from app.processing.parsers import original_name, unpack_zip

    archive = tmp_path / "a.zip"
    archive.write_bytes(f.zip_bytes({("x" * 300) + ".pdf": b"data"}))
    [path] = unpack_zip(archive, tmp_path / "out")
    assert path.suffix == ".pdf" and len(original_name(path)) <= 200
