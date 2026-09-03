from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import text

from celery_app import celery_app
from db.session import SessionLocal
from models.marketplace import CoachPayoutRequest, OutboxEvent, WebhookEventLog
from services.marketplace_service import execute_payout_attempt

logger = get_task_logger(__name__)


@celery_app.task(name="marketplace.process_outbox")
def process_outbox() -> dict[str, int]:
    db = SessionLocal()
    processed = 0
    try:
        rows = (
            db.query(OutboxEvent)
            .filter(OutboxEvent.status == "pending", OutboxEvent.available_at <= datetime.now(timezone.utc))
            .order_by(OutboxEvent.created_at.asc())
            .limit(200)
            .all()
        )
        for row in rows:
            row.status = "processed"
            row.processed_at = datetime.now(timezone.utc)
            processed += 1
        db.commit()
    finally:
        db.close()
    return {"processed": processed}


@celery_app.task(name="marketplace.retry_failed_payouts")
def retry_failed_payouts() -> dict[str, int]:
    db = SessionLocal()
    retried = 0
    try:
        rows = (
            db.query(CoachPayoutRequest)
            .filter(CoachPayoutRequest.status == "failed")
            .order_by(CoachPayoutRequest.requested_at.asc())
            .limit(50)
            .all()
        )
        for req in rows:
            execute_payout_attempt(db, req)
            retried += 1
        db.commit()
    finally:
        db.close()
    return {"retried": retried}


@celery_app.task(name="marketplace.reconcile_webhook_stuck")
def reconcile_webhook_stuck() -> dict[str, int]:
    db = SessionLocal()
    fixed = 0
    try:
        rows = (
            db.query(WebhookEventLog)
            .filter(WebhookEventLog.processing_status == "received")
            .order_by(WebhookEventLog.received_at.asc())
            .limit(100)
            .all()
        )
        for row in rows:
            row.processing_status = "needs_review"
            row.error_message = "Webhook stuck in received state; flagged by reconcile job"
            fixed += 1
        db.commit()
    finally:
        db.close()
    return {"flagged": fixed}


@celery_app.task(name="marketplace.healthcheck_db")
def healthcheck_db() -> dict[str, str]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    finally:
        db.close()
