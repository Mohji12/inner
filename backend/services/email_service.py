import logging
import smtplib
from email.mime.text import MIMEText

from core.config import settings

logger = logging.getLogger(__name__)


def send_plain_email(*, to_email: str, subject: str, body: str) -> None:
    """Send email via SMTP. If SMTP is not configured, logs the message (dev fallback)."""
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning(
            "SMTP not configured — email not sent to %s. "
            "Set SMTP_HOST and SMTP_FROM_EMAIL to deliver mail, or use dev_verification_code from the register API response.",
            to_email,
        )
        logger.info("OTP email body (dev): %s", body)
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            logger.info("SMTP login attempt — user=%r, pass_len=%d, pass_start=%r",
                        settings.smtp_user, len(settings.smtp_password), settings.smtp_password[:10])
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
