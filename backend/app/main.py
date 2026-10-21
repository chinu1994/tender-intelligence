from fastapi import Depends, FastAPI
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.api.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.dependencies import require_admin
from app.models import User
from app.api.dashboard import router as dashboard_router
from app.api.users import router as users_router
from app.api.tender_cases import router as tender_cases_router
from app.api.documents import router as documents_router
from app.api.knowledge_base import router as knowledge_base_router
from app.api.workspace import router as workspace_router


app = FastAPI(
    title="Tender Intelligence API",
    version="0.1.0",
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(users_router)
app.include_router(tender_cases_router)
app.include_router(documents_router)
app.include_router(knowledge_base_router)
app.include_router(workspace_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "tender-intelligence-api",
    }


@app.get("/health/database")
def database_health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        value = result.scalar()

    return {
        "database": "ok",
        "result": value,
    }


@app.get("/test/admin")
def admin_test(
    current_user: User = Depends(require_admin),
):
    return {
        "message": "Admin access granted",
        "user": current_user.email,
        "role": current_user.role.value,
    }