"""Background processing of tender-case documents.

Pipeline per document: (ZIP -> unpack children) | (parse -> chunk -> embed ->
persist chunks). When the last document of a case finishes, structured
extraction runs automatically and the case moves to ``review_required``.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.ai.schemas import EmbeddingRequest
from app.ai.service import AIService
from app.db.session import SessionLocal
from app.models import (
    Document,
    DocumentChunk,
    DocumentStatus,
    TenderCase,
    TenderCaseStatus,
)
from app.processing.parsers import DocumentParseError, original_name, unpack_zip
from app.processing.pipeline import process_single_file, readable_error
from app.services.document_storage import (
    case_directory,
    get_relative_storage_path,
    resolve_storage_path,
)
from app.services.extraction import CaseReadOnly, NoProcessedDocuments, run_case_extraction
from app.tasks.dispatch import claim, enqueue
from app.worker import celery_app

logger = logging.getLogger(__name__)


def _mark_failed(db: Session, document_id: str, message: str) -> None:
    db.rollback()
    document = db.query(Document).filter(Document.id == document_id).first()
    if document:
        document.status = DocumentStatus.FAILED
        document.processing_error = message[:2000]
        db.commit()


def _unpack_archive(db: Session, document: Document) -> list[Document]:
    archive_path = resolve_storage_path(document.file_path)
    output_dir = case_directory(document.tenant_id, document.tender_case_id) / "extracted" / str(document.id)
    members = unpack_zip(archive_path, output_dir)
    if not members:
        raise DocumentParseError(
            "The ZIP archive does not contain any supported PDF, DOCX or XLSX files."
        )
    children = [
        Document(
            id=uuid.uuid4(),
            tenant_id=document.tenant_id,
            tender_case_id=document.tender_case_id,
            parent_document_id=document.id,
            name=original_name(member)[:255],
            file_path=get_relative_storage_path(member),
            file_type=member.suffix.lower().lstrip("."),
            status=DocumentStatus.PENDING,
        )
        for member in members
    ]
    db.add_all(children)
    return children


@celery_app.task(name="process_document")
def process_document(document_id: str):
    db: Session = SessionLocal()
    try:
        if not claim(db, "documents", document_id):
            # Already being processed (duplicate delivery / double reprocess).
            return {"status": "skipped", "document_id": document_id}
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return {"status": "failed", "error": "Document not found"}

        if document.file_type == "zip":
            children = _unpack_archive(db, document)
            document.status = DocumentStatus.COMPLETED
            db.commit()
            child_ids = [str(child.id) for child in children]
            for child_id in child_ids:
                error = enqueue(process_document, child_id)
                if error:
                    _mark_failed(db, child_id, error)
            return {"status": "completed", "document_id": document_id, "children": len(child_ids)}

        result = process_single_file(
            resolve_storage_path(document.file_path),
            document_id=document_id,
            file_name=document.name,
            file_type=document.file_type,
        )
        if result.error:
            _mark_failed(db, document_id, result.error)
            _maybe_auto_extract(db, document_id)
            return {"status": "failed", "document_id": document_id, "error": result.error}

        embeddings = AIService().generate_embeddings(
            EmbeddingRequest(texts=[chunk.text for chunk in result.chunks])
        ).embeddings

        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete(
            synchronize_session=False
        )
        for index, chunk in enumerate(result.chunks):
            db.add(
                DocumentChunk(
                    tenant_id=document.tenant_id,
                    document_id=document.id,
                    chunk_index=index,
                    text=chunk.text,
                    page_number=chunk.page_number,
                    paragraph_number=chunk.paragraph_number,
                    embedding=embeddings[index],
                )
            )
        document.status = DocumentStatus.COMPLETED
        document.processing_error = None
        db.commit()

        _maybe_auto_extract(db, document_id)
        return {"status": "completed", "document_id": document_id, "chunks": len(result.chunks)}

    except Exception as exc:  # noqa: BLE001 - always leave a readable status
        _mark_failed(db, document_id, readable_error(exc))
        return {"status": "failed", "document_id": document_id}
    finally:
        db.close()


def _maybe_auto_extract(db: Session, document_id: str) -> None:
    """Run extraction once every document of the case has finished."""
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return
        case = db.query(TenderCase).filter(TenderCase.id == document.tender_case_id).first()
        if not case or case.status not in {
            TenderCaseStatus.NEW,
            TenderCaseStatus.ANALYSIS,
            TenderCaseStatus.REVIEW_REQUIRED,
            TenderCaseStatus.PROPOSAL_DRAFT,
        }:
            return

        outstanding = (
            db.query(Document)
            .filter(
                Document.tender_case_id == case.id,
                Document.status.in_([DocumentStatus.PENDING, DocumentStatus.PROCESSING]),
            )
            .count()
        )
        if outstanding:
            if case.status == TenderCaseStatus.NEW:
                case.status = TenderCaseStatus.ANALYSIS
                db.commit()
            return

        try:
            run_case_extraction(db, case)
            db.commit()
        except (NoProcessedDocuments, CaseReadOnly):
            db.rollback()
    except Exception:  # noqa: BLE001 - extraction failure must not fail the document
        logger.exception("Automatic extraction failed for document %s", document_id)
        db.rollback()
