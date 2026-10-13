import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models import TenderCaseStatus


class TenderCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    reference: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    submission_deadline: datetime.date | None = None


class TenderCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    reference: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    submission_deadline: datetime.date | None = None
    status: TenderCaseStatus | None = None


class TenderCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    reference: str | None
    description: str | None
    submission_deadline: datetime.date | None
    status: TenderCaseStatus
    owner: str | None
    documents_total: int
    documents_processed: int
    documents_failed: int
    created_at: datetime.datetime
    updated_at: datetime.datetime