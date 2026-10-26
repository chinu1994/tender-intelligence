"""Provider-independent data contracts (DTOs) for the AI service layer.

Every adapter (mock, Groq, OpenAI-compatible, pgvector...) consumes and
produces only these types, so business logic never depends on a vendor SDK.
"""
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    """A piece of text extracted from a document, with citation metadata."""

    chunk_id: str
    document_id: str
    document_name: str
    text: str

    page_number: int | None = None
    paragraph_number: int | None = None


class ExtractionRequest(BaseModel):
    """Request sent to the LLM provider for structured extraction."""

    chunks: list[DocumentChunk]


class ExtractedRequirement(BaseModel):
    """A structured requirement extracted from a tender document."""

    requirement: str
    category: str | None = None
    mandatory: bool = False
    deadline_value: str | None = None
    lot_bundle: str | None = None
    evaluation_criteria: str | None = None
    document_reference: str | None = None
    required_evidence: list[str] = Field(default_factory=list)
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
    """Standard output returned by an LLM extraction provider."""

    requirements: list[ExtractedRequirement]


class EmbeddingRequest(BaseModel):
    """Text that should be converted into embedding vectors."""

    texts: list[str]


class EmbeddingResult(BaseModel):
    """Standard embedding provider response (one vector per input text)."""

    embeddings: list[list[float]]


class VectorSearchRequest(BaseModel):
    """Tenant-scoped semantic search request.

    ``tenant_id`` must always come from the authenticated principal on the
    server side, never from client input.
    """

    tenant_id: str
    query_vector: list[float]
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
    )
    source_type: str | None = None
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)


class SourceReference(BaseModel):
    """Visible source information attached to a similarity result."""

    document_name: str
    page_number: int | None = None
    paragraph_number: int | None = None
    source_type: str | None = None
    outcome: str | None = None


class VectorSearchResult(BaseModel):
    """A single similarity-search result."""

    chunk_id: str
    document_id: str
    text: str
    score: float
    source: SourceReference


class VectorSearchResponse(BaseModel):
    """Standard response returned by the vector retriever."""

    results: list[VectorSearchResult]


# ---------------------------------------------------------------------------
# Proposal drafting
# ---------------------------------------------------------------------------


class DraftRequirement(BaseModel):
    requirement: str
    category: str | None = None
    mandatory: bool = False
    source: str | None = None


class DraftSnippet(BaseModel):
    text: str
    document_name: str
    page_number: int | None = None
    paragraph_number: int | None = None
    outcome: str | None = None


class DraftRequest(BaseModel):
    case_name: str
    section_title: str
    requirements: list[DraftRequirement] = Field(default_factory=list)
    snippets: list[DraftSnippet] = Field(default_factory=list)
    existing_content: str = ""


class DraftResult(BaseModel):
    content: str


# ---------------------------------------------------------------------------
# Structured extraction view (typed schema for the five spec categories)
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    requirement_id: str | None = None
    source_document: str | None = None
    source_page: int | None = None
    source_paragraph: int | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    review_status: str | None = None


class ExtractedDeadline(Citation):
    value: str
    description: str | None = None


class ExtractedLot(Citation):
    name: str
    description: str | None = None


class ExtractedEvaluationCriterion(Citation):
    criterion: str
    weight: str | None = None


class ExtractedEvidence(Citation):
    evidence: str
    mandatory: bool = False


class ExtractedDocumentReference(Citation):
    reference: str
    context: str | None = None


class ExtractedMandatoryRequirement(Citation):
    requirement: str
    category: str | None = None


class StructuredTenderExtraction(BaseModel):
    deadlines: list[ExtractedDeadline] = Field(default_factory=list)
    lots: list[ExtractedLot] = Field(default_factory=list)
    requirements: list[ExtractedMandatoryRequirement] = Field(default_factory=list)
    evaluation_criteria: list[ExtractedEvaluationCriterion] = Field(default_factory=list)
    required_evidence: list[ExtractedEvidence] = Field(default_factory=list)
    document_references: list[ExtractedDocumentReference] = Field(default_factory=list)
