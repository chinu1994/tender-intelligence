from app.ai.factory import (
    get_embedding_provider,
    get_llm_provider,
    get_vector_retriever,
)
from app.ai.schemas import (
    EmbeddingRequest,
    EmbeddingResult,
    ExtractionRequest,
    ExtractionResult,
    VectorSearchRequest,
    VectorSearchResponse,
)


class AIService:
    """Application-level service for provider-independent AI operations."""

    def extract_requirements(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        provider = get_llm_provider()
        return provider.extract(request)

    def generate_embeddings(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        provider = get_embedding_provider()
        return provider.embed(request)

    def search_similar(
        self,
        request: VectorSearchRequest,
    ) -> VectorSearchResponse:
        provider = get_vector_retriever()
        return provider.search(request)
