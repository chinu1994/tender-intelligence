from pathlib import Path

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus
from app.services.document_chunking import create_chunks
from app.services.document_extractor import extract_document
from app.services.document_storage import BASE_STORAGE_DIR
from app.worker import celery_app


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
                )
            )

        document.status = DocumentStatus.COMPLETED
        document.processing_error = None

        db.commit()

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
