import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RequirementResponse(BaseModel):
    id: uuid.UUID
    tender_case_id: uuid.UUID
    document_id: uuid.UUID | None
    requirement: str = Field(description="Effective text (reviewer correction if present).")
    original_requirement: str = Field(description="Text exactly as extracted.")
    category: str
    mandatory: bool
    confidence: float = Field(ge=0, le=1)
    deadline_value: str | None
    lot_bundle: str | None
    evaluation_criteria: str | None
    document_reference: str | None
    required_evidence: list[str]
    source_document: str | None
    source_page: int | None
    source_paragraph: int | None
    source_excerpt: str | None = Field(
        default=None, description="Original source paragraph text for side-by-side review."
    )
    review_status: str
    corrected_requirement: str | None
    review_note: str | None
    reviewed_by_id: uuid.UUID | None
    reviewed_by_email: str | None
    reviewed_at: datetime | None
    created_at: datetime | None
    flags: list[str] = Field(
        default_factory=list,
        description="Quality flags: low_confidence, missing_source, missing_location, corrected.",
    )


class RequirementUpdate(BaseModel):
    requirement: str | None = Field(default=None, min_length=1, max_length=10000)
    corrected_requirement: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    mandatory: bool | None = None
    deadline_value: str | None = Field(default=None, max_length=255)
    lot_bundle: str | None = Field(default=None, max_length=255)
    evaluation_criteria: str | None = Field(default=None, max_length=10000)
    document_reference: str | None = Field(default=None, max_length=500)
    required_evidence: list[str] | None = None
    review_status: str | None = Field(default=None, pattern="^(pending|verified|rejected)$")
    review_note: str | None = Field(default=None, max_length=5000)


class RequirementCreate(BaseModel):
    """Manually add a requirement the extraction missed."""

    requirement: str = Field(min_length=1, max_length=10000)
    category: str = Field(default="mandatory", max_length=80)
    mandatory: bool = True
    deadline_value: str | None = Field(default=None, max_length=255)
    lot_bundle: str | None = Field(default=None, max_length=255)
    evaluation_criteria: str | None = Field(default=None, max_length=10000)
    document_reference: str | None = Field(default=None, max_length=500)
    required_evidence: list[str] = Field(default_factory=list)
    source_document_id: uuid.UUID | None = None
    source_page: int | None = Field(default=None, ge=1)
    source_paragraph: int | None = Field(default=None, ge=1)
    review_note: str | None = Field(default=None, max_length=5000)


class ExtractionRunResponse(BaseModel):
    created: int
    requirements: list[RequirementResponse]
