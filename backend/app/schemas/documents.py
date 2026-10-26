import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import DocumentStatus


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tender_case_id: uuid.UUID
    parent_document_id: uuid.UUID | None = None
    name: str
    file_path: str
    file_type: str
    status: DocumentStatus
    processing_error: str | None
    created_at: datetime
    updated_at: datetime
