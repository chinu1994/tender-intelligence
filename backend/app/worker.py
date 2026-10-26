from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "tender_intelligence",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
    result_expires=24 * 60 * 60,
    broker_connection_retry_on_startup=True,
    # Inline execution for tests / single-process demos.
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=False,
)

celery_app.conf.imports = (
    "app.tasks.document_processing",
    "app.tasks.knowledge_base_processing",
)
