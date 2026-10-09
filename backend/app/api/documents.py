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

from app.api.dependencies import require_editor
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

            # ZIP ko abhi worker mein process nahi karna hai.
            # ZIP ke andar ke extracted documents already separate records hain.
            if document.file_type != "zip":
                process_document.delay(str(document.id))

        return created_documents


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
            detail="Failed to process uploaded documents.",
        )
