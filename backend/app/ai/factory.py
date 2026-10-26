"""Select AI adapters from configuration. The only place adapters are named."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.ai.interfaces import (
    EmbeddingProviderInterface,
    LLMProviderInterface,
    VectorRetrieverInterface,
)
from app.ai.mocks import (
    MockEmbeddingProvider,
    MockLLMProvider,
    MockVectorRetriever,
)
from app.core.config import settings


def get_llm_provider() -> LLMProviderInterface:
    provider = (settings.AI_PROVIDER or "mock").lower().strip()
    if provider == "mock":
        return MockLLMProvider()
    if provider == "groq":
        from app.ai.providers.groq_llm import GroqLLMProvider
        return GroqLLMProvider()
    if provider == "openai_compatible":
        from app.ai.providers.openai_compatible import OpenAICompatibleLLMProvider
        return OpenAICompatibleLLMProvider()
    raise ValueError(f"Unsupported AI provider: {settings.AI_PROVIDER}")


def get_embedding_provider() -> EmbeddingProviderInterface:
    provider = (settings.EMBEDDING_PROVIDER or "mock").lower().strip()
    if provider == "mock":
        return MockEmbeddingProvider()
    if provider == "openai_compatible":
        from app.ai.providers.openai_compatible import OpenAICompatibleEmbeddingProvider
        return OpenAICompatibleEmbeddingProvider()
    raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")


def get_vector_retriever(db: Session | None = None) -> VectorRetrieverInterface:
    retriever = (settings.VECTOR_RETRIEVER or "pgvector").lower().strip()
    if retriever == "mock" or db is None:
        return MockVectorRetriever()
    if retriever == "pgvector":
        from app.ai.retrievers import PgVectorRetriever
        return PgVectorRetriever(db)
    raise ValueError(f"Unsupported vector retriever: {settings.VECTOR_RETRIEVER}")
