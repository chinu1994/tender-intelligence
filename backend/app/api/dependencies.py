from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import bind_tenant, get_db
from app.models import User, UserRole


security = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Not authenticated")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    token_tenant = payload.get("tenant_id")

    if not user_id:
        raise _unauthorized("Invalid authentication token")

    try:
        user = db.query(User).filter(User.id == user_id).first()
    except Exception:
        # malformed UUID in the token subject
        db.rollback()
        raise _unauthorized("Invalid authentication token")

    if not user:
        raise _unauthorized("User not found")

    # The tenant embedded in the token must match the user's tenant. A user
    # moved between tenants (or a forged claim) must re-authenticate.
    if token_tenant is not None and str(user.tenant_id) != str(token_tenant):
        raise _unauthorized("Invalid authentication token")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if user.tenant is not None and not user.tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization account is inactive",
        )

    # From here on every statement on this session is tenant-scoped at the
    # database level as well (PostgreSQL RLS), in addition to explicit filters.
    bind_tenant(db, user.tenant_id)
    return user


def require_roles(*allowed_roles: UserRole) -> Callable:
    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker


# Administrator: user onboarding, organization configuration, access control
# (and may perform every other action in their tenant).
require_admin = require_roles(UserRole.ADMIN)

# Editor: tender case creation, document uploads, proposal drafting.
require_editor = require_roles(
    UserRole.ADMIN,
    UserRole.EDITOR,
)

# Reviewer / Approver: verification, extraction corrections, approvals.
require_reviewer = require_roles(
    UserRole.ADMIN,
    UserRole.REVIEWER,
)
