from pathlib import Path
from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import (
    Document,
    DocumentChunk,
    DocumentStatus,
    ExtractedRequirementRecord,
    TenderCase,
    TenderCaseStatus,
)
from app.services.document_chunking import create_chunks
from app.services.document_extractor import extract_document
from app.services.document_storage import BASE_STORAGE_DIR
from app.worker import celery_app
from app.ai.service import AIService
from app.ai.schemas import DocumentChunk as AIChunk, EmbeddingRequest, ExtractionRequest


@celery_app.task(name="process_document")
def process_document(document_id: str):
    db: Session = SessionLocal()

    try:
        document = (
            db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )

        if not document:
            return {
                "status": "failed",
                "error": "Document not found",
            }

        document.status = DocumentStatus.PROCESSING
        document.processing_error = None
        db.commit()

        file_path = BASE_STORAGE_DIR / document.file_path

        if not file_path.exists():
            raise FileNotFoundError(
                f"Document file not found: {document.file_path}"
            )

        sections = extract_document(
            file_path=file_path,
            file_type=document.file_type,
        )

        chunks = create_chunks(sections)
        ai_service = AIService()

        embedding_result = ai_service.generate_embeddings(
            EmbeddingRequest(
                texts=[chunk["text"] for chunk in chunks]
            )
        )

        if len(embedding_result.embeddings) != len(chunks):
            raise ValueError(
                "Embedding provider returned a different number of vectors."
            )

        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document.id
        ).delete(
            synchronize_session=False
        )

        for index, chunk in enumerate(chunks):
            db.add(
                DocumentChunk(
                    tenant_id=document.tenant_id,
                    document_id=document.id,
                    chunk_index=index,
                    text=chunk["text"],
                    page_number=chunk.get("page_number"),
                    paragraph_number=chunk.get("paragraph_number"),
                    embedding=embedding_result.embeddings[index],
                )
            )

        document.status = DocumentStatus.COMPLETED
        document.processing_error = None
        db.commit()

        # --- Automatic flow: when all docs of the case are done → extract + move status ---
        _maybe_auto_extract(db, document)

        return {
            "status": "completed",
            "document_id": str(document.id),
            "chunks": len(chunks),
        }

    except Exception as exc:
        db.rollback()

        document = (
            db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )

        if document:
            document.status = DocumentStatus.FAILED
            document.processing_error = str(exc)[:2000]
            db.commit()

        raise

    finally:
        db.close()


def _maybe_auto_extract(db: Session, document: Document) -> None:
    """If every document belonging to the tender case is completed, run extraction
    and advance the case lifecycle to review_required."""
    case_id = document.tender_case_id
    if not case_id:
        return

    case = db.query(TenderCase).filter(TenderCase.id == case_id).first()
    if not case:
        return
    if case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        return

    pending = (
        db.query(Document)
        .filter(
            Document.tender_case_id == case_id,
            Document.status.in_([DocumentStatus.PENDING, DocumentStatus.PROCESSING]),
        )
        .count()
    )
    if pending > 0:
        # still waiting for other files
        if case.status == TenderCaseStatus.NEW:
            case.status = TenderCaseStatus.ANALYSIS
            db.commit()
        return

    completed = (
        db.query(Document)
        .filter(
            Document.tender_case_id == case_id,
            Document.status == DocumentStatus.COMPLETED,
        )
        .count()
    )
    if completed == 0:
        return

    # All documents processed → run structured extraction
    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            DocumentChunk.tenant_id == document.tenant_id,
            Document.tenant_id == document.tenant_id,
            Document.tender_case_id == case_id,
            Document.status == DocumentStatus.COMPLETED,
        )
        .order_by(Document.created_at, DocumentChunk.chunk_index)
        .all()
    )
    if not rows:
        return

    ai_chunks = [
        AIChunk(
            chunk_id=str(chunk.id),
            document_id=str(doc.id),
            document_name=doc.name,
            text=chunk.text,
            page_number=chunk.page_number,
            paragraph_number=chunk.paragraph_number,
        )
        for chunk, doc in rows
    ]

    try:
        result = AIService().extract_requirements(ExtractionRequest(chunks=ai_chunks))
    except Exception as exc:
        # Do not fail the document task; leave case in analysis
        case.status = TenderCaseStatus.ANALYSIS
        db.commit()
        return

    source_by_chunk = {str(chunk.id): (chunk, doc) for chunk, doc in rows}

    # Replace only unreviewed extractions
    db.query(ExtractedRequirementRecord).filter(
        ExtractedRequirementRecord.tenant_id == document.tenant_id,
        ExtractedRequirementRecord.tender_case_id == case_id,
        ExtractedRequirementRecord.review_status == "pending",
    ).delete(synchronize_session=False)

    for req in result.requirements:
        source = source_by_chunk.get(req.source_chunk_id or "")
        chunk, doc = source if source else (None, None)
        db.add(
            ExtractedRequirementRecord(
                id=uuid.uuid4(),
                tenant_id=document.tenant_id,
                tender_case_id=case_id,
                document_id=doc.id if doc else None,
                requirement=req.requirement,
                category=req.category,
                mandatory=req.mandatory,
                confidence=int(round((req.confidence or 0) * 100)),
                deadline_value=req.deadline_value,
                lot_bundle=req.lot_bundle,
                evaluation_criteria=req.evaluation_criteria,
                required_evidence=req.required_evidence or [],
                source_page=req.source_page,
                source_paragraph=req.source_paragraph,
                review_status="pending",
            )
        )

    case.status = TenderCaseStatus.REVIEW_REQUIRED
    db.commit()