from pathlib import Path

from sqlalchemy.orm import Session

from app.ai.schemas import EmbeddingRequest
from app.ai.service import AIService
from app.db.session import SessionLocal
from app.models import (
    DocumentStatus,
    HistoricalDocument,
    HistoricalDocumentChunk,
)
from app.services.document_chunking import create_chunks
from app.services.document_extractor import extract_document
from app.services.document_storage import BASE_STORAGE_DIR
from app.worker import celery_app


@celery_app.task(name="process_historical_document")
def process_historical_document(document_id: str):
    db: Session = SessionLocal()

    try:
        document = (
            db.query(HistoricalDocument)
            .filter(HistoricalDocument.id == document_id)
            .first()
        )

        if not document:
            return {
                "status": "failed",
                "error": "Historical document not found",
            }

        document.status = DocumentStatus.PROCESSING.value
        document.processing_error = None
        db.commit()

        file_path = BASE_STORAGE_DIR / document.file_path

        if not file_path.exists():
            raise FileNotFoundError(
                f"Historical document file not found: {document.file_path}"
            )

        sections = extract_document(
            file_path=file_path,
            file_type=document.file_type,
        )
        chunks = create_chunks(sections)

        ai_service = AIService()
        embeddings = ai_service.generate_embeddings(
            EmbeddingRequest(
                texts=[chunk["text"] for chunk in chunks]
            )
        ).embeddings

        if len(embeddings) != len(chunks):
            raise ValueError(
                "Embedding provider returned a different number of vectors."
            )

        db.query(HistoricalDocumentChunk).filter(
            HistoricalDocumentChunk.historical_document_id == document.id
        ).delete(synchronize_session=False)

        for index, chunk in enumerate(chunks):
            db.add(
                HistoricalDocumentChunk(
                    tenant_id=document.tenant_id,
                    historical_document_id=document.id,
                    chunk_index=index,
                    text=chunk["text"],
                    page_number=chunk.get("page_number"),
                    paragraph_number=chunk.get("paragraph_number"),
                    embedding=embeddings[index],
                )
            )

        document.status = DocumentStatus.COMPLETED.value
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
            db.query(HistoricalDocument)
            .filter(HistoricalDocument.id == document_id)
            .first()
        )

        if document:
            document.status = DocumentStatus.FAILED.value
            document.processing_error = str(exc)[:2000]
            db.commit()

        raise

    finally:
        db.close()
