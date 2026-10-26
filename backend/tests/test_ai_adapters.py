"""AI SPI contracts, factory selection and OpenAI-compatible adapters (no network)."""
import json
import math

import httpx
import pytest

from app.ai import factory
from app.ai.errors import AIProviderError
from app.ai.interfaces import EmbeddingProviderInterface, LLMProviderInterface
from app.ai.mocks import MockEmbeddingProvider, MockLLMProvider, classify_text
from app.ai.providers import openai_compatible
from app.ai.schemas import DocumentChunk, DraftRequest, DraftRequirement, DraftSnippet, EmbeddingRequest, ExtractionRequest
from app.ai.service import AIService
from app.core.config import settings
from app.core.constants import EMBEDDING_DIMENSION


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))


def test_mock_embeddings_are_unit_vectors_and_semantic_enough():
    vectors = MockEmbeddingProvider().embed(EmbeddingRequest(texts=[
        "Bidders must provide an ISO 27001 certificate",
        "Attach a copy of your ISO 27001 certification",
        "The catering contract covers vegetarian meals",
        "",
    ])).embeddings
    assert all(len(v) == EMBEDDING_DIMENSION for v in vectors)
    assert all(math.isclose(sum(x * x for x in v), 1.0, rel_tol=1e-9) for v in vectors)
    assert cosine(vectors[0], vectors[1]) > cosine(vectors[0], vectors[2]) + 0.2


@pytest.mark.parametrize(
    "text,category,extra",
    [
        ("Offers must be submitted by 1 December 2026 at 10:00 CET.", "deadline", {"deadline_value": "1 December 2026 at 10:00 CET"}),
        ("The closing date is 2026-12-01.", "deadline", {"deadline_value": "2026-12-01"}),
        ("Lot B comprises maintenance services.", "lots", {"lot_bundle": "Lot B"}),
        ("Award criteria: quality 70 points, price 30 points.", "evaluation", {}),
        ("Provide proof of professional indemnity insurance.", "evidence", {}),
        ("The contractor shall comply with the GDPR.", "mandatory", {"mandatory": True}),
        ("Further details are given in Schedule 4 and terms.pdf.", "document_reference", {"document_reference": "Schedule 4; terms.pdf"}),
    ],
)
def test_mock_classifier(text, category, extra):
    result = classify_text(text)
    assert result is not None and result.category == category
    for key, value in extra.items():
        assert getattr(result, key) == value


@pytest.mark.parametrize("text", ["Introduction", "1.2", "The authority is a public body founded in 1950."])
def test_mock_classifier_ignores_non_requirements(text):
    assert classify_text(text) is None


def test_mock_extraction_only_cites_given_chunks():
    chunks = [DocumentChunk(chunk_id=f"c{i}", document_id="d", document_name="t.pdf", text=t, page_number=i, paragraph_number=1)
              for i, t in enumerate(["Bidders must register.", "Background information only.", "Lot 3 covers training."], start=1)]
    result = MockLLMProvider().extract(ExtractionRequest(chunks=chunks))
    assert [(r.source_chunk_id, r.source_page) for r in result.requirements] == [("c1", 1), ("c3", 3)]


def test_mock_draft_contains_requirements_and_cited_snippets():
    draft = MockLLMProvider().draft_section(DraftRequest(
        case_name="Network RFP",
        section_title="Technical Approach",
        requirements=[DraftRequirement(requirement="Provide 24x7 support.", mandatory=True, source="rfp.pdf, p. 2")],
        snippets=[DraftSnippet(text="We run a 24x7 NOC.", document_name="bid.docx", paragraph_number=4)],
        existing_content="Intro.",
    )).content
    assert draft.startswith("Intro.")
    assert "- Provide 24x7 support. (mandatory) [rfp.pdf, p. 2]" in draft
    assert "We run a 24x7 NOC. [Source: bid.docx, paragraph 4]" in draft


def test_factory_selection(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")
    assert isinstance(factory.get_llm_provider(), MockLLMProvider)
    monkeypatch.setattr(settings, "AI_PROVIDER", "unknown")
    with pytest.raises(ValueError):
        factory.get_llm_provider()
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "unknown")
    with pytest.raises(ValueError):
        factory.get_embedding_provider()
    monkeypatch.setattr(settings, "VECTOR_RETRIEVER", "unknown")
    with pytest.raises(ValueError):
        factory.get_vector_retriever(db=object())


def test_openai_compatible_llm_requires_configuration(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai_compatible")
    monkeypatch.setattr(settings, "LLM_API_BASE_URL", "")
    with pytest.raises(AIProviderError, match="LLM_API_BASE_URL"):
        factory.get_llm_provider()

    monkeypatch.setattr(settings, "LLM_API_BASE_URL", "http://ollama:11434/v1")
    monkeypatch.setattr(settings, "LLM_MODEL", "llama3.1")
    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    provider = factory.get_llm_provider()
    assert isinstance(provider, LLMProviderInterface)
    assert "Authorization" not in provider._client.headers  # local runtimes need no key


def test_openai_compatible_llm_extract_and_draft(monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_BASE_URL", "http://fake/v1")
    monkeypatch.setattr(settings, "LLM_MODEL", "m")
    provider = openai_compatible.OpenAICompatibleLLMProvider()
    seen = []

    def handler(request):
        body = json.loads(request.content)
        seen.append(body)
        if "bid writer" in body["messages"][0]["content"]:
            content = {"content": "Drafted text"}
        else:
            content = {"requirements": [{"requirement": "Register", "category": "deadline", "mandatory": True,
                                         "confidence": 0.8, "source_chunk_id": "c1", "document_reference": "Annex 1"}]}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})

    provider._client = httpx.Client(base_url="http://fake/v1", transport=httpx.MockTransport(handler))
    chunk = DocumentChunk(chunk_id="c1", document_id="d", document_name="t.pdf", text="x", page_number=2, paragraph_number=3)
    req = provider.extract(ExtractionRequest(chunks=[chunk])).requirements[0]
    assert (req.category, req.document_reference, req.source_page) == ("deadlines", "Annex 1", 2)
    assert provider.draft_section(DraftRequest(case_name="c", section_title="s")).content == "Drafted text"
    assert seen[0]["model"] == "m" and seen[0]["response_format"] == {"type": "json_object"}


def test_openai_compatible_llm_batches_large_requests(monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_BASE_URL", "http://fake/v1")
    monkeypatch.setattr(settings, "LLM_MODEL", "m")
    provider = openai_compatible.OpenAICompatibleLLMProvider()
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, json={"choices": [{"message": {"content": "{\"requirements\": []}"}}]})

    provider._client = httpx.Client(base_url="http://fake/v1", transport=httpx.MockTransport(handler))
    chunks = [DocumentChunk(chunk_id=f"c{i}", document_id="d", document_name="t", text="x") for i in range(85)]
    provider.extract(ExtractionRequest(chunks=chunks))
    assert len(calls) == 3


def embedding_provider(monkeypatch, handler):
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "all-minilm")
    return openai_compatible.OpenAICompatibleEmbeddingProvider(
        client=httpx.Client(base_url="http://fake", transport=httpx.MockTransport(handler))
    )


def test_openai_compatible_embeddings(monkeypatch):
    def handler(request):
        body = json.loads(request.content)
        data = [{"index": i, "embedding": [float(i)] * EMBEDDING_DIMENSION} for i in range(len(body["input"]))]
        return httpx.Response(200, json={"data": list(reversed(data))})

    provider = embedding_provider(monkeypatch, handler)
    assert isinstance(provider, EmbeddingProviderInterface)
    texts = [f"t{i}" for i in range(70)]  # two batches
    vectors = provider.embed(EmbeddingRequest(texts=texts)).embeddings
    assert len(vectors) == 70 and vectors[1][0] == 1.0  # re-ordered by index


def test_openai_compatible_embeddings_dimension_mismatch(monkeypatch):
    provider = embedding_provider(monkeypatch, lambda r: httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1] * 1536}]}))
    with pytest.raises(AIProviderError, match="1536 dimensions"):
        provider.embed(EmbeddingRequest(texts=["x"]))


def test_openai_compatible_embeddings_http_error(monkeypatch):
    provider = embedding_provider(monkeypatch, lambda r: httpx.Response(500, text="boom"))
    with pytest.raises(AIProviderError, match="500"):
        provider.embed(EmbeddingRequest(texts=["x"]))


def test_service_validates_embedding_dimension(monkeypatch):
    class BadProvider(EmbeddingProviderInterface):
        def embed(self, request):
            from app.ai.schemas import EmbeddingResult
            return EmbeddingResult(embeddings=[[0.0] * 3 for _ in request.texts])

    monkeypatch.setattr("app.ai.service.get_embedding_provider", lambda: BadProvider())
    with pytest.raises(ValueError, match="expected 384"):
        AIService().generate_embeddings(EmbeddingRequest(texts=["x"]))
    assert AIService().generate_embeddings(EmbeddingRequest(texts=[])).embeddings == []
