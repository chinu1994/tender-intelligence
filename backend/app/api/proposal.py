"""Proposal workspace: sections, open issues, drafting, approval and exports."""
from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.ai.errors import AIProviderError
from app.ai.schemas import DraftRequest, DraftRequirement, DraftSnippet
from app.ai.service import AIService
from app.api.dependencies import get_current_user, require_editor, require_reviewer
from app.api.tender_cases import get_case_or_404
from app.db.session import get_db
from app.models import (
    Document,
    DocumentChunk,
    DocumentStatus,
    ExtractedRequirementRecord,
    ProposalIssue,
    ProposalSection,
    TenderCase,
    TenderCaseStatus,
    User,
)
from app.schemas.proposal import (
    ApprovalReadiness,
    ApprovalResponse,
    DraftSectionRequest,
    GeneratedIssues,
    ProposalIssueCreate,
    ProposalIssueResponse,
    ProposalIssueUpdate,
    ProposalSectionCreate,
    ProposalSectionResponse,
    ProposalSectionUpdate,
    ProposalWorkspaceResponse,
    WorkspaceRequirement,
)
from app.services.exporters import (
    ExportBundle,
    ExportIssue,
    ExportPosition,
    ExportRequirement,
    ExportSection,
    build_compliance_xlsx,
    build_proposal_docx,
    parse_position_row,
)
from app.services.extraction import lock_case, lock_case_row
from app.services.lifecycle import READ_ONLY
from app.services.vector_search import search_historical_chunks

router = APIRouter(tags=["Proposal Workspace"])

DEFAULT_SECTIONS = (
    "Executive Summary",
    "Understanding of Requirements",
    "Technical Approach",
    "Delivery Plan",
    "Relevant Experience",
    "Compliance and Evidence",
)

DRAFTABLE_STATUSES = {TenderCaseStatus.NEW, TenderCaseStatus.ANALYSIS, TenderCaseStatus.REVIEW_REQUIRED}


# ---------------------------------------------------------------- helpers
def _ensure_editable(case: TenderCase) -> None:
    if case.status in READ_ONLY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved/completed proposals are read-only",
        )


def _mark_drafting(case: TenderCase) -> None:
    if case.status in DRAFTABLE_STATUSES:
        case.status = TenderCaseStatus.PROPOSAL_DRAFT


def _section_payload(s: ProposalSection) -> ProposalSectionResponse:
    return ProposalSectionResponse(
        id=s.id, title=s.title, content=s.content or "", status=s.status,
        sort_order=s.sort_order, updated_at=s.updated_at,
    )


def _issue_payload(i: ProposalIssue) -> ProposalIssueResponse:
    return ProposalIssueResponse(
        id=i.id, title=i.title, description=i.description, severity=i.severity,
        resolved=i.resolved, created_at=i.created_at,
    )


def _sections(db: Session, case: TenderCase) -> list[ProposalSection]:
    return (
        db.query(ProposalSection)
        .filter(ProposalSection.tenant_id == case.tenant_id, ProposalSection.tender_case_id == case.id)
        .order_by(ProposalSection.sort_order, ProposalSection.title)
        .all()
    )


def _issues(db: Session, case: TenderCase) -> list[ProposalIssue]:
    return (
        db.query(ProposalIssue)
        .filter(ProposalIssue.tenant_id == case.tenant_id, ProposalIssue.tender_case_id == case.id)
        .order_by(ProposalIssue.resolved, ProposalIssue.created_at.desc())
        .all()
    )


def _requirements(db: Session, case: TenderCase, include_rejected: bool = False) -> list[ExtractedRequirementRecord]:
    query = db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.tenant_id == case.tenant_id,
        ExtractedRequirementRecord.tender_case_id == case.id,
    )
    if not include_rejected:
        query = query.filter(ExtractedRequirementRecord.review_status != "rejected")
    return query.order_by(
        ExtractedRequirementRecord.source_document,
        ExtractedRequirementRecord.source_page,
        ExtractedRequirementRecord.source_paragraph,
        ExtractedRequirementRecord.created_at,
    ).all()


def approval_blockers(db: Session, case: TenderCase) -> list[str]:
    blockers: list[str] = []
    if case.status in READ_ONLY:
        blockers.append(f"The case is already {case.status.value}.")
    sections = _sections(db, case)
    if not sections:
        blockers.append("The proposal has no sections.")
    incomplete = [s.title for s in sections if not (s.content or "").strip() or s.status != "complete"]
    if incomplete:
        blockers.append("Complete every proposal section before approval: " + ", ".join(incomplete))
    open_issues = [i for i in _issues(db, case) if not i.resolved]
    if open_issues:
        blockers.append(f"Resolve all open issues before approval ({len(open_issues)} open).")
    pending = (
        db.query(ExtractedRequirementRecord)
        .filter(
            ExtractedRequirementRecord.tenant_id == case.tenant_id,
            ExtractedRequirementRecord.tender_case_id == case.id,
            ExtractedRequirementRecord.review_status == "pending",
        )
        .count()
    )
    if pending:
        blockers.append(f"Review all extracted requirements before approval ({pending} pending).")
    documents = (
        db.query(Document.status)
        .filter(
            Document.tenant_id == case.tenant_id,
            Document.tender_case_id == case.id,
            Document.file_type != "zip",
        )
        .all()
    )
    in_flight = sum(1 for (s,) in documents if s in (DocumentStatus.PENDING, DocumentStatus.PROCESSING))
    failed = sum(1 for (s,) in documents if s == DocumentStatus.FAILED)
    if in_flight:
        blockers.append(f"Wait until all documents are processed ({in_flight} still in progress).")
    if failed:
        blockers.append(f"Retry or delete documents that failed processing ({failed} failed).")
    return blockers


def _section_or_404(db: Session, section_id: uuid.UUID, user: User) -> ProposalSection:
    section = db.query(ProposalSection).filter(
        ProposalSection.id == section_id, ProposalSection.tenant_id == user.tenant_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Proposal section not found")
    return section


def _issue_or_404(db: Session, issue_id: uuid.UUID, user: User) -> ProposalIssue:
    issue = db.query(ProposalIssue).filter(
        ProposalIssue.id == issue_id, ProposalIssue.tenant_id == user.tenant_id
    ).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Proposal issue not found")
    return issue


def _citation(r: ExtractedRequirementRecord) -> str | None:
    if not r.source_document:
        return None
    parts = [r.source_document]
    if r.source_page:
        parts.append(f"p. {r.source_page}")
    if r.source_paragraph:
        parts.append(f"para. {r.source_paragraph}")
    return ", ".join(parts)


# -------------------------------------------------------------- workspace
@router.get("/tender-cases/{case_id}/proposal", response_model=ProposalWorkspaceResponse)
def get_proposal_workspace(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sections, open-issue checklist, extracted requirements and approval
    readiness in one payload. Creates default sections on first access."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    sections = _sections(db, case)
    if not sections and case.status not in READ_ONLY:
        sections = [
            ProposalSection(
                tenant_id=current_user.tenant_id, tender_case_id=case.id, title=title,
                content="", sort_order=index, created_by_id=current_user.id,
            )
            for index, title in enumerate(DEFAULT_SECTIONS)
        ]
        db.add_all(sections)
        db.commit()
        sections = _sections(db, case)
    blockers = approval_blockers(db, case)
    return ProposalWorkspaceResponse(
        case_id=case.id,
        case_name=case.name,
        case_reference=case.reference,
        case_status=case.status.value,
        submission_deadline=case.submission_deadline.isoformat() if case.submission_deadline else None,
        sections=[_section_payload(s) for s in sections],
        issues=[_issue_payload(i) for i in _issues(db, case)],
        requirements=[
            WorkspaceRequirement(
                id=r.id, requirement=r.corrected_requirement or r.requirement, category=r.category,
                mandatory=r.mandatory, review_status=r.review_status, confidence=(r.confidence or 0) / 100,
                source_document=r.source_document, source_page=r.source_page,
                source_paragraph=r.source_paragraph,
            )
            for r in _requirements(db, case)
        ],
        approval=ApprovalReadiness(ready=not blockers, blockers=blockers),
    )


# --------------------------------------------------------------- sections
@router.post(
    "/tender-cases/{case_id}/proposal/sections",
    response_model=ProposalSectionResponse,
    status_code=201,
)
def create_proposal_section(
    case_id: uuid.UUID,
    body: ProposalSectionCreate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    _ensure_editable(case)
    section = ProposalSection(
        tenant_id=current_user.tenant_id, tender_case_id=case.id,
        created_by_id=current_user.id, **body.model_dump(),
    )
    db.add(section)
    _mark_drafting(case)
    db.commit()
    db.refresh(section)
    return _section_payload(section)


@router.patch("/proposal/sections/{section_id}", response_model=ProposalSectionResponse)
def update_proposal_section(
    section_id: uuid.UUID,
    body: ProposalSectionUpdate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    section = _section_or_404(db, section_id, current_user)
    case = get_case_or_404(db, section.tender_case_id, current_user.tenant_id)
    _ensure_editable(case)
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is not None:
            setattr(section, key, value)
    if section.status == "complete" and not (section.content or "").strip():
        raise HTTPException(status_code=400, detail="A section without content cannot be marked complete")
    content = changes.get("content")
    if (isinstance(content, str) and content.strip()) or changes.get("status") == "complete":
        _mark_drafting(case)
    db.commit()
    db.refresh(section)
    return _section_payload(section)


@router.delete("/proposal/sections/{section_id}", status_code=204)
def delete_proposal_section(
    section_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    section = _section_or_404(db, section_id, current_user)
    case = get_case_or_404(db, section.tender_case_id, current_user.tenant_id)
    _ensure_editable(case)
    db.delete(section)
    db.commit()
    return Response(status_code=204)


@router.post("/proposal/sections/{section_id}/draft", response_model=ProposalSectionResponse)
def draft_proposal_section(
    section_id: uuid.UUID,
    body: DraftSectionRequest | None = None,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Generate draft text for a section from extracted requirements and
    matched historical snippets (via the provider-agnostic LLM interface).
    The section stays in ``draft`` status for human editing."""
    body = body or DraftSectionRequest()
    section = _section_or_404(db, section_id, current_user)
    case = get_case_or_404(db, section.tender_case_id, current_user.tenant_id)
    _ensure_editable(case)

    requirements = _requirements(db, case)
    if body.requirement_ids:
        wanted = set(body.requirement_ids)
        requirements = [r for r in requirements if r.id in wanted]
    else:
        requirements = [r for r in requirements if r.mandatory] or requirements
    requirements = requirements[:25]

    snippets: list[DraftSnippet] = []
    if body.include_matches:
        seen: set[str] = set()
        for r in requirements[:5]:
            for hit in search_historical_chunks(
                db, tenant_id=current_user.tenant_id,
                query=r.corrected_requirement or r.requirement, limit=2, min_score=0.15,
            ):
                if hit.chunk_id in seen:
                    continue
                seen.add(hit.chunk_id)
                snippets.append(DraftSnippet(
                    text=hit.text, document_name=hit.document_name, page_number=hit.page_number,
                    paragraph_number=hit.paragraph_number, outcome=hit.outcome,
                ))
    try:
        result = AIService(db).draft_section(DraftRequest(
            case_name=case.name,
            section_title=section.title,
            requirements=[
                DraftRequirement(
                    requirement=r.corrected_requirement or r.requirement, category=r.category,
                    mandatory=r.mandatory, source=_citation(r),
                )
                for r in requirements
            ],
            snippets=snippets,
            existing_content="" if body.replace else (section.content or ""),
        ))
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=f"Draft generation failed: {exc}") from exc

    section.content = result.content
    section.status = "draft"
    _mark_drafting(case)
    db.commit()
    db.refresh(section)
    return _section_payload(section)


# ----------------------------------------------------------------- issues
@router.post(
    "/tender-cases/{case_id}/proposal/issues",
    response_model=ProposalIssueResponse,
    status_code=201,
)
def create_proposal_issue(
    case_id: uuid.UUID,
    body: ProposalIssueCreate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    _ensure_editable(case)
    issue = ProposalIssue(
        tenant_id=current_user.tenant_id, tender_case_id=case.id,
        created_by_id=current_user.id, **body.model_dump(),
    )
    db.add(issue)
    _mark_drafting(case)
    db.commit()
    db.refresh(issue)
    return _issue_payload(issue)


@router.post(
    "/tender-cases/{case_id}/proposal/issues/generate",
    response_model=GeneratedIssues,
)
def generate_proposal_issues(
    case_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Build the open-issue checklist from extracted requirements:
    evidence to collect, deadlines to confirm, and outstanding reviews.
    Existing issues with the same title are not duplicated."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    _ensure_editable(case)
    existing = {i.title for i in _issues(db, case)}
    candidates: list[tuple[str, str | None, str]] = []
    requirements = _requirements(db, case)
    for r in requirements:
        text = r.corrected_requirement or r.requirement
        if r.category == "evidence" or r.required_evidence:
            candidates.append((
                f"Provide evidence: {text[:180]}",
                f"Source: {_citation(r) or 'n/a'}",
                "high" if r.mandatory else "medium",
            ))
        if r.deadline_value:
            candidates.append((
                f"Confirm deadline: {r.deadline_value}",
                f"{text[:400]} (Source: {_citation(r) or 'n/a'})",
                "medium",
            ))
    pending = sum(1 for r in requirements if r.review_status == "pending")
    if pending:
        candidates.append((
            "Complete review of extracted requirements",
            f"{pending} requirement(s) are still pending reviewer verification.",
            "high",
        ))

    created: list[ProposalIssue] = []
    for title, description, severity in candidates:
        title = re.sub(r"\s+", " ", title).strip()[:500]
        if title in existing:
            continue
        existing.add(title)
        issue = ProposalIssue(
            tenant_id=current_user.tenant_id, tender_case_id=case.id, created_by_id=current_user.id,
            title=title, description=description, severity=severity,
        )
        db.add(issue)
        created.append(issue)
    if created:
        _mark_drafting(case)
    db.commit()
    for issue in created:
        db.refresh(issue)
    return GeneratedIssues(created=len(created), issues=[_issue_payload(i) for i in created])


@router.patch("/proposal/issues/{issue_id}", response_model=ProposalIssueResponse)
def update_proposal_issue(
    issue_id: uuid.UUID,
    body: ProposalIssueUpdate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    issue = _issue_or_404(db, issue_id, current_user)
    case = get_case_or_404(db, issue.tender_case_id, current_user.tenant_id)
    _ensure_editable(case)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(issue, key, value)
    db.commit()
    db.refresh(issue)
    return _issue_payload(issue)


@router.delete("/proposal/issues/{issue_id}", status_code=204)
def delete_proposal_issue(
    issue_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    issue = _issue_or_404(db, issue_id, current_user)
    case = get_case_or_404(db, issue.tender_case_id, current_user.tenant_id)
    _ensure_editable(case)
    db.delete(issue)
    db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------- approval
@router.post("/tender-cases/{case_id}/proposal/approve", response_model=ApprovalResponse)
def approve_proposal(
    case_id: uuid.UUID,
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db),
):
    """Approver sign-off. Requires every section complete, all issues
    resolved and every extracted requirement reviewed."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    # Serialise with a concurrently running extraction of the same case.
    lock_case(db, case.id)
    lock_case_row(db, case)
    blockers = approval_blockers(db, case)
    if blockers:
        raise HTTPException(status_code=400, detail=" ".join(blockers))
    case.status = TenderCaseStatus.APPROVED
    db.commit()
    return ApprovalResponse(case_id=case.id, status=case.status.value)


# ---------------------------------------------------------------- exports
_POSITION_HINTS = ("position", "price", "pricing", "boq", "bill of quantities", "quantit", "schedule", "item", "lv")


def _positions(db: Session, case: TenderCase) -> list[ExportPosition]:
    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            Document.tenant_id == case.tenant_id,
            DocumentChunk.tenant_id == case.tenant_id,
            Document.tender_case_id == case.id,
            Document.file_type == "xlsx",
            Document.status == DocumentStatus.COMPLETED,
        )
        .order_by(Document.name, DocumentChunk.chunk_index)
        .all()
    )
    parsed = []
    for chunk, document in rows:
        sheet, cells = parse_position_row(chunk.text)
        parsed.append(ExportPosition(document=document.name, sheet=sheet, row=chunk.paragraph_number, cells=cells))

    def looks_like_positions(p: ExportPosition) -> bool:
        haystack = f"{p.document} {p.sheet}".lower()
        return any(hint in haystack for hint in _POSITION_HINTS)

    preferred = [p for p in parsed if looks_like_positions(p)]
    return preferred or parsed


def _bundle(db: Session, case: TenderCase, user: User) -> ExportBundle:
    return ExportBundle(
        case_name=case.name,
        reference=case.reference,
        submission_deadline=case.submission_deadline,
        status=case.status.value,
        organization=user.tenant.name if user.tenant else "",
        sections=[ExportSection(s.title, s.content or "", s.status) for s in _sections(db, case)],
        requirements=[
            ExportRequirement(
                id=str(r.id), requirement=r.corrected_requirement or r.requirement, category=r.category,
                mandatory=r.mandatory, confidence=(r.confidence or 0) / 100, review_status=r.review_status,
                deadline_value=r.deadline_value, lot_bundle=r.lot_bundle,
                evaluation_criteria=r.evaluation_criteria, document_reference=r.document_reference,
                required_evidence=list(r.required_evidence or []), source_document=r.source_document,
                source_page=r.source_page, source_paragraph=r.source_paragraph, review_note=r.review_note,
            )
            for r in _requirements(db, case, include_rejected=True)
        ],
        issues=[ExportIssue(i.title, i.description, i.severity, i.resolved) for i in _issues(db, case)],
        positions=_positions(db, case),
    )


def _filename(case: TenderCase, kind: str, extension: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", case.reference or str(case.id)).strip("-") or "case"
    return f"{base}-{kind}.{extension}"


@router.get("/tender-cases/{case_id}/proposal/export.docx")
def export_proposal_docx(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Formatted proposal (cover page, contents, sections, compliance appendix)."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    bundle = _bundle(db, case, current_user)
    if not bundle.sections:
        raise HTTPException(status_code=404, detail="Proposal workspace has no sections")
    content = build_proposal_docx(bundle)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_filename(case, "proposal", "docx")}"'},
    )


@router.get("/tender-cases/{case_id}/proposal/export.xlsx")
def export_compliance_xlsx(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Workbook: Summary, Compliance Matrix, Lots, Positions, Deadlines,
    Evidence and Open Issues."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    content = build_compliance_xlsx(_bundle(db, case, current_user))
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{_filename(case, "compliance", "xlsx")}"'},
    )
