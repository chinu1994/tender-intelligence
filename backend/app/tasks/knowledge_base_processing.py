from pathlib import Path
import uuid
import zipfile

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

        if document.file_type == "zip":
            extraction_dir = file_path.parent / "extracted" / str(uuid.uuid4())
            extraction_dir.mkdir(parents=True, exist_ok=True)
            child_documents = []
            allowed = {".pdf", ".docx", ".xlsx"}
            total_uncompressed = 0
            with zipfile.ZipFile(file_path) as archive:
                for member in archive.infolist():
                    if member.is_dir():
                        continue
                    target_name = Path(member.filename)
                    if target_name.is_absolute() or ".." in target_name.parts:
                        raise ValueError("Unsafe path found in uploaded ZIP archive")
                    if target_name.suffix.lower() not in allowed:
                        continue
                    total_uncompressed += member.file_size
                    if member.file_size > 50 * 1024 * 1024 or total_uncompressed > 200 * 1024 * 1024:
                        raise ValueError("ZIP archive exceeds extraction size limits")
                    safe_name = target_name.name
                    if not safe_name:
                        continue
                    child_path = extraction_dir / f"{uuid.uuid4()}_{safe_name}"
                    with archive.open(member) as source, child_path.open("wb") as target:
                        target.write(source.read(50 * 1024 * 1024 + 1))
                    child_documents.append(HistoricalDocument(
                        tenant_id=document.tenant_id,
                        name=safe_name,
                        file_path=str(child_path.relative_to(BASE_STORAGE_DIR)),
                        file_type=target_name.suffix.lower().lstrip("."),
                        source_type=document.source_type,
                        outcome=document.outcome,
                        notes=document.notes,
                        status="pending",
                    ))
            if not child_documents:
                raise ValueError("ZIP archive contains no supported PDF, DOCX, or XLSX files")
            db.add_all(child_documents)
            document.status = "completed"
            document.processing_error = None
            db.commit()
            for child in child_documents:
                db.refresh(child)
                process_historical_document.delay(str(child.id))
            return {"status": "completed", "document_id": str(document.id), "children": len(child_documents)}

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
