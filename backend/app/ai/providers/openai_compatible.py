"""Generic adapters for any OpenAI-compatible HTTP API.

Works with self-hosted runtimes (Ollama, vLLM, LocalAI, HuggingFace TEI) and
hosted APIs that expose ``/chat/completions`` and ``/embeddings``. Endpoints,
keys and model names come exclusively from environment variables, so no
vendor is hard-wired into business logic.
"""
from __future__ import annotations

import httpx

from app.ai.errors import AIProviderError
from app.ai.interfaces import EmbeddingProviderInterface
from app.ai.providers.groq_llm import GroqLLMProvider
from app.ai.schemas import EmbeddingRequest, EmbeddingResult
from app.core.config import settings
from app.core.constants import EMBEDDING_DIMENSION


class OpenAICompatibleLLMProvider(GroqLLMProvider):
    PROVIDER_NAME = "LLM provider"
    KEY_ENV = "LLM_API_KEY"
    REQUIRES_KEY = False  # local runtimes usually need no key

    def __init__(self) -> None:
        if not settings.LLM_API_BASE_URL or not settings.LLM_MODEL:
            raise AIProviderError(
                "LLM_API_BASE_URL and LLM_MODEL are required when AI_PROVIDER=openai_compatible."
            )
        super().__init__(
            base_url=settings.LLM_API_BASE_URL,
            api_key=settings.LLM_API_KEY,
            model=settings.LLM_MODEL,
        )


class OpenAICompatibleEmbeddingProvider(EmbeddingProviderInterface):
    BATCH_SIZE = 64

    def __init__(self, client: httpx.Client | None = None) -> None:
        if client is None:
            if not settings.EMBEDDING_API_BASE_URL or not settings.EMBEDDING_MODEL:
                raise AIProviderError(
                    "EMBEDDING_API_BASE_URL and EMBEDDING_MODEL are required when "
                    "EMBEDDING_PROVIDER=openai_compatible."
                )
            headers = {"Content-Type": "application/json"}
            if settings.EMBEDDING_API_KEY:
                headers["Authorization"] = f"Bearer {settings.EMBEDDING_API_KEY}"
            client = httpx.Client(
                base_url=settings.EMBEDDING_API_BASE_URL.rstrip("/"),
                headers=headers,
                timeout=60.0,
            )
        self._client = client
        self._model = settings.EMBEDDING_MODEL

    def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        vectors: list[list[float]] = []
        for start in range(0, len(request.texts), self.BATCH_SIZE):
            batch = request.texts[start:start + self.BATCH_SIZE]
            try:
                resp = self._client.post(
                    "/embeddings", json={"model": self._model, "input": batch}
                )
            except httpx.HTTPError as exc:
                raise AIProviderError(f"Embedding request failed: {exc}") from exc
            if resp.status_code >= 400:
                raise AIProviderError(
                    f"Embedding provider error {resp.status_code}: {resp.text[:300]}"
                )
            try:
                data = sorted(resp.json()["data"], key=lambda item: item.get("index", 0))
                batch_vectors = [list(map(float, item["embedding"])) for item in data]
            except (KeyError, TypeError, ValueError) as exc:
                raise AIProviderError("Embedding provider returned an unexpected payload") from exc
            if len(batch_vectors) != len(batch):
                raise AIProviderError("Embedding provider returned a different number of vectors")
            for vector in batch_vectors:
                if len(vector) != EMBEDDING_DIMENSION:
                    raise AIProviderError(
                        f"Embedding model returned {len(vector)} dimensions; this deployment "
                        f"stores {EMBEDDING_DIMENSION}. Choose a {EMBEDDING_DIMENSION}-dimension "
                        "model or migrate the vector columns."
                    )
            vectors.extend(batch_vectors)
        return EmbeddingResult(embeddings=vectors)
