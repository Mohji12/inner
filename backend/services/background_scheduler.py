import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.reminder_service import check_and_send_reminders
from services.no_show_service import check_no_shows
from services.mentor_monthly_fee_service import generate_monthly_invoices_for_previous_month
from database import SessionLocal
from services.mentor_presence_tracking_service import send_weekly_presence_warnings
from services.booking_slot_service import expire_stale_pending_bookings

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


def _run_weekly_presence_warnings() -> None:
    db = SessionLocal()
    try:
        sent = send_weekly_presence_warnings(db)
        if sent:
            logger.info("Weekly presence warnings sent: %s", sent)
    except Exception:
        logger.exception("Weekly presence warning job failed")
        db.rollback()
    finally:
        db.close()


def _run_expire_stale_pending_bookings() -> None:
    db = SessionLocal()
    try:
        count = expire_stale_pending_bookings(db)
        if count:
            logger.info("Expired stale pending_payment bookings: %s", count)
    except Exception:
        logger.exception("Stale pending booking cleanup failed")
        db.rollback()
    finally:
        db.close()


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

    # Coach weekly platform-time warnings (previous completed week; idempotent).
    scheduler.add_job(
        _run_weekly_presence_warnings,
        trigger=IntervalTrigger(hours=24),
        id="mentor_weekly_presence_warnings_job",
        name="Coach weekly presence warnings",
        replace_existing=True,
    )

    # Cancel unpaid bookings that were abandoned at checkout (frees slots).
    scheduler.add_job(
        _run_expire_stale_pending_bookings,
        trigger=IntervalTrigger(minutes=15),
        id="expire_stale_pending_bookings_job",
        name="Expire stale pending_payment bookings",
        replace_existing=True,
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
