from app.ai.errors import AIProviderError
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
    name = settings.LLM_PROVIDER

    if name == "mock":
        return MockLLMProvider()

    if name == "groq":
        # Imported here so mock mode never needs the provider code.
        from app.ai.providers.groq_llm import GroqLLMProvider

        return GroqLLMProvider()

    raise AIProviderError(f"Unsupported LLM provider: {name}")


def get_embedding_provider() -> EmbeddingProviderInterface:
    name = settings.EMBEDDING_PROVIDER

    if name == "mock":
        return MockEmbeddingProvider()

    if name == "local":
        from app.ai.providers.local_embedding import LocalEmbeddingProvider

        return LocalEmbeddingProvider()

    raise AIProviderError(f"Unsupported embedding provider: {name}")


def get_vector_retriever() -> VectorRetrieverInterface:
    name = settings.RETRIEVER_PROVIDER

    if name == "mock":
        return MockVectorRetriever()

    # "pgvector" is added in Step 4 (Knowledge Base backend).
    raise AIProviderError(f"Unsupported retriever provider: {name}")
