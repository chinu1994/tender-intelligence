import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin, require_editor
from app.db.session import get_db
from app.models import HistoricalDocument, User
from app.schemas.knowledge_base import (
    ALLOWED_OUTCOMES,
    ALLOWED_SOURCE_TYPES,
    HistoricalDocumentResponse,
    HistoricalDocumentUpdate,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.services.document_storage import (
    clean_display_name,
    delete_directory,
    delete_stored_file,
    get_relative_storage_path,
    knowledge_base_directory,
    save_historical_uploaded_file,
)
from app.services.vector_search import search_historical_chunks
from app.tasks.dispatch import can_reprocess, enqueue
from app.tasks.knowledge_base_processing import process_historical_document


router = APIRouter(
    prefix="/knowledge-base",
    tags=["Knowledge Base"],
)


def _validate_source_type(source_type: str | None) -> None:
    if source_type is not None and source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source_type. Allowed: {', '.join(sorted(ALLOWED_SOURCE_TYPES))}",
        )


def _validate_outcome(outcome: str | None) -> None:
    if outcome is not None and outcome not in ALLOWED_OUTCOMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid outcome. Allowed: {', '.join(sorted(ALLOWED_OUTCOMES))}",
        )


def _get_or_404(db: Session, document_id: uuid.UUID, tenant_id: uuid.UUID) -> HistoricalDocument:
    document = (
        db.query(HistoricalDocument)
        .filter(
            HistoricalDocument.id == document_id,
            HistoricalDocument.tenant_id == tenant_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historical document not found")
    return document


@router.get(
    "/documents",
    response_model=list[HistoricalDocumentResponse],
)
def list_historical_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(HistoricalDocument)
        .filter(HistoricalDocument.tenant_id == current_user.tenant_id)
        .order_by(HistoricalDocument.created_at.desc(), HistoricalDocument.name)
        .all()
    )


@router.get(
    "/documents/{document_id}",
    response_model=HistoricalDocumentResponse,
)
def get_historical_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, document_id, current_user.tenant_id)


@router.post(
    "/documents",
    response_model=list[HistoricalDocumentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upload_historical_documents(
    files: list[UploadFile] = File(...),
    source_type: str = Form(default="past_tender"),
    outcome: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Upload past tenders/bids (PDF, DOCX, XLSX, ZIP) for indexing.

    ``outcome`` records the win/loss/completion status used in search results.
    """
    _validate_source_type(source_type)
    outcome = (outcome or "").strip() or None
    _validate_outcome(outcome)

    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    created: list[HistoricalDocument] = []
    stored_paths = []
    try:
        for upload_file in files:
            if not upload_file.filename:
                raise ValueError("Uploaded file must have a filename.")
            stored_path, _ = await save_historical_uploaded_file(
                upload_file=upload_file,
                tenant_id=current_user.tenant_id,
            )
            stored_paths.append(stored_path)
            document = HistoricalDocument(
                tenant_id=current_user.tenant_id,
                name=clean_display_name(upload_file.filename),
                file_path=get_relative_storage_path(stored_path),
                file_type=stored_path.suffix.lower().lstrip("."),
                source_type=source_type,
                outcome=outcome,
                notes=notes,
                status="pending",
            )
            db.add(document)
            created.append(document)
        db.commit()
    except ValueError as exc:
        db.rollback()
        for path in stored_paths:
            path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        for path in stored_paths:
            path.unlink(missing_ok=True)
        raise

    ids = [str(document.id) for document in created]
    for document_id in ids:
        error = enqueue(process_historical_document, document_id)
        if error:
            document = db.query(HistoricalDocument).filter(HistoricalDocument.id == document_id).first()
            document.status = "failed"
            document.processing_error = error[:2000]
            db.commit()

    for document in created:
        db.refresh(document)
    return created


@router.patch(
    "/documents/{document_id}",
    response_model=HistoricalDocumentResponse,
)
def update_historical_document(
    document_id: uuid.UUID,
    body: HistoricalDocumentUpdate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Update record type, outcome (won/lost/...) or notes after the fact."""
    document = _get_or_404(db, document_id, current_user.tenant_id)
    changes = body.model_dump(exclude_unset=True)
    if "source_type" in changes:
        if changes["source_type"] is None:
            changes.pop("source_type")
        else:
            _validate_source_type(changes["source_type"])
    if "outcome" in changes:
        changes["outcome"] = (changes["outcome"] or "").strip() or None
        _validate_outcome(changes["outcome"])

    children = (
        db.query(HistoricalDocument)
        .filter(
            HistoricalDocument.parent_document_id == document.id,
            HistoricalDocument.tenant_id == current_user.tenant_id,
        )
        .all()
    )
    for target in [document, *children]:
        for key, value in changes.items():
            setattr(target, key, value)
    db.commit()
    db.refresh(document)
    return document


@router.post(
    "/documents/{document_id}/reprocess",
    response_model=HistoricalDocumentResponse,
)
def reprocess_historical_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    document = _get_or_404(db, document_id, current_user.tenant_id)
    if not can_reprocess(document.status, document.updated_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The document is queued or being processed. It can be retried once it "
                   "completes or fails (or if it has been stuck for more than 35 minutes).",
        )
    if document.file_type == "zip" and db.query(HistoricalDocument).filter(
        HistoricalDocument.parent_document_id == document.id
    ).count():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This ZIP archive was already unpacked; reprocess the extracted files instead.",
        )
    document.status = "pending"
    document.processing_error = None
    db.commit()
    error = enqueue(process_historical_document, str(document.id))
    db.refresh(document)
    if error:
        document.status = "failed"
        document.processing_error = error[:2000]
        db.commit()
        db.refresh(document)
    return document


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_historical_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a historical record, its chunks/vectors and stored files.

    Deleting a ZIP archive also deletes the documents extracted from it.
    """
    document = _get_or_404(db, document_id, current_user.tenant_id)
    children = (
        db.query(HistoricalDocument)
        .filter(
            HistoricalDocument.parent_document_id == document.id,
            HistoricalDocument.tenant_id == current_user.tenant_id,
        )
        .all()
    )
    paths = [d.file_path for d in [document, *children]]
    archive_id = str(document.id)
    tenant_id = document.tenant_id
    for child in children:
        db.delete(child)
    db.flush()
    db.delete(document)
    db.commit()
    for path in paths:
        delete_stored_file(path)
    delete_directory(knowledge_base_directory(tenant_id) / "extracted" / archive_id)
    return None


@router.post(
    "/search",
    response_model=KnowledgeSearchResponse,
)
def search_knowledge_base(
    body: KnowledgeSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tenant-isolated semantic search over indexed historical documents.

    Every hit carries its source reference (document name, page, paragraph/row).
    """
    _validate_source_type(body.source_type)
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query must not be empty")

    results = search_historical_chunks(
        db,
        tenant_id=current_user.tenant_id,
        query=query,
        limit=body.limit,
        source_type=body.source_type,
    )
    return KnowledgeSearchResponse(query=query, results=results)
