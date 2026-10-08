from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models import User


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/summary")
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant = current_user.tenant

    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.role.value,
        },
        "company": {
            "id": str(tenant.id),
            "name": tenant.name,
        },
        "stats": {
            "opportunities": 0,
            "documents": 0,
            "requirements": 0,
        },
    }
