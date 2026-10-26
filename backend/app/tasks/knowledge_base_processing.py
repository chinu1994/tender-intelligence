"""Background indexing of historical knowledge-base documents."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.ai.schemas import EmbeddingRequest
from app.ai.service import AIService
from app.db.session import SessionLocal
from app.models import DocumentStatus, HistoricalDocument, HistoricalDocumentChunk
from app.processing.parsers import DocumentParseError, original_name, unpack_zip
from app.processing.pipeline import process_single_file, readable_error
from app.services.document_storage import (
    get_relative_storage_path,
    knowledge_base_directory,
    resolve_storage_path,
)
from app.tasks.dispatch import claim, enqueue
from app.worker import celery_app

logger = logging.getLogger(__name__)


def _mark_failed(db: Session, document_id: str, message: str) -> None:
    db.rollback()
    document = db.query(HistoricalDocument).filter(HistoricalDocument.id == document_id).first()
    if document:
        document.status = DocumentStatus.FAILED.value
        document.processing_error = message[:2000]
        db.commit()


@celery_app.task(name="process_historical_document")
def process_historical_document(document_id: str):
    db: Session = SessionLocal()
    try:
        if not claim(db, "historical_documents", document_id):
            return {"status": "skipped", "document_id": document_id}
        document = db.query(HistoricalDocument).filter(HistoricalDocument.id == document_id).first()
        if not document:
            return {"status": "failed", "error": "Historical document not found"}

        if document.file_type == "zip":
            output_dir = knowledge_base_directory(document.tenant_id) / "extracted" / str(document.id)
            members = unpack_zip(resolve_storage_path(document.file_path), output_dir)
            if not members:
                raise DocumentParseError(
                    "The ZIP archive does not contain any supported PDF, DOCX or XLSX files."
                )
            children = [
                HistoricalDocument(
                    id=uuid.uuid4(),
                    tenant_id=document.tenant_id,
                    parent_document_id=document.id,
                    name=original_name(member)[:255],
                    file_path=get_relative_storage_path(member),
                    file_type=member.suffix.lower().lstrip("."),
                    source_type=document.source_type,
                    outcome=document.outcome,
                    notes=document.notes,
                    status=DocumentStatus.PENDING.value,
                )
                for member in members
            ]
            db.add_all(children)
            document.status = DocumentStatus.COMPLETED.value
            db.commit()
            child_ids = [str(child.id) for child in children]
            for child_id in child_ids:
                error = enqueue(process_historical_document, child_id)
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
            return {"status": "failed", "document_id": document_id, "error": result.error}

        embeddings = AIService().generate_embeddings(
            EmbeddingRequest(texts=[chunk.text for chunk in result.chunks])
        ).embeddings

        db.query(HistoricalDocumentChunk).filter(
            HistoricalDocumentChunk.historical_document_id == document.id
        ).delete(synchronize_session=False)
        for index, chunk in enumerate(result.chunks):
            db.add(
                HistoricalDocumentChunk(
                    tenant_id=document.tenant_id,
                    historical_document_id=document.id,
                    chunk_index=index,
                    text=chunk.text,
                    page_number=chunk.page_number,
                    paragraph_number=chunk.paragraph_number,
                    embedding=embeddings[index],
                )
            )
        document.status = DocumentStatus.COMPLETED.value
        document.processing_error = None
        db.commit()
        return {"status": "completed", "document_id": document_id, "chunks": len(result.chunks)}

    except Exception as exc:  # noqa: BLE001
        _mark_failed(db, document_id, readable_error(exc))
        return {"status": "failed", "document_id": document_id}
    finally:
        db.close()
