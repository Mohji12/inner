import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.reminder_service import check_and_send_reminders
from services.no_show_service import check_no_shows
from services.mentor_monthly_fee_service import generate_monthly_invoices_for_previous_month

try:
    from tasks.marketplace_tasks import process_outbox, reconcile_webhook_stuck, retry_failed_payouts
except Exception:  # pragma: no cover - task module may be unavailable in minimal envs.
    process_outbox = reconcile_webhook_stuck = retry_failed_payouts = None

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _safe_celery_enqueue(task, label: str) -> None:
    """Enqueue a Celery task without killing the APScheduler thread if broker/result Redis is down."""
    try:
        task.delay()
    except Exception as exc:  # pragma: no cover - broker/result connection errors
        logger.warning("Celery task %s could not be enqueued: %s", label, exc)

def start_scheduler():
    logger.info("Starting background scheduler...")
    
    # Run reminders check every 5 minutes
    scheduler.add_job(
        check_and_send_reminders,
        trigger=IntervalTrigger(minutes=5),
        id="check_reminders_job",
        name="Send booking reminders",
        replace_existing=True
    )
    
    # Run no-shows check every 10 minutes
    scheduler.add_job(
        check_no_shows,
        trigger=IntervalTrigger(minutes=10),
        id="check_no_shows_job",
        name="Mark unattended bookings",
        replace_existing=True
    )

    # Monthly mentor fee invoice generation check (runs daily, idempotent per month).
    scheduler.add_job(
        generate_monthly_invoices_for_previous_month,
        trigger=IntervalTrigger(hours=24),
        id="generate_mentor_monthly_invoices_job",
        name="Generate mentor monthly invoices",
        replace_existing=True
    )

    if process_outbox and reconcile_webhook_stuck and retry_failed_payouts:
        scheduler.add_job(
            lambda: _safe_celery_enqueue(process_outbox, "marketplace.process_outbox"),
            trigger=IntervalTrigger(minutes=1),
            id="marketplace_outbox_job",
            name="Marketplace outbox processor",
            replace_existing=True,
        )
        scheduler.add_job(
            lambda: _safe_celery_enqueue(retry_failed_payouts, "marketplace.retry_failed_payouts"),
            trigger=IntervalTrigger(minutes=15),
            id="marketplace_payout_retry_job",
            name="Marketplace payout retry",
            replace_existing=True,
        )
        scheduler.add_job(
            lambda: _safe_celery_enqueue(reconcile_webhook_stuck, "marketplace.reconcile_webhook_stuck"),
            trigger=IntervalTrigger(minutes=10),
            id="marketplace_webhook_reconcile_job",
            name="Marketplace webhook reconcile",
            replace_existing=True,
        )
    
    scheduler.start()

def shutdown_scheduler():
    logger.info("Shutting down background scheduler...")
    scheduler.shutdown()
