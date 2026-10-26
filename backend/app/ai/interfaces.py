"""Service Provider Interfaces (SPI) for all AI capabilities.

Business logic depends only on these abstract contracts. Concrete adapters
live in ``app.ai.mocks`` (deterministic fixtures for dev/tests),
``app.ai.providers`` (remote LLM/embedding endpoints) and
``app.ai.retrievers`` (pgvector). ``app.ai.factory`` selects adapters from
environment configuration only.
"""
from abc import ABC, abstractmethod

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


class LLMProviderInterface(ABC):
    """Provider-agnostic contract for language-model operations."""

    @abstractmethod
    def extract(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        """Extract structured tender information from document chunks.

        Implementations must only cite ``source_chunk_id`` values that were
        part of the request.
        """
        raise NotImplementedError

    @abstractmethod
    def draft_section(
        self,
        request: DraftRequest,
    ) -> DraftResult:
        """Draft proposal section text from requirements and precedent."""
        raise NotImplementedError


class EmbeddingProviderInterface(ABC):
    """Provider-agnostic contract for generating embeddings."""

    @abstractmethod
    def embed(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        """Convert text into embedding vectors of ``EMBEDDING_DIMENSION``."""
        raise NotImplementedError


class VectorRetrieverInterface(ABC):
    """Provider-agnostic contract for semantic/vector retrieval."""

    @abstractmethod
    def search(
        self,
        request: VectorSearchRequest,
    ) -> VectorSearchResponse:
        """Search vectors strictly within ``request.tenant_id``."""
        raise NotImplementedError
