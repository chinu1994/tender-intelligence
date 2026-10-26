"""Structured extraction, review & correction APIs."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.ai.schemas import StructuredTenderExtraction
from app.api.dependencies import get_current_user, require_editor, require_reviewer
from app.api.tender_cases import get_case_or_404
from app.core.constants import REQUIREMENT_CATEGORIES, REVIEW_STATUSES
from app.db.session import get_db
from app.models import (
    Document,
    DocumentChunk,
    ExtractedRequirementRecord,
    User,
    UserRole,
)
from app.schemas.proposal import RequirementMatches, SnippetMatch
from app.schemas.requirements import (
    ExtractionRunResponse,
    RequirementCreate,
    RequirementResponse,
    RequirementUpdate,
)
from app.services.extraction import (
    CaseReadOnly,
    NoProcessedDocuments,
    build_structured_extraction,
    normalize_category,
    run_case_extraction,
)
from app.services.lifecycle import READ_ONLY
from app.services.vector_search import search_historical_chunks

router = APIRouter(tags=["Extraction & Review"])

LOW_CONFIDENCE = 0.6


def requirement_flags(item: ExtractedRequirementRecord) -> list[str]:
    flags: list[str] = []
    if (item.confidence or 0) < LOW_CONFIDENCE * 100:
        flags.append("low_confidence")
    if not item.source_document:
        flags.append("missing_source")
    elif item.source_page is None and item.source_paragraph is None:
        flags.append("missing_location")
    if item.corrected_requirement:
        flags.append("corrected")
    return flags


def requirement_payload(
    item: ExtractedRequirementRecord, excerpts: dict[uuid.UUID, str] | None = None
) -> RequirementResponse:
    return RequirementResponse(
        id=item.id,
        tender_case_id=item.tender_case_id,
        document_id=item.document_id,
        requirement=item.corrected_requirement or item.requirement,
        original_requirement=item.requirement,
        category=item.category,
        mandatory=item.mandatory,
        confidence=(item.confidence or 0) / 100.0,
        deadline_value=item.deadline_value,
        lot_bundle=item.lot_bundle,
        evaluation_criteria=item.evaluation_criteria,
        document_reference=item.document_reference,
        required_evidence=list(item.required_evidence or []),
        source_document=item.source_document,
        source_page=item.source_page,
        source_paragraph=item.source_paragraph,
        source_excerpt=(excerpts or {}).get(item.source_chunk_id) if item.source_chunk_id else None,
        review_status=item.review_status,
        corrected_requirement=item.corrected_requirement,
        review_note=item.review_note,
        reviewed_by_id=item.reviewed_by_id,
        reviewed_by_email=item.reviewed_by.email if item.reviewed_by else None,
        reviewed_at=item.reviewed_at,
        created_at=item.created_at,
        flags=requirement_flags(item),
    )


def _excerpts(db: Session, tenant_id: uuid.UUID, items: list[ExtractedRequirementRecord]) -> dict[uuid.UUID, str]:
    chunk_ids = [i.source_chunk_id for i in items if i.source_chunk_id]
    if not chunk_ids:
        return {}
    rows = db.query(DocumentChunk.id, DocumentChunk.text).filter(
        DocumentChunk.tenant_id == tenant_id, DocumentChunk.id.in_(chunk_ids)
    )
    return {row.id: row.text for row in rows}


def _get_requirement_or_404(db: Session, requirement_id: uuid.UUID, user: User) -> ExtractedRequirementRecord:
    item = (
        db.query(ExtractedRequirementRecord)
        .options(joinedload(ExtractedRequirementRecord.reviewed_by))
        .filter(
            ExtractedRequirementRecord.id == requirement_id,
            ExtractedRequirementRecord.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")
    return item


@router.post(
    "/tender-cases/{case_id}/extract-requirements",
    response_model=ExtractionRunResponse,
)
def extract_case_requirements(
    case_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """(Re-)run structured extraction over the case's processed documents.

    Runs automatically when document processing finishes; this endpoint lets
    an editor trigger it again. Reviewed items are preserved.
    """
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    if case.status in READ_ONLY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved/completed cases cannot be re-extracted.",
        )
    try:
        created = run_case_extraction(db, case)
    except NoProcessedDocuments as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CaseReadOnly as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    db.commit()
    excerpts = _excerpts(db, current_user.tenant_id, created)
    return ExtractionRunResponse(
        created=len(created),
        requirements=[requirement_payload(item, excerpts) for item in created],
    )


@router.get(
    "/tender-cases/{case_id}/requirements",
    response_model=list[RequirementResponse],
)
def list_case_requirements(
    case_id: uuid.UUID,
    review_status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_case_or_404(db, case_id, current_user.tenant_id)
    query = (
        db.query(ExtractedRequirementRecord)
        .options(joinedload(ExtractedRequirementRecord.reviewed_by))
        .filter(
            ExtractedRequirementRecord.tenant_id == current_user.tenant_id,
            ExtractedRequirementRecord.tender_case_id == case_id,
        )
    )
    if review_status:
        if review_status not in REVIEW_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid review_status")
        query = query.filter(ExtractedRequirementRecord.review_status == review_status)
    if category:
        if category not in REQUIREMENT_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        query = query.filter(ExtractedRequirementRecord.category == category)
    items = query.order_by(
        ExtractedRequirementRecord.source_document,
        ExtractedRequirementRecord.source_page,
        ExtractedRequirementRecord.source_paragraph,
        ExtractedRequirementRecord.created_at,
    ).all()
    excerpts = _excerpts(db, current_user.tenant_id, items)
    return [requirement_payload(item, excerpts) for item in items]


@router.get(
    "/tender-cases/{case_id}/extraction",
    response_model=StructuredTenderExtraction,
)
def get_structured_extraction(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Typed extraction schema: deadlines, lots, mandatory requirements,
    evaluation criteria, required evidence and document references - each
    with its source citation, confidence and review status."""
    get_case_or_404(db, case_id, current_user.tenant_id)
    records = (
        db.query(ExtractedRequirementRecord)
        .filter(
            ExtractedRequirementRecord.tenant_id == current_user.tenant_id,
            ExtractedRequirementRecord.tender_case_id == case_id,
        )
        .order_by(ExtractedRequirementRecord.source_document, ExtractedRequirementRecord.source_page,
                  ExtractedRequirementRecord.source_paragraph)
        .all()
    )
    return build_structured_extraction(records)


@router.post(
    "/tender-cases/{case_id}/requirements",
    response_model=RequirementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_requirement(
    case_id: uuid.UUID,
    body: RequirementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually add a requirement the extraction missed (editor/reviewer/admin)."""
    case = get_case_or_404(db, case_id, current_user.tenant_id)
    if case.status in READ_ONLY:
        raise HTTPException(status_code=409, detail="Approved/completed cases are read-only")
    category = normalize_category(body.category)
    source_name = None
    if body.source_document_id:
        document = db.query(Document).filter(
            Document.id == body.source_document_id,
            Document.tenant_id == current_user.tenant_id,
            Document.tender_case_id == case.id,
        ).first()
        if not document:
            raise HTTPException(status_code=400, detail="source_document_id does not belong to this case")
        source_name = document.name
    is_reviewer = current_user.role in {UserRole.ADMIN, UserRole.REVIEWER}
    item = ExtractedRequirementRecord(
        tenant_id=current_user.tenant_id,
        tender_case_id=case.id,
        document_id=body.source_document_id,
        requirement=body.requirement.strip(),
        category=category,
        mandatory=body.mandatory,
        deadline_value=body.deadline_value,
        lot_bundle=body.lot_bundle,
        evaluation_criteria=body.evaluation_criteria,
        document_reference=body.document_reference,
        required_evidence=body.required_evidence,
        confidence=100,
        source_document=source_name,
        source_page=body.source_page,
        source_paragraph=body.source_paragraph,
        review_status="verified" if is_reviewer else "pending",
        origin="manual",
        edited_at=datetime.now(timezone.utc),
        review_note=body.review_note or "Added manually",
        reviewed_by_id=current_user.id if is_reviewer else None,
        reviewed_at=datetime.now(timezone.utc) if is_reviewer else None,
    )
    db.add(item)
    db.commit()
    item = _get_requirement_or_404(db, item.id, current_user)
    return requirement_payload(item)


@router.patch(
    "/requirements/{requirement_id}",
    response_model=RequirementResponse,
)
def update_requirement(
    requirement_id: uuid.UUID,
    body: RequirementUpdate,
    current_user: User = Depends(require_reviewer),
    db: Session = Depends(get_db),
):
    """Correct extracted fields and/or record a review decision.

    The original extracted text is never overwritten: ``requirement`` (or
    ``corrected_requirement``) is stored as the correction.
    """
    item = _get_requirement_or_404(db, requirement_id, current_user)
    case = get_case_or_404(db, item.tender_case_id, current_user.tenant_id)
    if case.status in READ_ONLY:
        raise HTTPException(status_code=409, detail="Approved/completed cases are read-only")

    changes = body.model_dump(exclude_unset=True)
    correction = changes.pop("requirement", None)
    if "corrected_requirement" in changes:
        correction = changes.pop("corrected_requirement")
        if correction is None:
            item.corrected_requirement = None
    if correction is not None:
        correction = correction.strip()
        item.corrected_requirement = None if correction == item.requirement.strip() else correction

    if "category" in changes:
        value = changes.pop("category")
        if value is not None:
            if normalize_category(value) != value.strip().lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid category. Allowed: {', '.join(REQUIREMENT_CATEGORIES)}",
                )
            item.category = value.strip().lower()

    if "required_evidence" in changes:
        item.required_evidence = [e.strip() for e in (changes.pop("required_evidence") or []) if e.strip()]

    new_status = changes.pop("review_status", None)
    if correction is not None or changes or "required_evidence" in body.model_fields_set or "category" in body.model_fields_set:
        item.edited_at = datetime.now(timezone.utc)
    for key, value in changes.items():
        if key == "mandatory" and value is None:
            continue
        setattr(item, key, value)

    if new_status is not None:
        item.review_status = new_status
        if new_status in {"verified", "rejected"}:
            item.reviewed_by_id = current_user.id
            item.reviewed_at = datetime.now(timezone.utc)
        else:
            item.reviewed_by_id = None
            item.reviewed_at = None
    elif item.review_status != "pending" and (correction is not None or changes):
        # an edited decision is re-attributed to the editor of the change
        item.reviewed_by_id = current_user.id
        item.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    item = _get_requirement_or_404(db, requirement_id, current_user)
    return requirement_payload(item, _excerpts(db, current_user.tenant_id, [item]))


@router.get(
    "/requirements/{requirement_id}/matches",
    response_model=RequirementMatches,
)
def requirement_matches(
    requirement_id: uuid.UUID,
    limit: int = Query(default=5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historical snippets most similar to this requirement (tenant-isolated)."""
    item = _get_requirement_or_404(db, requirement_id, current_user)
    query = item.corrected_requirement or item.requirement
    hits = search_historical_chunks(db, tenant_id=current_user.tenant_id, query=query, limit=limit)
    return RequirementMatches(
        requirement_id=item.id,
        query=query,
        results=[SnippetMatch(**hit.model_dump()) for hit in hits],
    )
