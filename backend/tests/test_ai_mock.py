from app.ai.schemas import (
    DocumentChunk, EmbeddingRequest, ExtractionRequest, VectorSearchRequest,
)
from app.ai.service import AIService


def test_mock_extraction_keeps_source():
    chunk = DocumentChunk(
        chunk_id="c1", document_id="d1", document_name="t.pdf",
        text="Bidders must submit ISO 27001 certificate.",
        page_number=3, paragraph_number=2,
    )
    result = AIService().extract_requirements(ExtractionRequest(chunks=[chunk]))
    req = result.requirements[0]
    assert (req.source_document, req.source_page, req.source_paragraph) == ("t.pdf", 3, 2)


def test_mock_embedding_deterministic_and_sized():
    svc = AIService()
    a = svc.generate_embeddings(EmbeddingRequest(texts=["data protection GDPR"]))
    b = svc.generate_embeddings(EmbeddingRequest(texts=["data protection GDPR"]))
    assert a.embeddings == b.embeddings
    assert len(a.embeddings[0]) == 384


def test_mock_embedding_similar_texts_closer():
    svc = AIService()
    v = svc.generate_embeddings(EmbeddingRequest(texts=[
        "data protection and GDPR compliance",
        "GDPR data protection policy",
        "payment terms and penalties",
    ])).embeddings
    dot = lambda x, y: sum(p * q for p, q in zip(x, y))
    assert dot(v[0], v[1]) > dot(v[0], v[2])


def test_mock_retriever_is_tenant_isolated():
    svc = AIService()
    res = svc.search_similar(VectorSearchRequest(tenant_id="tenant-a", query_vector=[0.0]))
    assert res.results and all(r.document_id.startswith("doc-a") for r in res.results)
    none = svc.search_similar(VectorSearchRequest(tenant_id="unknown", query_vector=[0.0]))
    assert none.results == []
