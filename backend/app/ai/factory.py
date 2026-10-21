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
    raise ValueError(f"Unsupported AI provider: {settings.AI_PROVIDER}")


def get_embedding_provider() -> EmbeddingProviderInterface:
    # Embeddings stay on mock for now (deterministic, no extra key required).
    # Real embedding provider can be plugged later without changing callers.
    return MockEmbeddingProvider()


def get_vector_retriever() -> VectorRetrieverInterface:
    return MockVectorRetriever()