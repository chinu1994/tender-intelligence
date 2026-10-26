import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import (
    get_current_user,
    require_admin,
    require_editor,
)
from app.db.session import get_db
from app.models import (
    Document,
    DocumentStatus,
    TenderCase,
    TenderCaseStatus,
    User,
)
from app.schemas.tender_cases import (
    TenderCaseCreate,
    TenderCaseResponse,
    TenderCaseTransitions,
    TenderCaseUpdate,
)
from app.services.document_storage import case_directory, delete_directory
from app.services.lifecycle import TransitionError, allowed_transitions, validate_transition


router = APIRouter(
    prefix="/tender-cases",
    tags=["Tender Cases"],
)


def _document_counts(
    db: Session,
    tenant_id: uuid.UUID,
    case_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict[str, int]]:
    """Document totals per case.

    ZIP archives are containers only: their extracted files are stored as
    separate documents, so the archive itself is excluded to keep
    "processed x of y" accurate.
    """
    counts: dict[uuid.UUID, dict[str, int]] = {}

    if not case_ids:
        return counts

    rows = (
        db.query(
            Document.tender_case_id,
            Document.status,
            func.count(Document.id),
        )
        .filter(
            Document.tenant_id == tenant_id,
            Document.tender_case_id.in_(case_ids),
            Document.file_type != "zip",
        )
        .group_by(Document.tender_case_id, Document.status)
        .all()
    )

    for case_id, doc_status, amount in rows:
        entry = counts.setdefault(
            case_id,
            {"total": 0, "processed": 0, "failed": 0},
        )
        entry["total"] += amount

        if doc_status == DocumentStatus.COMPLETED:
            entry["processed"] += amount
        elif doc_status == DocumentStatus.FAILED:
            entry["failed"] += amount

    return counts


def _to_response(
    tender_case: TenderCase,
    counts: dict[uuid.UUID, dict[str, int]],
) -> TenderCaseResponse:
    entry = counts.get(
        tender_case.id,
        {"total": 0, "processed": 0, "failed": 0},
    )

    return TenderCaseResponse(
        id=tender_case.id,
        name=tender_case.name,
        reference=tender_case.reference,
        description=tender_case.description,
        submission_deadline=tender_case.submission_deadline,
        status=tender_case.status,
        owner=(
            tender_case.created_by.email
            if tender_case.created_by
            else None
        ),
        documents_total=entry["total"],
        documents_processed=entry["processed"],
        documents_failed=entry["failed"],
        created_at=tender_case.created_at,
        updated_at=tender_case.updated_at,
    )


def _generate_reference(db: Session, tenant_id: uuid.UUID) -> str:
    """Next free reference for this tenant, e.g. TND-2026-0001."""
    year = datetime.datetime.now(datetime.timezone.utc).year

    number = (
        db.query(func.count(TenderCase.id))
        .filter(TenderCase.tenant_id == tenant_id)
        .scalar()
        or 0
    ) + 1

    while True:
        candidate = f"TND-{year}-{number:04d}"

        exists = (
            db.query(TenderCase.id)
            .filter(
                TenderCase.tenant_id == tenant_id,
                TenderCase.reference == candidate,
            )
            .first()
        )

        if not exists:
            return candidate

        number += 1


def get_case_or_404(
    db: Session,
    tender_case_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> TenderCase:
    tender_case = (
        db.query(TenderCase)
        .options(joinedload(TenderCase.created_by))
        .filter(
            TenderCase.id == tender_case_id,
            TenderCase.tenant_id == tenant_id,
        )
        .first()
    )

    if not tender_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tender case not found",
        )

    return tender_case


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
    reference = (data.reference or "").strip()

    if not reference:
        reference = _generate_reference(db, current_user.tenant_id)

    tender_case = TenderCase(
        tenant_id=current_user.tenant_id,
        created_by_id=current_user.id,
        name=data.name.strip(),
        reference=reference,
        description=data.description,
        submission_deadline=data.submission_deadline,
        status=TenderCaseStatus.NEW,
    )

    db.add(tender_case)
    db.commit()
    db.refresh(tender_case)

    return _to_response(tender_case, {})


@router.get(
    "",
    response_model=list[TenderCaseResponse],
)
def list_tender_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tender_cases = (
        db.query(TenderCase)
        .options(joinedload(TenderCase.created_by))
        .filter(
            TenderCase.tenant_id == current_user.tenant_id
        )
        .order_by(TenderCase.created_at.desc())
        .all()
    )

    counts = _document_counts(
        db,
        current_user.tenant_id,
        [tender_case.id for tender_case in tender_cases],
    )

    return [
        _to_response(tender_case, counts)
        for tender_case in tender_cases
    ]


@router.get(
    "/{tender_case_id}",
    response_model=TenderCaseResponse,
)
def get_tender_case(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    counts = _document_counts(db, current_user.tenant_id, [tender_case.id])
    return _to_response(tender_case, counts)


@router.get(
    "/{tender_case_id}/transitions",
    response_model=TenderCaseTransitions,
)
def get_tender_case_transitions(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lifecycle states the current user may move this case to manually."""
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    if current_user.role.value == "reviewer":
        # reviewers may only re-open an approved proposal
        allowed = (
            [TenderCaseStatus.PROPOSAL_DRAFT]
            if tender_case.status == TenderCaseStatus.APPROVED
            else []
        )
    else:
        allowed = allowed_transitions(tender_case.status, current_user.role)
    return TenderCaseTransitions(status=tender_case.status, allowed=allowed)


@router.patch(
    "/{tender_case_id}",
    response_model=TenderCaseResponse,
)
def update_tender_case(
    tender_case_id: uuid.UUID,
    data: TenderCaseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    update_data = data.model_dump(exclude_unset=True)

    # name and status are required columns; ignore explicit nulls.
    for required in ("name", "status"):
        if required in update_data and update_data[required] is None:
            update_data.pop(required)

    new_status = update_data.pop("status", None)
    is_reopen_only = (
        new_status == TenderCaseStatus.PROPOSAL_DRAFT
        and tender_case.status == TenderCaseStatus.APPROVED
        and not update_data
    )
    role = current_user.role.value
    if role == "reviewer" and not is_reopen_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )

    if update_data and tender_case.status in {TenderCaseStatus.APPROVED, TenderCaseStatus.COMPLETED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved/completed cases are read-only. Re-open the proposal to edit case details.",
        )

    if new_status is not None:
        try:
            validate_transition(tender_case.status, new_status, current_user.role)
        except TransitionError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        tender_case.status = new_status

    for field, value in update_data.items():
        if field == "name":
            value = value.strip()
        setattr(tender_case, field, value)

    db.commit()
    db.refresh(tender_case)

    counts = _document_counts(db, current_user.tenant_id, [tender_case.id])
    return _to_response(tender_case, counts)


@router.delete(
    "/{tender_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tender_case(
    tender_case_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tender_case = get_case_or_404(db, tender_case_id, current_user.tenant_id)
    directory = case_directory(tender_case.tenant_id, tender_case.id)

    # Children first so the self-referencing parent link never dangles.
    db.query(Document).filter(
        Document.tender_case_id == tender_case.id,
        Document.tenant_id == current_user.tenant_id,
    ).update({Document.parent_document_id: None}, synchronize_session=False)
    db.delete(tender_case)
    db.commit()
    delete_directory(directory)

    return None
