import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    require_admin,
    require_editor,
)
from app.db.session import get_db
from app.models import TenderCase, TenderCaseStatus, User
from app.schemas.tender_cases import (
    TenderCaseCreate,
    TenderCaseResponse,
    TenderCaseUpdate,
)


router = APIRouter(
    prefix="/tender-cases",
    tags=["Tender Cases"],
)


@router.post(
    "",
    response_model=TenderCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tender_case(
    data: TenderCaseCreate,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db),
):
    tender_case = TenderCase(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        status=TenderCaseStatus.NEW,
    )

    db.add(tender_case)
    db.commit()
    db.refresh(tender_case)

    return tender_case


@router.get(
    "",
    response_model=list[TenderCaseResponse],
)
def list_tender_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(TenderCase)
        .filter(
            TenderCase.tenant_id == current_user.tenant_id
        )
        .order_by(TenderCase.created_at.desc())
        .all()
    )


@router.get(
    "/{tender_case_id}",
    response_model=TenderCaseResponse,
)
def get_tender_case(
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

    return tender_case


@router.patch(
    "/{tender_case_id}",
    response_model=TenderCaseResponse,
)
def update_tender_case(
    tender_case_id: uuid.UUID,
    data: TenderCaseUpdate,
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

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(tender_case, field, value)

    db.commit()
    db.refresh(tender_case)

    return tender_case


@router.delete(
    "/{tender_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tender_case(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(require_admin),
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

    db.delete(tender_case)
    db.commit()

    return None
