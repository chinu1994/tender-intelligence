from __future__ import annotations

from sqlalchemy.orm import Session

from app.ai.factory import (
    get_embedding_provider,
    get_llm_provider,
    get_vector_retriever,
)
from app.ai.schemas import (
    DraftRequest,
    DraftResult,
    EmbeddingRequest,
    EmbeddingResult,
    ExtractionRequest,
    ExtractionResult,
    VectorSearchRequest,
    VectorSearchResponse,
)
from app.core.constants import EMBEDDING_DIMENSION


class AIService:
    """Application-level facade for provider-independent AI operations."""

    def __init__(self, db: Session | None = None) -> None:
        self._db = db

    def extract_requirements(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        return get_llm_provider().extract(request)

    def draft_section(self, request: DraftRequest) -> DraftResult:
        return get_llm_provider().draft_section(request)

    def generate_embeddings(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        if not request.texts:
            return EmbeddingResult(embeddings=[])
        result = get_embedding_provider().embed(request)
        if len(result.embeddings) != len(request.texts):
            raise ValueError("Embedding provider returned a different number of vectors.")
        for vector in result.embeddings:
            if len(vector) != EMBEDDING_DIMENSION:
                raise ValueError(
                    f"Embedding provider returned {len(vector)} dimensions; expected {EMBEDDING_DIMENSION}."
                )
        return result

    def search_similar(
        self,
        request: VectorSearchRequest,
    ) -> VectorSearchResponse:
        return get_vector_retriever(self._db).search(request)
