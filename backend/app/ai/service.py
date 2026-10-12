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

    def extract_requirements(self, request: ExtractionRequest) -> ExtractionResult:
        return get_llm_provider().extract(request)

    def generate_embeddings(self, request: EmbeddingRequest) -> EmbeddingResult:
        return get_embedding_provider().embed(request)

    def search_similar(self, request: VectorSearchRequest) -> VectorSearchResponse:
        return get_vector_retriever().search(request)
