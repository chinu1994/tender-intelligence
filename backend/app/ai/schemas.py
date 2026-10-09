from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    """
    A piece of text extracted from a document.

    This is the common input format used by AI providers.
    """

    chunk_id: str
    document_id: str
    document_name: str
    text: str

    page_number: int | None = None
    paragraph_number: int | None = None


class ExtractionRequest(BaseModel):
    """
    Request sent to the LLM provider for structured extraction.
    """

    chunks: list[DocumentChunk]


class ExtractedRequirement(BaseModel):
    """
    A structured requirement extracted from a tender document.
    """

    requirement: str
    category: str | None = None
    mandatory: bool = False
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    source_chunk_id: str | None = None
    source_document: str | None = None
    source_page: int | None = None
    source_paragraph: int | None = None


class ExtractionResult(BaseModel):
    """
    Standard output returned by an LLM extraction provider.
    """

    requirements: list[ExtractedRequirement]


class EmbeddingRequest(BaseModel):
    """
    Text that should be converted into an embedding vector.
    """

    texts: list[str]


class EmbeddingResult(BaseModel):
    """
    Standard embedding provider response.
    """

    embeddings: list[list[float]]


class VectorSearchRequest(BaseModel):
    """
    Tenant-scoped semantic search request.
    """

    tenant_id: str
    query_vector: list[float]
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
    )


class SourceReference(BaseModel):
    """
    Visible source information attached to a similarity result.
    """

    document_name: str
    page_number: int | None = None
    paragraph_number: int | None = None


class VectorSearchResult(BaseModel):
    """
    A single similarity-search result.
    """

    chunk_id: str
    document_id: str
    text: str
    score: float
    source: SourceReference


class VectorSearchResponse(BaseModel):
    """
    Standard response returned by the vector retriever.
    """

    results: list[VectorSearchResult]
