import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

from core.config import settings

logger = logging.getLogger(__name__)


def smtp_is_configured() -> bool:
    return bool((settings.smtp_host or "").strip() and (settings.smtp_from_email or "").strip())


def _stripped(value: str | None) -> str:
    return (value or "").strip().strip('"').strip("'")


def _from_parts() -> tuple[str, str]:
    from_email = _stripped(settings.smtp_from_email)
    from_name = _stripped(settings.smtp_from_name) or "Mijn Levenspad"
    return from_email, from_name


def _build_message(*, to_email: str, subject: str, body: str) -> EmailMessage:
    from_email, from_name = _from_parts()
    domain = from_email.split("@")[-1] if "@" in from_email else "mijnlevenspad.com"
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.set_content(body or "")
    return msg


def _connect_smtp() -> smtplib.SMTP:
    host = _stripped(settings.smtp_host)
    port = int(settings.smtp_port or 587)
    user = _stripped(settings.smtp_user)
    password = _stripped(settings.smtp_password)
    timeout = 30
    context = ssl.create_default_context()
    if port == 465:
        server: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=timeout, context=context)
    else:
        server = smtplib.SMTP(host, port, timeout=timeout)
        server.ehlo()
        if bool(settings.smtp_use_tls):
            server.starttls(context=context)
            server.ehlo()
    if user:
        try:
            server.login(user, password)
        except Exception:
            try:
                server.close()
            except Exception:
                pass
            raise
    return server


def send_plain_email(*, to_email: str, subject: str, body: str) -> bool:
    """Send email via SMTP. Returns True only if the server accepted the message."""
    recipient = _stripped(to_email)
    if not recipient or "@" not in recipient:
        logger.warning("Skip email: invalid recipient")
        return False
    if not smtp_is_configured():
        logger.warning(
            "SMTP not configured — email not sent to %s. "
            "Set SMTP_HOST and SMTP_FROM_EMAIL to deliver mail.",
            recipient,
        )
        logger.info("Email body (dev, not sent): %s", body)
        return False

    from_email, _ = _from_parts()
    msg = _build_message(to_email=recipient, subject=subject, body=body)
    with _connect_smtp() as server:
        refused = server.sendmail(from_email, [recipient], msg.as_string())
    if refused:
        logger.error("SMTP refused recipient %s: %s", recipient, refused)
        raise smtplib.SMTPRecipientsRefused(refused)
    return True


def send_plain_emails(items: list[tuple[str, str, str]]) -> tuple[int, str | None]:
    """Send many (to_email, subject, body) messages on one SMTP connection.

    Returns (accepted_count, warning_or_none).
    """
    pending: list[tuple[str, EmailMessage]] = []
    for to_email, subject, body in items:
        recipient = _stripped(to_email)
        if not recipient or "@" not in recipient:
            logger.warning("Skip email: invalid recipient")
            continue
        pending.append((recipient, _build_message(to_email=recipient, subject=subject, body=body)))

    if not pending:
        return 0, "No valid coach email addresses to send to."
    if not smtp_is_configured():
        logger.warning("SMTP not configured — %s email(s) not sent.", len(pending))
        return 0, "Email server is not configured, so no messages were delivered."

    from_email, _ = _from_parts()
    sent = 0
    try:
        with _connect_smtp() as server:
            for recipient, msg in pending:
                refused = server.sendmail(from_email, [recipient], msg.as_string())
                if refused:
                    logger.error("SMTP refused recipient %s: %s", recipient, refused)
                    continue
                sent += 1
    except Exception as exc:
        logger.exception("SMTP send failed after %s accepted message(s)", sent)
        warning = f"Email delivery failed ({type(exc).__name__}). {sent} of {len(pending)} sent."
        return sent, warning

    if sent < len(pending):
        return sent, f"Only {sent} of {len(pending)} emails were accepted by the mail server."
    return sent, None
