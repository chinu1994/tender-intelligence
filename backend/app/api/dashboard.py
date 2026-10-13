from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Document, ExtractedRequirementRecord, HistoricalDocument, TenderCase, ProposalIssue, ProposalSection

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
            "opportunities": db.query(func.count(TenderCase.id)).filter(TenderCase.tenant_id == current_user.tenant_id).scalar() or 0,
            "documents": db.query(func.count(Document.id)).filter(Document.tenant_id == current_user.tenant_id).scalar() or 0,
            "historical_documents": db.query(func.count(HistoricalDocument.id)).filter(HistoricalDocument.tenant_id == current_user.tenant_id).scalar() or 0,
            "requirements": db.query(func.count(ExtractedRequirementRecord.id)).filter(ExtractedRequirementRecord.tenant_id == current_user.tenant_id).scalar() or 0,
            "pending_reviews": db.query(func.count(ExtractedRequirementRecord.id)).filter(ExtractedRequirementRecord.tenant_id == current_user.tenant_id, ExtractedRequirementRecord.review_status == "pending").scalar() or 0,
            "open_proposal_issues": db.query(func.count(ProposalIssue.id)).filter(ProposalIssue.tenant_id == current_user.tenant_id, ProposalIssue.resolved.is_(False)).scalar() or 0,
            "proposal_sections": db.query(func.count(ProposalSection.id)).filter(ProposalSection.tenant_id == current_user.tenant_id).scalar() or 0,
        },
    }
