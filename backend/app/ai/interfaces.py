from abc import ABC, abstractmethod

from app.ai.schemas import (
    EmbeddingRequest,
    EmbeddingResult,
    ExtractionRequest,
    ExtractionResult,
    VectorSearchRequest,
    VectorSearchResponse,
)


class LLMProviderInterface(ABC):
    """
    Provider-agnostic contract for language-model operations.
    """

    @abstractmethod
    def extract(
        self,
        request: ExtractionRequest,
    ) -> ExtractionResult:
        """
        Extract structured tender information from document chunks.
        """
        raise NotImplementedError


class EmbeddingProviderInterface(ABC):
    """
    Provider-agnostic contract for generating embeddings.
    """

    @abstractmethod
    def embed(
        self,
        request: EmbeddingRequest,
    ) -> EmbeddingResult:
        """
        Convert text into embedding vectors.
        """
        raise NotImplementedError


class VectorRetrieverInterface(ABC):
    """
    Provider-agnostic contract for semantic/vector retrieval.
    """

    @abstractmethod
    def search(
        self,
        request: VectorSearchRequest,
    ) -> VectorSearchResponse:
        """
        Search vectors within a tenant-isolated scope.
        """
        raise NotImplementedError
