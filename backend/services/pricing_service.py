from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy.orm import Session

from core.config import settings
from models.mentor import Mentor
from models.platform_pricing import PlatformPricing

# Historical platform default in DB; treat as "unset" when app default moved to per-minute coach rate.
_LEGACY_DEFAULT_CHAT_EUR_PER_MIN = Decimal("0.10")
# When DB and env are both still at legacy €0.10 (e.g. stale Settings cache), use current product default.
# Keep aligned with `Settings.session_price_eur_per_minute` default in `core.config`.
_POLICY_CHAT_EUR_PER_MIN = Decimal("0.90")


def effective_chat_price_per_minute_eur(mentor: Any) -> Decimal:
    """
    Public and billing rate per minute.

    Rows still at the legacy default (0.10) are shown and charged at `session_price_eur_per_minute`
    so checkout matches policy without a manual SQL backfill. If settings are also stuck at 0.10,
    fall back to `_POLICY_CHAT_EUR_PER_MIN` so the API does not keep serving the retired default.
    """
    raw = Decimal(str(getattr(mentor, "chat_price_per_minute", 0) or 0)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if raw != _LEGACY_DEFAULT_CHAT_EUR_PER_MIN:
        return raw
    configured = Decimal(str(settings.session_price_eur_per_minute)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if configured != _LEGACY_DEFAULT_CHAT_EUR_PER_MIN:
        return configured
    return _POLICY_CHAT_EUR_PER_MIN


class PricingError(Exception):
    def __init__(self, message: str, code: str = "pricing_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def get_platform_pricing(db: Session) -> PlatformPricing:
    pricing = db.query(PlatformPricing).order_by(PlatformPricing.created_at.asc()).first()
    if not pricing:
        raise PricingError("Platform pricing is not configured", "pricing_not_configured")
    return pricing


def get_active_platform_pricing(db: Session) -> PlatformPricing:
    pricing = get_platform_pricing(db)
    if not pricing.is_active:
        raise PricingError("Platform pricing is not active yet", "pricing_inactive")
    return pricing


def price_for_duration(pricing: PlatformPricing, duration: int) -> Decimal:
    if duration <= 5:
        return Decimal(str(pricing.price_5_min))
    if duration <= 10:
        return Decimal(str(pricing.price_10_min))
    if duration <= 20:
        return Decimal(str(pricing.price_20_min))
    return Decimal(str(pricing.price_30_min))


def active_price_for_duration(db: Session, duration: int) -> Decimal:
    pricing = get_active_platform_pricing(db)
    return price_for_duration(pricing, duration)


def booking_transaction_fee_eur() -> Decimal:
    """Fixed platform fee added at booking checkout (shown on payment page, not in coach rate)."""
    return Decimal(str(settings.chat_session_transaction_fee_eur)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def booking_base_eur_amount(db: Session, *, mentor: Mentor, duration_minutes: int) -> Decimal:
    """
    EUR base for a booked session: coach per-minute rate × slot length when chat pricing is enabled,
    otherwise legacy platform tier row (5/10/20/30 packages).
    """
    d = int(duration_minutes)
    rate = effective_chat_price_per_minute_eur(mentor)
    if rate > 0:
        return (rate * Decimal(d)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return active_price_for_duration(db, d)
