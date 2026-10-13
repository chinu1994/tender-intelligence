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
from app.db.session import get_db
from app.models import Document, DocumentStatus, TenderCase, User
from app.schemas.documents import DocumentResponse
from app.services.document_storage import (
    extract_zip,
    get_relative_storage_path,
    save_uploaded_file,
)
from app.tasks.document_processing import process_document


router = APIRouter(
    prefix="/tender-cases",
    tags=["Documents"],
)
@router.get(
    "/{tender_case_id}/documents",
    response_model=list[DocumentResponse],
)
def list_documents(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tender_case = (
        db.query(TenderCase)
        .filter(
            TenderCase.id == tender_case_id,
            TenderCase.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not tender_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender case not found",
        )

    documents = (
        db.query(Document)
        .filter(
            Document.tender_case_id == tender_case_id,
            Document.tenant_id == current_user.tenant_id,
        )
        .order_by(Document.created_at.desc())
        .all()
    )

    return documents


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
    tender_case = (
        db.query(TenderCase)
        .filter(
            TenderCase.id == tender_case_id,
            TenderCase.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not tender_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender case not found",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required",
        )

    created_documents: list[Document] = []

    try:
        for upload_file in files:
            original_name = upload_file.filename or ""

            if not original_name:
                raise ValueError("Uploaded file must have a filename.")

            stored_path, _ = await save_uploaded_file(
                upload_file=upload_file,
                tenant_id=current_user.tenant_id,
                tender_case_id=tender_case.id,
            )

            document = Document(
                tenant_id=current_user.tenant_id,
                tender_case_id=tender_case.id,
                name=original_name,
                file_path=get_relative_storage_path(stored_path),
                file_type=stored_path.suffix.lower().lstrip("."),
                status=DocumentStatus.PENDING,
            )

            db.add(document)
            created_documents.append(document)

            if stored_path.suffix.lower() == ".zip":
                extracted_files = extract_zip(
                    zip_path=stored_path,
                    tenant_id=current_user.tenant_id,
                    tender_case_id=tender_case.id,
                )

                for child_name, child_path in extracted_files:
                    child_document = Document(
                        tenant_id=current_user.tenant_id,
                        tender_case_id=tender_case.id,
                        name=child_name,
                        file_path= get_relative_storage_path(child_path),
                        file_type=child_path.suffix.lower().lstrip("."),
                        status=DocumentStatus.PENDING,
                    )

                    db.add(child_document)
                    created_documents.append(child_document)

        db.commit()
        for document in created_documents:
            db.refresh(document)

            # ZIP parent itself is not text-extracted; children are queued.
            if document.file_type != "zip":
                try:
                    process_document.delay(str(document.id))
                except Exception as queue_exc:
                    # Redis unreachable — process in-process so upload still completes
                    try:
                        process_document.apply(args=(str(document.id),))
                    except Exception as sync_exc:
                        document.status = DocumentStatus.FAILED
                        document.processing_error = (
                            "Could not queue or run processing. "
                            "Check Redis + Celery worker. "
                            f"queue={queue_exc}; sync={sync_exc}"
                        )[:2000]
                        db.commit()

        return created_documents


    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process uploaded documents: {exc}",
        ) from exc


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
    """Re-queue a pending/failed document for Celery processing."""
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.tender_case_id == tender_case_id,
            Document.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.file_type == "zip":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIP parents are not processed; process extracted children instead.",
        )

    document.status = DocumentStatus.PENDING
    document.processing_error = None
    db.commit()
    db.refresh(document)

    try:
        process_document.delay(str(document.id))
    except Exception as queue_exc:
        document.status = DocumentStatus.FAILED
        document.processing_error = (
            f"Could not queue processing task: {queue_exc}"
        )[:2000]
        db.commit()
        db.refresh(document)

    return document