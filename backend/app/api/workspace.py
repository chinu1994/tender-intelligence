"""Persisted extraction review, proposal workspace, and export APIs."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from io import BytesIO

from docx import Document as DocxDocument
from docx.shared import Inches
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.schemas import DocumentChunk as AIChunk, ExtractionRequest
from app.ai.service import AIService
from app.api.dependencies import get_current_user, require_editor, require_reviewer
from app.db.session import get_db
from app.models import (
    Document, DocumentChunk, ExtractedRequirementRecord, ProposalIssue,
    ProposalSection, TenderCase, TenderCaseStatus, User,
)

router = APIRouter(tags=["Extraction and Proposal Workspace"])


class RequirementUpdate(BaseModel):
    requirement: str | None = Field(default=None, min_length=1, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    mandatory: bool | None = None
    review_status: str | None = Field(default=None, pattern="^(pending|verified|rejected)$")
    corrected_requirement: str | None = Field(default=None, max_length=10000)
    review_note: str | None = Field(default=None, max_length=5000)


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


class ProposalIssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10000)
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")


class ProposalIssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10000)
    severity: str | None = Field(default=None, pattern="^(low|medium|high)$")
    resolved: bool | None = None


def _case_or_404(db: Session, case_id: uuid.UUID, user: User) -> TenderCase:
    case = db.query(TenderCase).filter(
        TenderCase.id == case_id,
        TenderCase.tenant_id == user.tenant_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Tender case not found")
    return case


def _requirement_payload(item: ExtractedRequirementRecord) -> dict:
    return {
        "id": str(item.id), "tender_case_id": str(item.tender_case_id),
        "document_id": str(item.document_id) if item.document_id else None,
        "requirement": item.corrected_requirement or item.requirement,
        "original_requirement": item.requirement, "category": item.category,
        "mandatory": item.mandatory, "confidence": item.confidence / 100.0,
        "deadline_value": item.deadline_value, "lot_bundle": item.lot_bundle,
        "evaluation_criteria": item.evaluation_criteria, "required_evidence": item.required_evidence or [],
        "source_document": item.source_document, "source_page": item.source_page,
        "source_paragraph": item.source_paragraph,
        "review_status": item.review_status, "corrected_requirement": item.corrected_requirement,
        "review_note": item.review_note,
        "reviewed_by_id": str(item.reviewed_by_id) if item.reviewed_by_id else None,
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.post("/tender-cases/{case_id}/extract-requirements")
def extract_case_requirements(
    case_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    case = _case_or_404(db, case_id, current_user)
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Approved/completed cases cannot be re-extracted")
    rows = db.query(DocumentChunk, Document).join(
        Document, Document.id == DocumentChunk.document_id
    ).filter(
        DocumentChunk.tenant_id == current_user.tenant_id,
        Document.tenant_id == current_user.tenant_id,
        Document.tender_case_id == case.id,
        Document.status == "completed",
    ).order_by(Document.created_at, DocumentChunk.chunk_index).all()
    if not rows:
        raise HTTPException(status_code=400, detail="No processed documents found. Upload documents and wait until processing is completed.")

    ai_chunks = [AIChunk(
        chunk_id=str(chunk.id), document_id=str(document.id), document_name=document.name,
        text=chunk.text, page_number=chunk.page_number, paragraph_number=chunk.paragraph_number,
    ) for chunk, document in rows]
    result = AIService().extract_requirements(ExtractionRequest(chunks=ai_chunks))
    source_by_chunk = {str(chunk.id): (chunk, document) for chunk, document in rows}

    # Keep reviewed decisions; replace only previously unreviewed extraction output.
    db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.tenant_id == current_user.tenant_id,
        ExtractedRequirementRecord.tender_case_id == case.id,
        ExtractedRequirementRecord.review_status == "pending",
    ).delete(synchronize_session=False)
    created = []
    for requirement in result.requirements:
        source = source_by_chunk.get(requirement.source_chunk_id or "")
        chunk, document = source if source else (None, None)
        # The mock adapter returns a chunk's entire text; persist the provenance, not a guessed citation.
        created.append(ExtractedRequirementRecord(
            tenant_id=current_user.tenant_id, tender_case_id=case.id,
            document_id=document.id if document else None,
            source_chunk_id=chunk.id if chunk else None,
            requirement=requirement.requirement,
            category=(requirement.category or "mandatory")[:80],
            mandatory=requirement.mandatory,
            deadline_value=requirement.deadline_value,
            lot_bundle=requirement.lot_bundle,
            evaluation_criteria=requirement.evaluation_criteria,
            required_evidence=requirement.required_evidence,
            confidence=max(0, min(100, round(requirement.confidence * 100))),
            source_document=requirement.source_document or (document.name if document else None),
            source_page=requirement.source_page, source_paragraph=requirement.source_paragraph,
            review_status="pending",
        ))
    db.add_all(created)
    case.status = TenderCaseStatus.REVIEW_REQUIRED
    db.commit()
    return {"created": len(created), "requirements": [_requirement_payload(item) for item in created]}


@router.get("/tender-cases/{case_id}/requirements")
def list_case_requirements(
    case_id: uuid.UUID, review_status: str | None = None,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    _case_or_404(db, case_id, current_user)
    query = db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.tenant_id == current_user.tenant_id,
        ExtractedRequirementRecord.tender_case_id == case_id,
    )
    if review_status:
        if review_status not in {"pending", "verified", "rejected"}:
            raise HTTPException(status_code=400, detail="Invalid review_status")
        query = query.filter(ExtractedRequirementRecord.review_status == review_status)
    return [_requirement_payload(item) for item in query.order_by(ExtractedRequirementRecord.created_at).all()]


@router.patch("/requirements/{requirement_id}")
def update_requirement(
    requirement_id: uuid.UUID, body: RequirementUpdate,
    current_user: User = Depends(require_reviewer), db: Session = Depends(get_db),
):
    item = db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.id == requirement_id,
        ExtractedRequirementRecord.tenant_id == current_user.tenant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Requirement not found")
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if key == "requirement" and value is not None:
            item.corrected_requirement = value
        elif key == "review_status" and value in {"verified", "rejected"}:
            item.reviewed_by_id = current_user.id
            item.reviewed_at = datetime.now(timezone.utc)
            setattr(item, key, value)
        else:
            setattr(item, key, value)
    db.commit(); db.refresh(item)
    return _requirement_payload(item)


def _workspace_payload(case: TenderCase, sections: list[ProposalSection], issues: list[ProposalIssue]) -> dict:
    return {
        "case_id": str(case.id), "case_name": case.name, "case_status": case.status.value,
        "sections": [{"id": str(s.id), "title": s.title, "content": s.content, "status": s.status, "sort_order": s.sort_order, "updated_at": s.updated_at.isoformat() if s.updated_at else None} for s in sections],
        "issues": [{"id": str(i.id), "title": i.title, "description": i.description, "severity": i.severity, "resolved": i.resolved, "created_at": i.created_at.isoformat() if i.created_at else None} for i in issues],
    }


@router.get("/tender-cases/{case_id}/proposal")
def get_proposal_workspace(
    case_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    case = _case_or_404(db, case_id, current_user)
    sections = db.query(ProposalSection).filter(ProposalSection.tenant_id == current_user.tenant_id, ProposalSection.tender_case_id == case.id).order_by(ProposalSection.sort_order, ProposalSection.title).all()
    if not sections:
        defaults = ["Executive Summary", "Understanding of Requirements", "Technical Approach", "Delivery Plan", "Relevant Experience", "Compliance and Evidence"]
        sections = [ProposalSection(tenant_id=current_user.tenant_id, tender_case_id=case.id, title=title, content="", sort_order=i, created_by_id=current_user.id) for i, title in enumerate(defaults)]
        db.add_all(sections); db.commit()
        for section in sections: db.refresh(section)
    issues = db.query(ProposalIssue).filter(ProposalIssue.tenant_id == current_user.tenant_id, ProposalIssue.tender_case_id == case.id).order_by(ProposalIssue.created_at.desc()).all()
    return _workspace_payload(case, sections, issues)


@router.post("/tender-cases/{case_id}/proposal/sections", status_code=201)
def create_proposal_section(case_id: uuid.UUID, body: ProposalSectionCreate, current_user: User = Depends(require_editor), db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id, current_user)
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Approved/completed proposals are read-only")
    section = ProposalSection(tenant_id=current_user.tenant_id, tender_case_id=case_id, created_by_id=current_user.id, **body.model_dump())
    db.add(section); db.commit(); db.refresh(section)
    return {"id": str(section.id), "title": section.title, "content": section.content, "status": section.status, "sort_order": section.sort_order}


@router.patch("/proposal/sections/{section_id}")
def update_proposal_section(section_id: uuid.UUID, body: ProposalSectionUpdate, current_user: User = Depends(require_editor), db: Session = Depends(get_db)):
    section = db.query(ProposalSection).filter(ProposalSection.id == section_id, ProposalSection.tenant_id == current_user.tenant_id).first()
    if not section: raise HTTPException(status_code=404, detail="Proposal section not found")
    case = _case_or_404(db, section.tender_case_id, current_user)
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Approved/completed proposals are read-only")
    for key, value in body.model_dump(exclude_unset=True).items(): setattr(section, key, value)
    if (body.content is not None and body.content.strip()) or body.status == "complete":
        case.status = TenderCaseStatus.PROPOSAL_DRAFT
    db.commit(); db.refresh(section)
    return {"id": str(section.id), "title": section.title, "content": section.content, "status": section.status, "sort_order": section.sort_order}


@router.post("/tender-cases/{case_id}/proposal/issues", status_code=201)
def create_proposal_issue(case_id: uuid.UUID, body: ProposalIssueCreate, current_user: User = Depends(require_editor), db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id, current_user)
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Approved/completed proposals are read-only")
    issue = ProposalIssue(tenant_id=current_user.tenant_id, tender_case_id=case_id, created_by_id=current_user.id, **body.model_dump())
    if case.status not in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        case.status = TenderCaseStatus.PROPOSAL_DRAFT
    db.add(issue); db.commit(); db.refresh(issue)
    return {"id": str(issue.id), "title": issue.title, "description": issue.description, "severity": issue.severity, "resolved": issue.resolved}


@router.patch("/proposal/issues/{issue_id}")
def update_proposal_issue(issue_id: uuid.UUID, body: ProposalIssueUpdate, current_user: User = Depends(require_editor), db: Session = Depends(get_db)):
    issue = db.query(ProposalIssue).filter(ProposalIssue.id == issue_id, ProposalIssue.tenant_id == current_user.tenant_id).first()
    if not issue: raise HTTPException(status_code=404, detail="Proposal issue not found")
    case = _case_or_404(db, issue.tender_case_id, current_user)
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Approved/completed proposals are read-only")
    for key, value in body.model_dump(exclude_unset=True).items(): setattr(issue, key, value)
    db.commit(); db.refresh(issue)
    return {"id": str(issue.id), "title": issue.title, "description": issue.description, "severity": issue.severity, "resolved": issue.resolved}


@router.post("/tender-cases/{case_id}/proposal/approve")
def approve_proposal(case_id: uuid.UUID, current_user: User = Depends(require_reviewer), db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id, current_user)
    sections = db.query(ProposalSection).filter(ProposalSection.tenant_id == current_user.tenant_id, ProposalSection.tender_case_id == case_id).all()
    issues = db.query(ProposalIssue).filter(ProposalIssue.tenant_id == current_user.tenant_id, ProposalIssue.tender_case_id == case_id, ProposalIssue.resolved.is_(False)).all()
    if not sections or any(not section.content.strip() or section.status != "complete" for section in sections):
        raise HTTPException(status_code=400, detail="Complete every proposal section before approval")
    if issues:
        raise HTTPException(status_code=400, detail="Resolve all open issues before approval")
    case.status = TenderCaseStatus.APPROVED
    db.commit()
    return {"case_id": str(case.id), "status": case.status.value}


@router.get("/tender-cases/{case_id}/proposal/export.docx")
def export_proposal_docx(case_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id, current_user)
    sections = db.query(ProposalSection).filter(ProposalSection.tenant_id == current_user.tenant_id, ProposalSection.tender_case_id == case_id).order_by(ProposalSection.sort_order, ProposalSection.title).all()
    if not sections: raise HTTPException(status_code=404, detail="Proposal workspace has no sections")
    document = DocxDocument()
    document.add_heading(case.name, 0)
    if case.reference: document.add_paragraph(f"Tender reference: {case.reference}")
    if case.submission_deadline: document.add_paragraph(f"Submission deadline: {case.submission_deadline.isoformat()}")
    for section in sections:
        document.add_heading(section.title, level=1)
        for paragraph in (section.content or "[Content pending]").split("\n"):
            document.add_paragraph(paragraph)
    buffer = BytesIO(); document.save(buffer); buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": f'attachment; filename="proposal-{case.id}.docx"'})


@router.get("/tender-cases/{case_id}/proposal/export.xlsx")
def export_compliance_xlsx(case_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id, current_user)
    requirements = db.query(ExtractedRequirementRecord).filter(ExtractedRequirementRecord.tenant_id == current_user.tenant_id, ExtractedRequirementRecord.tender_case_id == case_id).order_by(ExtractedRequirementRecord.created_at).all()
    workbook = Workbook(); sheet = workbook.active; sheet.title = "Compliance Matrix"
    sheet.append(["Tender", case.name]); sheet.append(["Reference", case.reference or ""]); sheet.append([])
    sheet.append(["Requirement", "Category", "Mandatory", "Confidence", "Review Status", "Source Document", "Page", "Paragraph", "Reviewer Note"])
    for item in requirements:
        sheet.append([item.corrected_requirement or item.requirement, item.category, "Yes" if item.mandatory else "No", item.confidence / 100, item.review_status, item.source_document or "", item.source_page or "", item.source_paragraph or "", item.review_note or ""])
    sheet.freeze_panes = "A5"; sheet.auto_filter.ref = sheet.dimensions
    for column in sheet.columns:
        max_len = min(max(len(str(cell.value or "")) for cell in column) + 2, 70)
        sheet.column_dimensions[column[0].column_letter].width = max(14, max_len)
    buffer = BytesIO(); workbook.save(buffer); buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="compliance-{case.id}.xlsx"'})
