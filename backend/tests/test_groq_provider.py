"""Groq provider tested with a fake HTTP transport. No network, no real key."""
import json

import httpx
import pytest

from app.ai.errors import AIProviderError
from app.ai.providers import groq_llm
from app.ai.schemas import DocumentChunk, ExtractionRequest
from app.core.config import settings


def _chunks():
    return [DocumentChunk(chunk_id="c1", document_id="d1", document_name="t.pdf",
                          text="The bid must be submitted by 14 Nov 2026.",
                          page_number=4, paragraph_number=2)]


def _provider(monkeypatch, handler):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    p = groq_llm.GroqLLMProvider()
    p._client = httpx.Client(base_url="http://fake", transport=httpx.MockTransport(handler))
    return p


def _ok(content: dict):
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})


def test_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    with pytest.raises(AIProviderError):
        groq_llm.GroqLLMProvider()


def test_source_comes_from_chunk_not_llm(monkeypatch):
    p = _provider(monkeypatch, lambda r: _ok({"requirements": [{
        "requirement": "Submit bid by 14 Nov 2026", "category": "deadlines",
        "mandatory": True, "confidence": 0.9, "source_chunk_id": "c1",
        "source_page": 999}]}))
    req = p.extract(ExtractionRequest(chunks=_chunks())).requirements[0]
    assert req.source_page == 4 and req.source_paragraph == 2 and req.category == "deadlines"


def test_unknown_chunk_id_is_dropped(monkeypatch):
    p = _provider(monkeypatch, lambda r: _ok({"requirements": [{
        "requirement": "x", "category": "lots", "source_chunk_id": "made-up"}]}))
    assert p.extract(ExtractionRequest(chunks=_chunks())).requirements == []


def test_confidence_clamped_and_bad_category_fixed(monkeypatch):
    p = _provider(monkeypatch, lambda r: _ok({"requirements": [{
        "requirement": "x", "category": "weird", "confidence": 7, "source_chunk_id": "c1"}]}))
    req = p.extract(ExtractionRequest(chunks=_chunks())).requirements[0]
    assert req.confidence == 1.0 and req.category == "requirements"


def test_bad_key_gives_clear_error(monkeypatch):
    p = _provider(monkeypatch, lambda r: httpx.Response(401, json={}))
    with pytest.raises(AIProviderError, match="GROQ_API_KEY"):
        p.extract(ExtractionRequest(chunks=_chunks()))


def test_invalid_json_retries_then_fails(monkeypatch):
    calls = []
    def handler(r):
        calls.append(1)
        return httpx.Response(200, json={"choices": [{"message": {"content": "not json"}}]})
    p = _provider(monkeypatch, handler)
    with pytest.raises(AIProviderError, match="invalid JSON"):
        p.extract(ExtractionRequest(chunks=_chunks()))
    assert len(calls) == 2


def test_http_error_shows_provider_message(monkeypatch):
    p = _provider(monkeypatch, lambda r: httpx.Response(
        404, json={"error": {"message": "model does not exist"}}))
    with pytest.raises(AIProviderError, match="model does not exist"):
        p.extract(ExtractionRequest(chunks=_chunks()))