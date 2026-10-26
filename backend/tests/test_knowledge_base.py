"""Historical knowledge base: ingestion, outcomes, cited similarity search."""
import pytest

from tests import factories as f

PAST_BID = [
    "Executive summary of our managed network services bid.",
    "We operate a 24x7 service desk with a guaranteed 15 minute response time.",
    "Our information security management system is ISO 27001 certified since 2019.",
    "Catering and event logistics are out of scope for this contract.",
]


def upload_kb(client, headers, name, content, mime, **data):
    response = client.post("/knowledge-base/documents", headers=headers,
                           files=[f.upload(name, content, mime)], data=data)
    assert response.status_code == 201, response.text
    return response.json()


def test_upload_index_and_search_with_source_references(client, org):
    upload_kb(client, org.editor, "network-bid-2024.docx", f.docx_bytes(PAST_BID), f.DOCX_MIME,
              source_type="successful_bid", outcome="won", notes="City council")
    upload_kb(client, org.editor, "old-tender.pdf",
              f.pdf_bytes([["Tender for office cleaning services."], ["The contractor must hold ISO 27001 certification."]]),
              f.PDF_MIME, source_type="past_tender")

    listing = client.get("/knowledge-base/documents", headers=org.reviewer).json()
    assert {d["status"] for d in listing} == {"completed"}
    bid = next(d for d in listing if d["name"] == "network-bid-2024.docx")
    assert (bid["source_type"], bid["outcome"], bid["notes"]) == ("successful_bid", "won", "City council")

    response = client.post("/knowledge-base/search", headers=org.reviewer,
                           json={"query": "Is our information security ISO 27001 certified?", "limit": 3})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 3
    top = results[0]
    assert "ISO 27001" in top["text"]
    # every hit carries visible source references
    for hit in results:
        assert hit["document_name"] and hit["document_id"] and hit["chunk_id"]
        assert hit["page_number"] is not None or hit["paragraph_number"] is not None
        assert 0 <= hit["score"] <= 1
    assert results == sorted(results, key=lambda h: h["score"], reverse=True)

    docx_hit = next(h for h in results if h["document_name"] == "network-bid-2024.docx")
    assert docx_hit["paragraph_number"] == 3 and docx_hit["outcome"] == "won"
    pdf_hit = next(h for h in results if h["document_name"] == "old-tender.pdf")
    assert pdf_hit["page_number"] == 2


def test_search_filters_by_source_type(client, org):
    upload_kb(client, org.editor, "won.docx", f.docx_bytes(["We provide a 24x7 service desk."]), f.DOCX_MIME,
              source_type="successful_bid", outcome="won")
    upload_kb(client, org.editor, "lost.docx", f.docx_bytes(["We provide a business-hours service desk."]), f.DOCX_MIME,
              source_type="unsuccessful_bid", outcome="lost")
    results = client.post("/knowledge-base/search", headers=org.editor,
                          json={"query": "service desk", "source_type": "unsuccessful_bid"}).json()["results"]
    assert {r["document_name"] for r in results} == {"lost.docx"}
    assert results[0]["outcome"] == "lost"


@pytest.mark.parametrize("field,value", [("source_type", "invented"), ("outcome", "maybe")])
def test_invalid_metadata_rejected(client, org, field, value):
    data = {"source_type": "past_bid", field: value}
    response = client.post("/knowledge-base/documents", headers=org.editor,
                           files=[f.upload("x.docx", f.docx_bytes(["text"]), f.DOCX_MIME)], data=data)
    assert response.status_code == 400
    assert client.post("/knowledge-base/search", headers=org.editor,
                       json={"query": "x", "source_type": "invented"}).status_code == 400


def test_zip_archive_in_knowledge_base(client, org):
    archive = f.zip_bytes({
        "2023/bid.docx": f.docx_bytes(["Our team has delivered 40 municipal network projects."]),
        "2023/prices.xlsx": f.xlsx_bytes({"Prices": [["Item", "Price"], ["Router", 900]]}),
    })
    parent = upload_kb(client, org.editor, "archive-2023.zip", archive, f.ZIP_MIME,
                       source_type="completed", outcome="completed")[0]
    listing = {d["name"]: d for d in client.get("/knowledge-base/documents", headers=org.editor).json()}
    assert listing["archive-2023.zip"]["status"] == "completed"
    for child in ("bid.docx", "prices.xlsx"):
        assert listing[child]["parent_document_id"] == parent["id"]
        assert listing[child]["status"] == "completed"
        assert listing[child]["outcome"] == "completed"  # metadata inherited
    hits = client.post("/knowledge-base/search", headers=org.editor,
                       json={"query": "municipal network projects"}).json()["results"]
    assert hits[0]["document_name"] == "bid.docx"


def test_update_outcome_and_delete(client, org):
    parent = upload_kb(client, org.editor, "pack.zip", f.zip_bytes({"a.docx": f.docx_bytes(["Alpha text"])}),
                       f.ZIP_MIME, source_type="past_bid")[0]
    updated = client.patch(f"/knowledge-base/documents/{parent['id']}", headers=org.editor,
                           json={"outcome": "won", "source_type": "successful_bid"})
    assert updated.status_code == 200 and updated.json()["outcome"] == "won"
    children = [d for d in client.get("/knowledge-base/documents", headers=org.editor).json()
                if d["parent_document_id"] == parent["id"]]
    assert children and all(c["outcome"] == "won" and c["source_type"] == "successful_bid" for c in children)

    assert client.delete(f"/knowledge-base/documents/{parent['id']}", headers=org.editor).status_code == 403
    assert client.delete(f"/knowledge-base/documents/{parent['id']}", headers=org.admin).status_code == 204
    assert client.get("/knowledge-base/documents", headers=org.admin).json() == []
    assert client.post("/knowledge-base/search", headers=org.admin, json={"query": "Alpha text"}).json()["results"] == []


def test_failed_kb_document_reports_error(client, org):
    doc = upload_kb(client, org.editor, "bad.xlsx", b"not a workbook", f.XLSX_MIME)[0]
    assert doc["status"] == "failed"
    assert "Excel (XLSX)" in doc["processing_error"]
    retried = client.post(f"/knowledge-base/documents/{doc['id']}/reprocess", headers=org.editor)
    assert retried.status_code == 200 and retried.json()["status"] == "failed"


def test_empty_query_rejected(client, org):
    assert client.post("/knowledge-base/search", headers=org.editor, json={"query": "   "}).status_code == 400
    assert client.post("/knowledge-base/search", headers=org.editor, json={"query": ""}).status_code == 422
