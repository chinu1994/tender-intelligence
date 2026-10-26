from __future__ import annotations

import logging
import time
import uuid

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# --------------------------------------------------------------------------
# Database-level tenant isolation (PostgreSQL row-level security)
# --------------------------------------------------------------------------
# The migration ``e7b1c2d3f4a5`` enables RLS on every tenant-owned table and
# creates the NOLOGIN role ``tender_app_rls``. Once a request has been
# authenticated, ``bind_tenant`` stores the tenant on the session; at the
# start of every transaction we switch to that role and publish the tenant id
# in ``app.current_tenant_id``. PostgreSQL then filters rows by policy even if
# an application query forgets its ``tenant_id`` predicate. Both settings are
# transaction-local, so pooled connections never leak a tenant context.
#
# Background workers and authentication flows run without a tenant context
# (table owner, policies not applied) because they must resolve identities or
# process jobs that already carry an explicit tenant id.

RLS_ROLE = "tender_app_rls"
_rls_available: bool | None = None
_rls_checked_at: float = float("-inf")


def rls_available() -> bool:
    """True if RLS is enabled in settings and the role exists/is grantable."""
    global _rls_available
    if not settings.RLS_ENABLED:
        return False
    global _rls_checked_at
    if not _rls_available and time.monotonic() - _rls_checked_at > 60:
        # Only a positive result is cached permanently; a negative one is
        # re-checked at most once a minute, so a role created after startup
        # (e.g. migrations finishing later) is picked up.
        _rls_checked_at = time.monotonic()
        try:
            with engine.connect() as conn:
                _rls_available = bool(
                    conn.execute(
                        text(
                            "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :r) "
                            "AND pg_has_role(current_user, :r, 'MEMBER')"
                        ),
                        {"r": RLS_ROLE},
                    ).scalar()
                )
        except Exception:  # pragma: no cover - database not reachable yet
            logger.warning("Could not determine RLS availability", exc_info=True)
            return False
        if not _rls_available:
            logger.warning(
                "Row-level security role %s is not available; relying on "
                "application-level tenant filters only.",
                RLS_ROLE,
            )
    return bool(_rls_available)


def reset_rls_cache() -> None:
    global _rls_available, _rls_checked_at
    _rls_available = None
    _rls_checked_at = float("-inf")


def _apply_tenant_context(connection, tenant_id: uuid.UUID) -> None:
    connection.exec_driver_sql(f"SET LOCAL ROLE {RLS_ROLE}")
    connection.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant, true)"),
        {"tenant": str(tenant_id)},
    )


@event.listens_for(Session, "after_begin")
def _set_tenant_on_begin(session: Session, transaction, connection) -> None:
    tenant_id = session.info.get("tenant_id")
    if tenant_id is not None and rls_available():
        _apply_tenant_context(connection, tenant_id)


def bind_tenant(db: Session, tenant_id: uuid.UUID) -> None:
    """Scope all further statements of this session to ``tenant_id``."""
    db.info["tenant_id"] = tenant_id
    if rls_available() and db.in_transaction():
        # The current transaction already began without the context.
        _apply_tenant_context(db.connection(), tenant_id)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
