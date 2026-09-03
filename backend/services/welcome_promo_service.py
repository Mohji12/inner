import logging

from sqlalchemy.orm import Session

from core.config import settings
from models.promo_code import PromoCode
from services.email_service import send_plain_email, smtp_is_configured
from services.promo_service import user_has_completed_booking, user_has_completed_paid_chat, user_has_redeemed_promo

logger = logging.getLogger(__name__)


def _welcome_code() -> str:
    return (settings.user_welcome_promo_seed_code or "").strip().upper()


def get_welcome_promo_row(db: Session) -> PromoCode | None:
    code = _welcome_code()
    if not code:
        return None
    return (
        db.query(PromoCode)
        .filter(PromoCode.code == code, PromoCode.is_active.is_(True))
        .first()
    )


def welcome_promo_eligibility(db: Session, user_id: str) -> dict:
    code = _welcome_code()
    duration = int(settings.user_welcome_promo_duration_minutes or 5)
    if not code:
        return {"eligible": False, "code": None, "duration_minutes": duration, "message": None}

    promo = get_welcome_promo_row(db)
    if not promo:
        return {"eligible": False, "code": code, "duration_minutes": duration, "message": None}

    if user_has_redeemed_promo(db, user_id, promo):
        return {
            "eligible": False,
            "code": code,
            "duration_minutes": promo.allowed_duration_minutes or duration,
            "message": "Welcome promo already used",
        }

    if user_has_completed_booking(db, user_id):
        return {
            "eligible": False,
            "code": code,
            "duration_minutes": promo.allowed_duration_minutes or duration,
            "message": "Welcome promo already used",
        }

    if user_has_completed_paid_chat(db, user_id):
        return {
            "eligible": False,
            "code": code,
            "duration_minutes": promo.allowed_duration_minutes or duration,
            "message": "Welcome promo already used",
        }

    return {
        "eligible": True,
        "code": code,
        "duration_minutes": promo.allowed_duration_minutes or duration,
        "message": f"Your first {promo.allowed_duration_minutes or duration}-minute session is free (booked or Talk now)",
    }


def send_user_welcome_promo_email(
    *,
    to_email: str,
    full_name: str,
    code: str,
    duration_minutes: int,
    preferred_language: str | None = None,
) -> bool:
    if not smtp_is_configured():
        logger.info("SMTP not configured; skipping welcome promo email to %s", to_email)
        return False

    name = (full_name or "").strip() or "there"
    lang = (preferred_language or "en").strip().lower()[:2]
    if lang == "nl":
        subject = f"Welkom! Je eerste {duration_minutes}-minuten sessie is gratis"
        body = f"""Hoi {name},

Welkom bij Mijn Levenspad! Als nieuwe gebruiker krijg je je eerste {duration_minutes}-minuten geboekte consult gratis.

Gebruik code {code} bij het afrekenen van een {duration_minutes}-minuten sessie. Verlengingen daarna zijn tegen betaling.

Veel succes op je pad!
Mijn Levenspad
"""
    else:
        subject = f"Welcome! Your first {duration_minutes}-minute session is free"
        body = f"""Hi {name},

Welcome to Mijn Levenspad! As a new user, your first {duration_minutes}-minute booked consultation is free.

Use code {code} when checking out a {duration_minutes}-minute session. Any extension after that is paid separately.

We wish you well on your path,
Mijn Levenspad
"""
    try:
        return send_plain_email(to_email=to_email, subject=subject, body=body)
    except Exception:
        logger.exception("Failed to send welcome promo email to %s", to_email)
        return False
