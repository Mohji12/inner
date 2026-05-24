from celery import Celery

from core.config import settings

broker_url = (getattr(settings, "redis_url", None) or "").strip() or "redis://localhost:6379/0"
_rb = (getattr(settings, "celery_result_backend_url", None) or "").strip()
# None = no result backend (fire-and-forget). Set CELERY_RESULT_BACKEND_URL in .env if you need AsyncResult/Flower.
result_backend = _rb if _rb else None

celery_app = Celery("marketplace", broker=broker_url, backend=result_backend)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    include=["tasks.marketplace_tasks"],
)
