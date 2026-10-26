"""Queue background jobs with a readable failure mode."""
from __future__ import annotations

import logging

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)


def enqueue(task, *args) -> str | None:
    """Queue ``task``; returns ``None`` on success or a readable error message.

    If the broker is unreachable and ``TASK_SYNC_FALLBACK`` is enabled, the task
    runs inline so single-process deployments and demos keep working.
    """
    try:
        task.delay(*args)
        return None
    except Exception as queue_exc:  # broker down / misconfigured
        logger.warning("Could not queue %s: %s", getattr(task, "name", task), queue_exc)
        if settings.TASK_SYNC_FALLBACK:
            try:
                task.apply(args=args)
                return None
            except Exception as sync_exc:  # pragma: no cover - task records its own failure
                logger.exception("Inline execution of %s failed", getattr(task, "name", task))
                return f"Processing could not be started: {sync_exc}"
        return (
            "Processing could not be queued because the background worker is unavailable. "
            "Use 'Retry' once the worker is running."
        )


# A document still "processing"/"pending" after this long is considered stuck
# (worker killed, broker lost the message) and may be reprocessed.
STALE_AFTER = timedelta(minutes=35)


def claim(db: Session, table: str, document_id: str) -> bool:
    """Atomically move a pending document to processing.

    Exactly one task wins, so duplicate deliveries or double "reprocess"
    clicks can never process (or unpack) the same document twice.
    """
    assert table in {"documents", "historical_documents"}
    row = db.execute(
        text(
            f"UPDATE {table} SET status = 'processing', processing_error = NULL, updated_at = now() "
            "WHERE id = CAST(:id AS uuid) AND status = 'pending' RETURNING id"
        ),
        {"id": document_id},
    ).first()
    db.commit()
    return row is not None


def can_reprocess(status: str, updated_at: datetime | None) -> bool:
    if status in {"failed", "completed"}:
        return True
    if updated_at is None:
        return False
    return datetime.now(timezone.utc) - updated_at > STALE_AFTER
