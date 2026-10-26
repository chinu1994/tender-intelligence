from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings

from app.db.session import get_db
from app.models import (
    PasswordResetToken,
    RefreshToken,
    Tenant,
    User,
    UserRole,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_password_reset_token_expiry,
    get_refresh_token_expiry,
    hash_password,
    hash_password_reset_token,
    hash_refresh_token,
    verify_password,
)

from app.api.dependencies import get_current_user

_DUMMY_HASH = hash_password("not-a-real-password-placeholder")


def normalize_email(email: str) -> str:
    return email.strip().lower()


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    # Check if email already exists
    email = normalize_email(data.email)
    existing_user = db.query(User).filter(
        func.lower(User.email) == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    # Create company/tenant
    tenant = Tenant(
        name=data.company_name.strip(),
    )

    db.add(tenant)
    db.flush()

    # Create first user as Admin
    user = User(
        tenant_id=tenant.id,
        email=email,
        password_hash=hash_password(data.password),
        role=UserRole.ADMIN,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    access_token = create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role.value,
    )

    refresh_token = create_refresh_token()

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=get_refresh_token_expiry(),
    )

    db.add(refresh_token_record)
    db.commit()

    return {
        "message": "Registration successful",
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "role": user.role.value,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        func.lower(User.email) == normalize_email(data.email)
    ).first()

    # Never reveal whether the email exists.
    if not user:
        return {
            "message": (
                "If the email exists, a password reset link "
                "has been generated."
            )
        }

    # Invalidate previous unused reset tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update(
        {
            PasswordResetToken.used: True,
        },
        synchronize_session=False,
    )

    reset_token = create_password_reset_token()

    reset_token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password_reset_token(reset_token),
        expires_at=get_password_reset_token_expiry(),
    )

    db.add(reset_token_record)
    db.commit()

    response = {
        "message": (
            "If the email exists, a password reset link "
            "has been generated."
        ),
    }
    # No mail transport is configured yet: outside production the token is
    # returned so the reset flow can be exercised end to end.
    if settings.EXPOSE_RESET_TOKEN and not settings.is_production:
        response["reset_token"] = reset_token
    return response
@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_hash = hash_password_reset_token(data.token)

    reset_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,
    ).first()

    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    if reset_record.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user = db.query(User).filter(
        User.id == reset_record.user_id,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset request",
        )

    # Update password
    user.password_hash = hash_password(data.new_password)

    # Token can only be used once
    reset_record.used = True

    # Revoke all existing refresh sessions
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False,
    ).update(
        {
            RefreshToken.revoked: True,
        },
        synchronize_session=False,
    )

    db.commit()

    return {
        "message": "Password reset successful",
    }

@router.post("/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    # Find user by email (case-insensitive)
    user = db.query(User).filter(
        func.lower(User.email) == normalize_email(data.email)
    ).first()

    # Always run one hash verification so response time does not reveal
    # whether the account exists.
    password_ok = verify_password(
        data.password, user.password_hash if user else _DUMMY_HASH
    )

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check user is active
    if not user.is_active or (user.tenant and not user.tenant.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role.value,
    )

    refresh_token = create_refresh_token()

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=get_refresh_token_expiry(),
    )

    db.add(refresh_token_record)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh")
def refresh_access_token(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    token_hash = hash_refresh_token(data.refresh_token)

    refresh_token_record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
    ).first()

    if not refresh_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    now = datetime.now(timezone.utc)

    if refresh_token_record.expires_at <= now:
        refresh_token_record.revoked = True
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    user = db.query(User).filter(
        User.id == refresh_token_record.user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Revoke old refresh token
    refresh_token_record.revoked = True

    # Create new access token
    access_token = create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role.value,
    )

    # Create new refresh token
    new_refresh_token = create_refresh_token()

    new_refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_refresh_token),
        expires_at=get_refresh_token_expiry(),
    )

    db.add(new_refresh_token_record)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": str(current_user.id),
        "tenant_id": str(current_user.tenant_id),
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
        "organization": current_user.tenant.name if current_user.tenant else None,
    }

@router.post("/logout")
def logout(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Revoke a refresh token (the short-lived access token simply expires)."""
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(data.refresh_token),
    ).first()
    if record and not record.revoked:
        record.revoked = True
        db.commit()
    return {"message": "Logged out"}
