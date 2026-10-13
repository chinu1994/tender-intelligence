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
    ALLOWED_SOURCE_TYPES,
    HistoricalDocumentResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.services.document_storage import (
    get_relative_storage_path,
    save_historical_uploaded_file,
)
from app.services.vector_search import search_historical_chunks
from app.tasks.knowledge_base_processing import process_historical_document


router = APIRouter(
    prefix="/knowledge-base",
    tags=["Knowledge Base"],
)


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
        .order_by(HistoricalDocument.created_at.desc())
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
    document = (
        db.query(HistoricalDocument)
        .filter(
            HistoricalDocument.id == document_id,
            HistoricalDocument.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Historical document not found",
        )

    return document


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
    if source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid source_type. Allowed: "
                f"{', '.join(sorted(ALLOWED_SOURCE_TYPES))}"
            ),
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required",
        )

    created: list[HistoricalDocument] = []

    try:
        for upload_file in files:
            original_name = upload_file.filename or ""
            if not original_name:
                raise ValueError("Uploaded file must have a filename.")

            stored_path, _ = await save_historical_uploaded_file(
                upload_file=upload_file,
                tenant_id=current_user.tenant_id,
            )

            document = HistoricalDocument(
                tenant_id=current_user.tenant_id,
                name=original_name,
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

        for document in created:
            db.refresh(document)
            # ZIP support for KB can be added later; process non-zip immediately
            if document.file_type != "zip":
                process_historical_document.delay(str(document.id))

        return created

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload historical documents.",
        )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_historical_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = (
        db.query(HistoricalDocument)
        .filter(
            HistoricalDocument.id == document_id,
            HistoricalDocument.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Historical document not found",
        )

    db.delete(document)
    db.commit()
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
    if body.source_type and body.source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid source_type. Allowed: "
                f"{', '.join(sorted(ALLOWED_SOURCE_TYPES))}"
            ),
        )

    results = search_historical_chunks(
        db,
        tenant_id=current_user.tenant_id,
        query=body.query.strip(),
        limit=body.limit,
        source_type=body.source_type,
    )

    return KnowledgeSearchResponse(
        query=body.query.strip(),
        results=results,
    )