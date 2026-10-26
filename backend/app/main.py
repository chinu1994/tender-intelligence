import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.documents import router as documents_router
from app.api.knowledge_base import router as knowledge_base_router
from app.api.proposal import router as proposal_router
from app.api.requirements import router as requirements_router
from app.api.tender_cases import router as tender_cases_router
from app.api.users import router as users_router
from app.core.config import settings
from app.db.session import engine, rls_available

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate()
    if settings.RLS_ENABLED and settings.is_production and not rls_available():
        # Fail closed: never serve production traffic without database-level
        # tenant isolation unless it was explicitly disabled (RLS_ENABLED=false).
        raise RuntimeError(
            "Row-level security role 'tender_app_rls' is missing. Run the migrations with a "
            "user that has CREATEROLE, or set RLS_ENABLED=false to accept application-level "
            "isolation only."
        )
    yield


app = FastAPI(
    title="Tender Intelligence API",
    version="1.0.0",
    description=(
        "Multi-tenant tender (RFP/bid) ingestion, structured extraction, review, "
        "historical knowledge search, proposal drafting and DOCX/XLSX export. "
        "All endpoints except /auth/* and /health* require a Bearer access token; "
        "every record is scoped to the caller's organization (tenant)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(users_router)
app.include_router(tender_cases_router)
app.include_router(documents_router)
app.include_router(requirements_router)
app.include_router(proposal_router)
app.include_router(knowledge_base_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "tender-intelligence-api",
    }


@app.get("/health/database", tags=["Health"])
def database_health_check():
    with engine.connect() as connection:
        value = connection.execute(text("SELECT 1")).scalar()
    return {
        "database": "ok",
        "result": value,
    }
