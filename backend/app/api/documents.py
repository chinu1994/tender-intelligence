import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_editor
from app.api.tender_cases import get_case_or_404
from app.db.session import get_db
from app.models import Document, DocumentStatus, TenderCaseStatus, User
from app.schemas.documents import DocumentResponse
from app.services.document_storage import (
    clean_display_name,
    delete_directory,
    delete_stored_file,
    get_relative_storage_path,
    resolve_storage_path,
    save_uploaded_file,
)
from app.services.lifecycle import READ_ONLY
from app.tasks.dispatch import can_reprocess, enqueue
from app.tasks.document_processing import process_document


router = APIRouter(
    prefix="/tender-cases",
    tags=["Documents"],
)

MAX_FILES_PER_UPLOAD = 50


def _get_document_or_404(
    db: Session, tender_case_id: uuid.UUID, document_id: uuid.UUID, tenant_id: uuid.UUID
) -> Document:
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tender_case_id == tender_case_id,
            Document.tenant_id == tenant_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def _queue(db: Session, documents: list[Document]) -> None:
    for document in documents:
        error = enqueue(process_document, str(document.id))
        if error:
            db.refresh(document)
            document.status = DocumentStatus.FAILED
            document.processing_error = error[:2000]
            db.commit()


@router.get(
    "/{tender_case_id}/documents",
    response_model=list[DocumentResponse],
)
def list_documents(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All documents of the case with their processing status.

    ZIP uploads appear as a parent record; extracted files reference it via
    ``parent_document_id``. Poll this endpoint to follow processing.
    """
    get_case_or_404(db, tender_case_id, current_user.tenant_id)
    return (
        db.query(Document)
        .filter(
            Document.tender_case_id == tender_case_id,
            Document.tenant_id == current_user.tenant_id,
        )
        .order_by(Document.created_at.desc(), Document.name)
        .all()
    )


@router.get(
    "/{tender_case_id}/documents/{document_id}",
    response_model=DocumentResponse,
)
def get_document(
    tender_case_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_document_or_404(db, tender_case_id, document_id, current_user.tenant_id)


@router.post(
    "/{tender_case_id}/documents",
    response_model=list[DocumentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upload_documents(
    tender_case_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Upload one or more PDF, DOCX, XLSX or ZIP files.

    Files are stored immediately and processed asynchronously; ZIP archives
    are unpacked by the worker into child documents of the same case.
    """
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)

    if tender_case.status in READ_ONLY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Documents cannot be added to an approved or completed case.",
        )
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_FILES_PER_UPLOAD} files can be uploaded at once.",
        )

    created: list[Document] = []
    stored_paths = []
    try:
        for upload_file in files:
            if not upload_file.filename:
                raise ValueError("Uploaded file must have a filename.")
            stored_path, _ = await save_uploaded_file(
                upload_file=upload_file,
                tenant_id=current_user.tenant_id,
                tender_case_id=tender_case.id,
            )
            stored_paths.append(stored_path)
            document = Document(
                tenant_id=current_user.tenant_id,
                tender_case_id=tender_case.id,
                name=clean_display_name(upload_file.filename),
                file_path=get_relative_storage_path(stored_path),
                file_type=stored_path.suffix.lower().lstrip("."),
                status=DocumentStatus.PENDING,
            )
            db.add(document)
            created.append(document)

        if tender_case.status == TenderCaseStatus.NEW:
            tender_case.status = TenderCaseStatus.ANALYSIS
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

    for document in created:
        db.refresh(document)
    _queue(db, created)
    for document in created:
        db.refresh(document)
    return created


@router.post(
    "/{tender_case_id}/documents/{document_id}/reprocess",
    response_model=DocumentResponse,
)
def reprocess_document(
    tender_case_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Re-queue a document (e.g. after a failure or a worker outage)."""
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    if tender_case.status in READ_ONLY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Documents of an approved or completed case cannot be reprocessed.",
        )
    document = _get_document_or_404(db, tender_case_id, document_id, current_user.tenant_id)

    if document.file_type == "zip":
        children = db.query(Document).filter(
            Document.parent_document_id == document.id,
            Document.tenant_id == current_user.tenant_id,
        ).count()
        if children:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This ZIP archive was already unpacked; reprocess the extracted files instead.",
            )

    if not can_reprocess(document.status.value, document.updated_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The document is queued or being processed. It can be retried once it "
                   "completes or fails (or if it has been stuck for more than 35 minutes).",
        )

    document.status = DocumentStatus.PENDING
    document.processing_error = None
    db.commit()
    _queue(db, [document])
    db.refresh(document)
    return document


@router.delete(
    "/{tender_case_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    tender_case_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Delete a document (and, for a ZIP archive, its extracted files).

    Already extracted requirements keep their textual citation.
    """
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    if tender_case.status in READ_ONLY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Documents of an approved or completed case cannot be deleted.",
        )
    document = _get_document_or_404(db, tender_case_id, document_id, current_user.tenant_id)
    targets = [document] + (
        db.query(Document)
        .filter(Document.parent_document_id == document.id, Document.tenant_id == current_user.tenant_id)
        .all()
    )
    paths = [d.file_path for d in targets]
    is_zip = document.file_type == "zip"
    archive_id = str(document.id)
    for child in targets[1:]:
        db.delete(child)
    db.flush()
    db.delete(document)
    db.commit()
    for path in paths:
        delete_stored_file(path)
    if is_zip:
        try:
            extracted = resolve_storage_path(paths[0]).parent / "extracted" / archive_id
            delete_directory(extracted)
        except ValueError:
            pass
    return None
