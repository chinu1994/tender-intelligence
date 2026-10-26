"""Structured requirement extraction for a tender case (shared by API + worker)."""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.ai.schemas import DocumentChunk as AIChunk
from app.ai.schemas import (
    ExtractedDeadline,
    ExtractedDocumentReference,
    ExtractedEvaluationCriterion,
    ExtractedEvidence,
    ExtractedLot,
    ExtractedMandatoryRequirement,
    ExtractionRequest,
    StructuredTenderExtraction,
)
from app.ai.mocks import find_weights
from app.ai.service import AIService
from app.core.constants import REQUIREMENT_CATEGORIES
from app.models import (
    Document,
    DocumentChunk,
    DocumentStatus,
    ExtractedRequirementRecord,
    TenderCase,
    TenderCaseStatus,
)

_CATEGORY_ALIASES = {
    "deadlines": "deadline",
    "date": "deadline",
    "dates": "deadline",
    "lot": "lots",
    "bundle": "lots",
    "bundles": "lots",
    "requirements": "mandatory",
    "requirement": "mandatory",
    "evaluation_criteria": "evaluation",
    "criteria": "evaluation",
    "required_evidence": "evidence",
    "document_references": "document_reference",
    "reference": "document_reference",
}

READ_ONLY_STATUSES = {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}


class NoProcessedDocuments(Exception):
    pass


class CaseReadOnly(Exception):
    pass


def lock_case(db: Session, case_id: uuid.UUID) -> None:
    """Public alias used by the approval endpoint to serialise with extraction."""
    _lock_case(db, case_id)


def lock_case_row(db: Session, case: TenderCase) -> None:
    """SELECT ... FOR UPDATE the case row and refresh its status in memory."""
    case.status = (
        db.query(TenderCase.status).filter(TenderCase.id == case.id).with_for_update().scalar()
    )


def normalize_category(value: str | None) -> str:
    category = (value or "general").strip().lower().replace(" ", "_")
    category = _CATEGORY_ALIASES.get(category, category)
    return category if category in REQUIREMENT_CATEGORIES else "general"


def _review_key(document: str | None, page: int | None, paragraph: int | None, requirement: str) -> tuple:
    return (document or "", page, paragraph, " ".join(requirement.split()).lower())


def _lock_case(db: Session, case_id: uuid.UUID) -> None:
    """Serialise concurrent extractions of the same case (transaction-scoped)."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"extract:{case_id}"})


def run_case_extraction(db: Session, case: TenderCase) -> list[ExtractedRequirementRecord]:
    """Extract requirements from all completed documents of ``case``.

    Re-running replaces previous *pending* output but preserves every item a
    reviewer already verified or rejected (and does not duplicate them).
    Moves the case to ``review_required``. Caller commits.
    """
    _lock_case(db, case.id)
    # Re-read under the lock: the case may have been approved meanwhile.
    lock_case_row(db, case)
    if case.status in READ_ONLY_STATUSES:
        raise CaseReadOnly("Approved/completed cases cannot be re-extracted.")
    tenant_id = case.tenant_id
    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            DocumentChunk.tenant_id == tenant_id,
            Document.tenant_id == tenant_id,
            Document.tender_case_id == case.id,
            Document.status == DocumentStatus.COMPLETED,
        )
        .order_by(Document.created_at, Document.name, DocumentChunk.chunk_index)
        .all()
    )
    if not rows:
        raise NoProcessedDocuments(
            "No processed documents found. Upload documents and wait until processing is completed."
        )

    ai_chunks = [
        AIChunk(
            chunk_id=str(chunk.id),
            document_id=str(document.id),
            document_name=document.name,
            text=chunk.text,
            page_number=chunk.page_number,
            paragraph_number=chunk.paragraph_number,
        )
        for chunk, document in rows
    ]
    result = AIService(db).extract_requirements(ExtractionRequest(chunks=ai_chunks))
    source_by_chunk = {str(chunk.id): (chunk, document) for chunk, document in rows}

    # Only untouched machine output is replaced. Reviewed, manually added and
    # human-edited items survive and suppress duplicates of themselves.
    replaceable = (
        (ExtractedRequirementRecord.review_status == "pending")
        & (ExtractedRequirementRecord.origin == "extracted")
        & ExtractedRequirementRecord.edited_at.is_(None)
    )
    reviewed_keys = {
        _review_key(r.source_document, r.source_page, r.source_paragraph, r.requirement)
        for r in db.query(ExtractedRequirementRecord).filter(
            ExtractedRequirementRecord.tenant_id == tenant_id,
            ExtractedRequirementRecord.tender_case_id == case.id,
            ~replaceable,
        )
    }

    db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.tenant_id == tenant_id,
        ExtractedRequirementRecord.tender_case_id == case.id,
        replaceable,
    ).delete(synchronize_session=False)

    created: list[ExtractedRequirementRecord] = []
    for requirement in result.requirements:
        source = source_by_chunk.get(requirement.source_chunk_id or "")
        if source is None:
            continue  # never persist an uncited requirement
        chunk, document = source
        source_document = document.name
        source_page = chunk.page_number
        source_paragraph = chunk.paragraph_number
        if _review_key(source_document, source_page, source_paragraph, requirement.requirement) in reviewed_keys:
            continue
        created.append(
            ExtractedRequirementRecord(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                tender_case_id=case.id,
                document_id=document.id,
                source_chunk_id=chunk.id,
                requirement=requirement.requirement,
                category=normalize_category(requirement.category),
                mandatory=requirement.mandatory,
                deadline_value=(requirement.deadline_value or None) and requirement.deadline_value[:255],
                lot_bundle=(requirement.lot_bundle or None) and requirement.lot_bundle[:255],
                evaluation_criteria=requirement.evaluation_criteria,
                document_reference=(requirement.document_reference or None) and requirement.document_reference[:500],
                required_evidence=list(requirement.required_evidence or []),
                confidence=max(0, min(100, round(requirement.confidence * 100))),
                source_document=source_document,
                source_page=source_page,
                source_paragraph=source_paragraph,
                review_status="pending",
            )
        )
    db.add_all(created)

    if case.status in {TenderCaseStatus.NEW, TenderCaseStatus.ANALYSIS, TenderCaseStatus.REVIEW_REQUIRED}:
        case.status = TenderCaseStatus.REVIEW_REQUIRED
    db.flush()
    return created


def build_structured_extraction(records: list[ExtractedRequirementRecord]) -> StructuredTenderExtraction:
    """Typed, category-grouped view over persisted (non-rejected) requirements."""
    out = StructuredTenderExtraction()
    for r in records:
        if r.review_status == "rejected":
            continue
        text_value = r.corrected_requirement or r.requirement
        cite = dict(
            requirement_id=str(r.id),
            source_document=r.source_document,
            source_page=r.source_page,
            source_paragraph=r.source_paragraph,
            confidence=(r.confidence or 0) / 100.0,
            review_status=r.review_status,
        )
        if r.deadline_value:
            out.deadlines.append(ExtractedDeadline(value=r.deadline_value, description=text_value, **cite))
        if r.lot_bundle:
            out.lots.append(ExtractedLot(name=r.lot_bundle, description=text_value, **cite))
        if r.category == "evaluation" or r.evaluation_criteria:
            out.evaluation_criteria.append(
                ExtractedEvaluationCriterion(
                    criterion=r.evaluation_criteria or text_value,
                    weight=find_weights(r.evaluation_criteria or text_value),
                    **cite,
                )
            )
        for evidence in r.required_evidence or []:
            out.required_evidence.append(ExtractedEvidence(evidence=evidence, mandatory=r.mandatory, **cite))
        if r.category == "evidence" and not r.required_evidence:
            out.required_evidence.append(ExtractedEvidence(evidence=text_value, mandatory=r.mandatory, **cite))
        if r.document_reference:
            for reference in [x.strip() for x in r.document_reference.split(";") if x.strip()]:
                out.document_references.append(
                    ExtractedDocumentReference(reference=reference, context=text_value, **cite)
                )
        if r.mandatory:
            out.requirements.append(
                ExtractedMandatoryRequirement(requirement=text_value, category=r.category, **cite)
            )
    return out
