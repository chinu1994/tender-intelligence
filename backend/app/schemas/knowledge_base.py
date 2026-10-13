import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


ALLOWED_SOURCE_TYPES = {
    "past_tender",
    "past_bid",
    "successful_bid",
    "unsuccessful_bid",
    "completed",
}


class HistoricalDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    file_path: str
    file_type: str
    source_type: str
    outcome: str | None
    notes: str | None
    status: str
    processing_error: str | None
    created_at: datetime
    updated_at: datetime


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)
    # Optional filter: only search historical docs of this source_type
    source_type: str | None = None


class KnowledgeSearchHit(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    score: float
    source_type: str | None = None
    page_number: int | None = None
    paragraph_number: int | None = None


class KnowledgeSearchResponse(BaseModel):
    query: str
    results: list[KnowledgeSearchHit]