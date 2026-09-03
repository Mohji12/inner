from __future__ import annotations

import ssl
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from celery import Celery

from core.config import settings


def _sanitize_redis_url(url: str) -> str:
    """Strip Upstash ssl_cert_reqs=CERT_NONE query (invalid for redis-py / kombu)."""
    parsed = urlparse(url)
    if not parsed.query:
        return url
    qs = parse_qs(parsed.query, keep_blank_values=True)
    qs.pop("ssl_cert_reqs", None)
    return urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))


broker_url = _sanitize_redis_url(
    (getattr(settings, "redis_url", None) or "").strip() or "redis://localhost:6379/0"
)
_rb = (getattr(settings, "celery_result_backend_url", None) or "").strip()
# None = no result backend (fire-and-forget). Set CELERY_RESULT_BACKEND_URL in .env if you need AsyncResult/Flower.
result_backend = _sanitize_redis_url(_rb) if _rb else None

celery_app = Celery("marketplace", broker=broker_url, backend=result_backend)
_conf: dict = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "task_acks_late": True,
    "worker_prefetch_multiplier": 1,
    "include": ["tasks.marketplace_tasks"],
}
if broker_url.startswith("rediss://"):
    # Same intent as former ?ssl_cert_reqs=CERT_NONE on Upstash URLs.
    _conf["broker_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}
celery_app.conf.update(**_conf)
