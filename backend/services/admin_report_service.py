import logging
from datetime import datetime, timedelta, timezone
from database import SessionLocal
from models.admin import Admin
from services.site_analytics_service import visit_stats
from services.email_service import send_plain_email

logger = logging.getLogger(__name__)

def send_daily_analytics_report() -> None:
    """Fetches yesterday's analytics and emails a summary to all admins."""
    db = SessionLocal()
    try:
        # Determine the time range for "yesterday"
        now = datetime.now(timezone.utc)
        end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = end - timedelta(days=1)
        
        stats = visit_stats(db, start, end, top_limit=15)
        
        admins = db.query(Admin).all()
        if not admins:
            logger.info("No admins found to send the daily analytics report to.")
            return
            
        subject = f"Daily Analytics Report: {start.strftime('%Y-%m-%d')}"
        
        # Build report body
        body_lines = [
            f"Hello Admin,\n",
            f"Here is the analytics report for {start.strftime('%b %d, %Y')} (UTC).\n",
            f"Total Page Views: {stats.page_views}",
            f"Total Unique Visitors: {stats.unique_visitors}\n",
        ]
        
        body_lines.append("--- Top Visited Pages ---")
        if not stats.top_pages:
            body_lines.append("No page visits recorded.")
        else:
            for i, row in enumerate(stats.top_pages, 1):
                body_lines.append(f"{i}. {row.path} - {row.views} views ({row.unique_visitors} unique)")
                
        body_lines.append("\n--- Top Landing Pages ---")
        if not stats.landing_pages:
            body_lines.append("No landing pages recorded.")
        else:
            for i, row in enumerate(stats.landing_pages, 1):
                body_lines.append(f"{i}. {row.path} - {row.views} views ({row.unique_visitors} unique)")
                
        body_lines.append("\n--- Top Traffic Sources (Referrers) ---")
        if not stats.referrers:
            body_lines.append("No referrers recorded.")
        else:
            for i, row in enumerate(stats.referrers, 1):
                body_lines.append(f"{i}. {row.host} - {row.views} views ({row.unique_visitors} unique)")
                
        body_lines.append("\n\nBest regards,\nAutomated System")
        body_text = "\n".join(body_lines)
        
        sent_count = 0
        for admin in admins:
            try:
                success = send_plain_email(to_email=admin.email, subject=subject, body=body_text)
                if success:
                    sent_count += 1
            except Exception as e:
                logger.error("Failed to send analytics report to %s: %s", admin.email, e)
                
        logger.info("Daily analytics report sent to %d admin(s).", sent_count)
        
    except Exception:
        logger.exception("Failed to generate or send the daily analytics report.")
    finally:
        db.close()
