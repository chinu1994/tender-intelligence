import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProposalSectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    status: str = Field(default="draft", pattern="^(draft|complete)$")
    sort_order: int = 0


class ProposalSectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    status: str | None = Field(default=None, pattern="^(draft|complete)$")
    sort_order: int | None = None


class ProposalSectionResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    status: str
    sort_order: int
    updated_at: datetime | None = None


class ProposalIssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10000)
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


class ProposalIssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10000)
    severity: str | None = Field(default=None, pattern="^(low|medium|high)$")
    resolved: bool | None = None


class ProposalIssueResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    severity: str
    resolved: bool
    created_at: datetime | None = None


class WorkspaceRequirement(BaseModel):
    id: uuid.UUID
    requirement: str
    category: str
    mandatory: bool
    review_status: str
    confidence: float
    source_document: str | None
    source_page: int | None
    source_paragraph: int | None


class ApprovalReadiness(BaseModel):
    ready: bool
    blockers: list[str]


class ProposalWorkspaceResponse(BaseModel):
    case_id: uuid.UUID
    case_name: str
    case_reference: str | None
    case_status: str
    submission_deadline: str | None
    sections: list[ProposalSectionResponse]
    issues: list[ProposalIssueResponse]
    requirements: list[WorkspaceRequirement]
    approval: ApprovalReadiness


class SnippetMatch(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    score: float
    source_type: str | None = None
    outcome: str | None = None
    page_number: int | None = None
    paragraph_number: int | None = None


class RequirementMatches(BaseModel):
    requirement_id: uuid.UUID
    query: str
    results: list[SnippetMatch]


class DraftSectionRequest(BaseModel):
    requirement_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Requirements to address; defaults to all non-rejected mandatory ones.",
    )
    include_matches: bool = True
    replace: bool = Field(default=False, description="Replace instead of appending to current content.")


class GeneratedIssues(BaseModel):
    created: int
    issues: list[ProposalIssueResponse]


class ApprovalResponse(BaseModel):
    case_id: uuid.UUID
    status: str
