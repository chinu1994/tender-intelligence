import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import RefreshToken, User, UserRole
from app.schemas.users import CreateUserRequest, UpdateUserRequest, UserResponse

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


def _payload(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
    data: CreateUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Onboard a user into the administrator's organization (tenant)."""
    email = data.email.strip().lower()
    existing_user = db.query(User).filter(func.lower(User.email) == email).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = User(
        tenant_id=current_user.tenant_id,
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User created successfully",
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "role": user.role.value,
    }


@router.get("", response_model=list[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.tenant_id == current_user.tenant_id)
        .order_by(User.created_at.desc())
        .all()
    )
    return [_payload(user) for user in users]


@router.patch("/{user_id}")
def update_user(
    user_id: uuid.UUID,
    data: UpdateUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Change a user's role and/or activate/deactivate the account."""
    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.role is None and data.is_active is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    if user.id == current_user.id:
        if data.role is not None and data.role != user.role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role")
        if data.is_active is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")

    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
        if not data.is_active:
            # Sign the user out everywhere.
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False)
            ).update({RefreshToken.revoked: True}, synchronize_session=False)

    db.flush()
    remaining_admins = (
        db.query(func.count(User.id))
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
        )
        .scalar()
    )
    if remaining_admins == 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The organization must keep at least one active administrator",
        )

    db.commit()
    db.refresh(user)

    return {
        "message": "User updated successfully",
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
    }
