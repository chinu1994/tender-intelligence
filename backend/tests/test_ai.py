from app.ai.mocks import (
    MockEmbeddingProvider,
    MockLLMProvider,
    MockVectorRetriever,
)
from app.ai.schemas import (
    DocumentChunk,
    EmbeddingRequest,
    ExtractionRequest,
    VectorSearchRequest,
)

from app.ai.factory import (
    get_embedding_provider,
    get_llm_provider,
    get_vector_retriever,
)
from app.ai.interfaces import (
    EmbeddingProviderInterface,
    LLMProviderInterface,
    VectorRetrieverInterface,
)
from app.ai.service import AIService




def test_mock_llm_extracts_requirement():
    provider = MockLLMProvider()

    request = ExtractionRequest(
        chunks=[
            DocumentChunk(
                chunk_id="chunk-1",
                document_id="doc-1",
                document_name="tender.pdf",
                text="Technical compliance certificate is mandatory.",
                page_number=5,
                paragraph_number=2,
            )
        ]
    )

    result = provider.extract(request)

    assert len(result.requirements) == 1

    requirement = result.requirements[0]

    assert requirement.requirement == (
        "Technical compliance certificate is mandatory."
    )
    assert requirement.mandatory is True
    assert requirement.confidence == 0.90
    assert requirement.source_chunk_id == "chunk-1"
    assert requirement.source_document == "tender.pdf"
    assert requirement.source_page == 5
    assert requirement.source_paragraph == 2


def test_mock_embedding_is_deterministic():
    provider = MockEmbeddingProvider()

    request = EmbeddingRequest(
        texts=["hello tender"]
    )

    first_result = provider.embed(request)
    second_result = provider.embed(request)

    assert first_result.embeddings == second_result.embeddings
    assert len(first_result.embeddings) == 1
    assert len(first_result.embeddings[0]) == 8


def test_mock_vector_retriever_respects_tenant_isolation():
    provider = MockVectorRetriever()

    tenant_a_request = VectorSearchRequest(
        tenant_id="tenant-a",
        query_vector=[0.1] * 8,
        limit=10,
    )

    tenant_b_request = VectorSearchRequest(
        tenant_id="tenant-b",
        query_vector=[0.1] * 8,
        limit=10,
    )

    tenant_a_result = provider.search(tenant_a_request)
    tenant_b_result = provider.search(tenant_b_request)

    assert len(tenant_a_result.results) == 2
    assert len(tenant_b_result.results) == 1

    tenant_a_document_ids = {
        result.document_id
        for result in tenant_a_result.results
    }

    tenant_b_document_ids = {
        result.document_id
        for result in tenant_b_result.results
    }

    assert "doc-b-1" not in tenant_a_document_ids
    assert "doc-a-1" not in tenant_b_document_ids


def test_mock_vector_retriever_returns_source_reference():
    provider = MockVectorRetriever()

    request = VectorSearchRequest(
        tenant_id="tenant-a",
        query_vector=[0.1] * 8,
        limit=1,
    )

    result = provider.search(request)

    assert len(result.results) == 1

    source = result.results[0].source

    assert source.document_name == "tender-a.pdf"
    assert source.page_number == 2
    assert source.paragraph_number == 1

def test_ai_factory_returns_llm_provider():
    provider = get_llm_provider()

    assert isinstance(provider, LLMProviderInterface)


def test_ai_factory_returns_embedding_provider():
    provider = get_embedding_provider()

    assert isinstance(provider, EmbeddingProviderInterface)


def test_ai_factory_returns_vector_retriever():
    provider = get_vector_retriever()

    assert isinstance(provider, VectorRetrieverInterface)



def test_ai_service_extracts_requirements():
    service = AIService()

    request = ExtractionRequest(
        chunks=[
            DocumentChunk(
                chunk_id="chunk-service-1",
                document_id="doc-service-1",
                document_name="service-test.pdf",
                text="Bid bond is mandatory.",
                page_number=4,
                paragraph_number=2,
            )
        ]
    )

    result = service.extract_requirements(request)

    assert len(result.requirements) == 1
    assert result.requirements[0].requirement == "Bid bond is mandatory."
    assert result.requirements[0].source_document == "service-test.pdf"


def test_ai_service_generates_embeddings():
    service = AIService()

    request = EmbeddingRequest(
        texts=["Tender requirement"]
    )

    result = service.generate_embeddings(request)

    assert len(result.embeddings) == 1
    assert len(result.embeddings[0]) == 8


def test_ai_service_searches_similar_documents():
    service = AIService()

    request = VectorSearchRequest(
        tenant_id="tenant-a",
        query_vector=[0.1] * 8,
        limit=10,
    )

    result = service.search_similar(request)

    assert len(result.results) == 2
    assert all(
        item.document_id == "doc-a-1"
        for item in result.results
    )
