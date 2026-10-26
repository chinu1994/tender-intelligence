"""Document ingestion: multi-file upload, ZIP unpacking, status, errors."""
from pathlib import Path

import sqlalchemy as sa

from app.core.config import settings
from tests import factories as f


def new_case(client, org):
    return client.post("/tender-cases", headers=org.editor, json={"name": "Ingestion case"}).json()["id"]


def docs(client, org, case_id):
    return {d["name"]: d for d in client.get(f"/tender-cases/{case_id}/documents", headers=org.editor).json()}


def test_multi_file_upload_processes_all_types(client, org, db_session):
    case_id = new_case(client, org)
    response = client.post(
        f"/tender-cases/{case_id}/documents",
        headers=org.editor,
        files=[
            f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME),
            f.upload("terms.docx", f.docx_bytes(["The contractor shall maintain public liability insurance."],
                                                [["Item", "Requirement"], ["1", "Bidders must provide 3 references."]]), f.DOCX_MIME),
            f.upload("prices.xlsx", f.xlsx_bytes({"Positions": [["Pos", "Item", "Qty"], [1, "Firewall", 2]]}), f.XLSX_MIME),
        ],
    )
    assert response.status_code == 201, response.text
    assert {d["status"] for d in response.json()} == {"completed"}

    listing = docs(client, org, case_id)
    assert set(listing) == {"rfp.pdf", "terms.docx", "prices.xlsx"}
    case = client.get(f"/tender-cases/{case_id}", headers=org.editor).json()
    assert (case["documents_total"], case["documents_processed"], case["documents_failed"]) == (3, 3, 0)

    chunks = db_session.execute(sa.text(
        "SELECT d.name, c.page_number, c.paragraph_number, c.text, vector_dims(c.embedding) AS dims "
        "FROM document_chunks c JOIN documents d ON d.id = c.document_id ORDER BY d.name, c.chunk_index"
    )).mappings().all()
    assert all(row["dims"] == 384 for row in chunks)
    pdf_rows = [r for r in chunks if r["name"] == "rfp.pdf"]
    assert {r["page_number"] for r in pdf_rows} == {1, 2}
    docx_texts = [r["text"] for r in chunks if r["name"] == "terms.docx"]
    assert any("3 references" in t for t in docx_texts), "DOCX tables are extracted"
    xlsx_rows = [r for r in chunks if r["name"] == "prices.xlsx"]
    assert [r["paragraph_number"] for r in xlsx_rows] == [1, 2]
    assert xlsx_rows[1]["text"] == "Positions: 1 | Firewall | 2"


def test_zip_is_unpacked_asynchronously_into_child_documents(client, org):
    case_id = new_case(client, org)
    archive = f.zip_bytes({
        "tender/Main RFP.pdf": f.simple_rfp_pdf(),
        "tender/annex/Annex A.docx": f.docx_bytes(["Annex A: bidders must sign the declaration."]),
        "tender/prices.xlsx": f.xlsx_bytes({"Prices": [["Item", "Price"], ["Switch", 100]]}),
        "readme.txt": b"ignored",
        "__MACOSX/._junk.pdf": b"junk",
    })
    response = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                           files=[f.upload("package.zip", archive, f.ZIP_MIME)])
    assert response.status_code == 201
    created = response.json()
    assert len(created) == 1 and created[0]["file_type"] == "zip"

    listing = docs(client, org, case_id)
    parent = listing.pop("package.zip")
    assert parent["status"] == "completed"
    assert set(listing) == {"Main RFP.pdf", "Annex A.docx", "prices.xlsx"}
    assert all(d["parent_document_id"] == parent["id"] for d in listing.values())
    assert all(d["tender_case_id"] == case_id for d in listing.values())
    assert all(d["status"] == "completed" for d in listing.values())

    case = client.get(f"/tender-cases/{case_id}", headers=org.editor).json()
    assert case["documents_total"] == 3  # the archive container is not counted


def test_unsupported_and_empty_uploads_rejected(client, org):
    case_id = new_case(client, org)
    bad = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                      files=[f.upload("notes.txt", b"hello", "text/plain")])
    assert bad.status_code == 400
    assert "Unsupported file type" in bad.json()["detail"]

    empty = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                        files=[f.upload("empty.pdf", b"", f.PDF_MIME)])
    assert empty.status_code == 400
    assert "empty" in empty.json()["detail"]
    assert docs(client, org, case_id) == {}


def test_upload_size_limit(client, org, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)
    case_id = new_case(client, org)
    response = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                           files=[f.upload("big.pdf", b"%PDF" + b"0" * (1024 * 1024 + 10), f.PDF_MIME)])
    assert response.status_code == 400
    assert "1 MB" in response.json()["detail"]


def test_failed_documents_have_readable_errors_and_can_be_retried(client, org):
    case_id = new_case(client, org)
    response = client.post(
        f"/tender-cases/{case_id}/documents",
        headers=org.editor,
        files=[
            f.upload("broken.pdf", b"%PDF-1.4 this is not really a pdf", f.PDF_MIME),
            f.upload("broken.docx", b"PK\x03\x04 nope", f.DOCX_MIME),
            f.upload("broken.zip", b"not a zip", f.ZIP_MIME),
            f.upload("scan.pdf", f.pdf_bytes([[]]), f.PDF_MIME),
        ],
    )
    assert response.status_code == 201
    listing = docs(client, org, case_id)
    assert {d["status"] for d in listing.values()} == {"failed"}
    assert "could not be read as a PDF" in listing["broken.pdf"]["processing_error"]
    assert "Word (DOCX)" in listing["broken.docx"]["processing_error"]
    assert "not a valid ZIP" in listing["broken.zip"]["processing_error"]
    assert "scanned image" in listing["scan.pdf"]["processing_error"]
    for document in listing.values():
        assert "Traceback" not in document["processing_error"]

    case = client.get(f"/tender-cases/{case_id}", headers=org.editor).json()
    assert case["documents_failed"] == 3  # zip container not counted

    retried = client.post(f"/tender-cases/{case_id}/documents/{listing['broken.pdf']['id']}/reprocess", headers=org.editor)
    assert retried.status_code == 200
    assert retried.json()["status"] == "failed"  # still broken, but re-run cleanly


def test_reprocess_rebuilds_chunks(client, org, db_session):
    case_id = new_case(client, org)
    doc = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                      files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)]).json()[0]
    count = lambda: db_session.execute(sa.text("SELECT count(*) FROM document_chunks")).scalar()
    before = count()
    response = client.post(f"/tender-cases/{case_id}/documents/{doc['id']}/reprocess", headers=org.editor)
    assert response.status_code == 200 and response.json()["status"] == "completed"
    assert count() == before


def test_zip_parent_cannot_be_reprocessed_after_unpacking(client, org):
    case_id = new_case(client, org)
    parent = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                         files=[f.upload("p.zip", f.zip_bytes({"a.pdf": f.simple_rfp_pdf()}), f.ZIP_MIME)]).json()[0]
    response = client.post(f"/tender-cases/{case_id}/documents/{parent['id']}/reprocess", headers=org.editor)
    assert response.status_code == 400


def test_delete_zip_removes_children_and_files(client, org):
    case_id = new_case(client, org)
    parent = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                         files=[f.upload("p.zip", f.zip_bytes({"a.pdf": f.simple_rfp_pdf(),
                                                                "b.docx": f.docx_bytes(["text here"])}), f.ZIP_MIME)]).json()[0]
    listing = docs(client, org, case_id)
    paths = [Path(settings.DOCUMENT_STORAGE_PATH) / d["file_path"] for d in listing.values()]
    assert all(p.exists() for p in paths)
    # requirements extracted from the children keep their textual citation
    before = client.get(f"/tender-cases/{case_id}/requirements", headers=org.editor).json()
    assert before

    assert client.delete(f"/tender-cases/{case_id}/documents/{parent['id']}", headers=org.editor).status_code == 204
    assert docs(client, org, case_id) == {}
    assert not any(p.exists() for p in paths)
    after = client.get(f"/tender-cases/{case_id}/requirements", headers=org.editor).json()
    assert {r["source_document"] for r in after} == {r["source_document"] for r in before}
    assert all(r["document_id"] is None for r in after)


def test_broker_outage_falls_back_to_inline_processing(client, org, monkeypatch):
    from app.tasks.document_processing import process_document

    def broken_delay(*args, **kwargs):
        raise ConnectionError("redis down")

    monkeypatch.setattr(process_document, "delay", broken_delay)
    case_id = new_case(client, org)
    response = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                           files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)])
    assert response.json()[0]["status"] == "completed"


def test_broker_outage_without_fallback_reports_readable_error(client, org, monkeypatch):
    from app.tasks.document_processing import process_document

    monkeypatch.setattr(settings, "TASK_SYNC_FALLBACK", False)
    monkeypatch.setattr(process_document, "delay", lambda *a, **k: (_ for _ in ()).throw(ConnectionError("down")))
    case_id = new_case(client, org)
    response = client.post(f"/tender-cases/{case_id}/documents", headers=org.editor,
                           files=[f.upload("rfp.pdf", f.simple_rfp_pdf(), f.PDF_MIME)])
    document = response.json()[0]
    assert document["status"] == "failed"
    assert "background worker is unavailable" in document["processing_error"]
