"""Shared pytest fixtures.

Unit tests (parsers, AI adapters, exporters) need no services.

Integration tests use a real PostgreSQL + pgvector database, created and
migrated with Alembic at session start, plus the FastAPI app in-process with
Celery in eager mode. Configure the server with the usual ``POSTGRES_*``
variables (or ``TEST_DATABASE_URL``); the test database name defaults to
``<POSTGRES_DB>_test``. When no database is reachable, integration tests are
skipped with a clear reason instead of failing.

    docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# ---------------------------------------------------------------- environment
# Must be set before any `app.*` import reads settings.
_STORAGE_DIR = tempfile.mkdtemp(prefix="tender-test-storage-")
os.environ["APP_ENV"] = "test"
os.environ["DOCUMENT_STORAGE_PATH"] = _STORAGE_DIR
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "1"
os.environ["AI_PROVIDER"] = "mock"
os.environ["EMBEDDING_PROVIDER"] = "mock"
os.environ["VECTOR_RETRIEVER"] = "pgvector"
os.environ["ARGON2_TIME_COST"] = "1"  # fast hashing for tests only
os.environ["ARGON2_MEMORY_COST"] = "1024"
os.environ.setdefault("JWT_SECRET", "test-only-secret-value-with-more-than-32-chars")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "tender_user")
os.environ.setdefault("POSTGRES_PASSWORD", "")

if os.getenv("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    base_db = os.getenv("POSTGRES_DB", "tender_intelligence")
    os.environ["POSTGRES_DB"] = os.getenv("TEST_POSTGRES_DB", f"{base_db}_test" if not base_db.endswith("_test") else base_db)
    os.environ.pop("DATABASE_URL", None)

TABLES = (
    "proposal_issues, proposal_sections, extracted_requirements, historical_document_chunks, "
    "historical_documents, document_chunks, documents, tender_cases, password_reset_tokens, "
    "refresh_tokens, users, tenants"
)

_db_state: dict[str, object] = {}


def _prepare_database() -> str | None:
    """Create + migrate the test database. Returns an error string or None."""
    try:
        import sqlalchemy as sa
        from sqlalchemy.engine import make_url

        from app.core.config import settings

        url = make_url(settings.DATABASE_URL)
        admin = sa.create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            exists = conn.execute(
                sa.text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
            ).scalar()
            if not exists:
                conn.execute(sa.text(f'CREATE DATABASE "{url.database}"'))
        admin.dispose()

        from alembic import command
        from alembic.config import Config

        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        command.upgrade(config, "head")
        return None
    except Exception as exc:  # pragma: no cover - environment dependent
        return f"PostgreSQL+pgvector test database unavailable: {exc}"


@pytest.fixture(scope="session")
def database():
    if "error" not in _db_state:
        _db_state["error"] = _prepare_database()
    if _db_state["error"]:
        pytest.skip(str(_db_state["error"]))
    from app.db.session import engine, reset_rls_cache

    reset_rls_cache()
    return engine


@pytest.fixture()
def clean_db(database):
    import sqlalchemy as sa

    with database.begin() as conn:
        conn.execute(sa.text(f"TRUNCATE {TABLES} CASCADE"))
    shutil.rmtree(_STORAGE_DIR, ignore_errors=True)
    os.makedirs(_STORAGE_DIR, exist_ok=True)
    yield database


@pytest.fixture()
def client(clean_db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session(clean_db):
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ------------------------------------------------------------------ helpers
@dataclass
class Org:
    name: str
    tenant_id: str
    admin: dict
    editor: dict
    reviewer: dict
    emails: dict


def auth_headers(client, email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_org(client, name: str, password: str = "Str0ng-Passw0rd!") -> Org:
    slug = name.lower().replace(" ", "")
    admin_email = f"admin@{slug}.example.com"
    response = client.post(
        "/auth/register",
        json={"company_name": name, "email": admin_email, "password": password},
    )
    assert response.status_code == 200, response.text
    tenant_id = response.json()["tenant_id"]
    admin = {"Authorization": f"Bearer {response.json()['access_token']}"}
    emails = {"admin": admin_email}
    headers = {}
    for role in ("editor", "reviewer"):
        email = f"{role}@{slug}.example.com"
        created = client.post(
            "/users", headers=admin, json={"email": email, "password": password, "role": role}
        )
        assert created.status_code == 201, created.text
        headers[role] = auth_headers(client, email, password)
        emails[role] = email
    return Org(name, tenant_id, admin, headers["editor"], headers["reviewer"], emails)


@pytest.fixture()
def org(client) -> Org:
    return create_org(client, "Acme Bids")


@pytest.fixture()
def other_org(client) -> Org:
    return create_org(client, "Globex Tenders")
