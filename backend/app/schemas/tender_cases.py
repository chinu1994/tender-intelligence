import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models import TenderCaseStatus


class TenderCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class TenderCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: TenderCaseStatus | None = None


class TenderCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    status: TenderCaseStatus
    created_at: object
    updated_at: object
