import os

from celery import Celery


REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"


celery_app = Celery(
    "tender_intelligence",
    broker=REDIS_URL,
    backend=REDIS_URL,
)


celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


celery_app.conf.imports = (
    "app.tasks.document_processing",
)