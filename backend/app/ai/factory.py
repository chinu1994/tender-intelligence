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
    if settings.AI_PROVIDER == "mock":
        return MockLLMProvider()

    raise ValueError(
        f"Unsupported AI provider: {settings.AI_PROVIDER}"
    )


def get_embedding_provider() -> EmbeddingProviderInterface:
    if settings.AI_PROVIDER == "mock":
        return MockEmbeddingProvider()

    raise ValueError(
        f"Unsupported AI provider: {settings.AI_PROVIDER}"
    )


def get_vector_retriever() -> VectorRetrieverInterface:
    if settings.AI_PROVIDER == "mock":
        return MockVectorRetriever()

    raise ValueError(
        f"Unsupported AI provider: {settings.AI_PROVIDER}"
    )
