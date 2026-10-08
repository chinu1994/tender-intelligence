from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import User
from app.schemas.users import CreateUserRequest, UpdateUserRequest

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.post("")
def create_user(
    data: CreateUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(
        User.email == data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = User(
        tenant_id=current_user.tenant_id,
        email=data.email,
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

@router.get("")
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id
    ).order_by(User.created_at.desc()).all()

    return [
        {
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
        for user in users
    ]

@router.patch("/{user_id}")
def update_user(
    user_id: str,
    data: UpdateUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role",
        )

    user.role = data.role

    db.commit()
    db.refresh(user)

    return {
        "message": "User role updated successfully",
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value,
    }
