from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from sqlalchemy.orm import Session

from models.promo_code import PromoCode
from models.booking import Booking

PromoScope = Literal["booking", "onboarding", "all"]


class PromoError(Exception):
    pass


def _promo_scope_matches(promo_scope: str, checkout_scope: str) -> bool:
    normalized = (promo_scope or "booking").strip().lower()
    if normalized == "all":
        return True
    return normalized == checkout_scope


def validate_promo_code(
    db: Session,
    code: str,
    amount: Decimal,
    user_id: str | None,
    mentor_id: str | None = None,
    *,
    scope: Literal["booking", "onboarding"] = "booking",
) -> PromoCode:
    """
    Validates a promo code and returns the PromoCode object if valid, otherwise raises PromoError.
    """
    normalized_code = code.strip().upper()
    if not normalized_code:
        raise PromoError("Invalid promo code")

    promo = db.query(PromoCode).filter(PromoCode.code == normalized_code).first()
    if not promo:
        raise PromoError("Invalid promo code")

    promo_scope = (getattr(promo, "scope", None) or "booking").strip().lower()
    if not _promo_scope_matches(promo_scope, scope):
        if scope == "onboarding":
            raise PromoError("This promo code is for session bookings only. Use COACHFREE for free coach registration.")
        raise PromoError("Promo code is not valid for this checkout")

    if not promo.is_active:
        raise PromoError("Promo code is no longer active")

    now = datetime.now(timezone.utc)
    if promo.expires_at:
        if promo.expires_at.tzinfo is None:
            expires_at_aware = promo.expires_at.replace(tzinfo=timezone.utc)
        else:
            expires_at_aware = promo.expires_at

        if now > expires_at_aware:
            raise PromoError("Promo code has expired")

    if promo.max_uses and promo.current_uses >= promo.max_uses:
        raise PromoError("Promo code usage limit reached")

    if promo.min_order_amount and amount < promo.min_order_amount:
        raise PromoError(f"Minimum order amount of {promo.min_order_amount} required")

    if scope == "booking" and promo.mentor_id and promo.mentor_id != mentor_id:
        raise PromoError("Promo code is not valid for this mentor")

    if promo.first_time_only and user_id:
        has_bookings = db.query(Booking).filter(
            Booking.user_id == user_id,
            Booking.status.in_(["confirmed", "completed"]),
        ).first()
        if has_bookings:
            raise PromoError("Promo code is for first-time users only")

    return promo

def calculate_discount(promo: PromoCode, amount: Decimal) -> Decimal:
    """
    Calculates the discount amount based on the promo code rules.
    """
    if promo.discount_type == "percentage":
        discount = (amount * promo.discount_value) / Decimal("100.0")
        return min(discount, amount) # Can't discount more than total
    elif promo.discount_type == "fixed":
        return min(promo.discount_value, amount)
    return Decimal("0.0")

def apply_promo_code(db: Session, code: str, *, commit: bool = True) -> None:
    """
    Increments the usage count of a promo code.
    Call this when payment is successful.
    """
    normalized_code = code.strip().upper()
    if not normalized_code:
        return

    promo = db.query(PromoCode).filter(PromoCode.code == normalized_code).with_for_update().first()
    if promo:
        promo.current_uses += 1
        if commit:
            db.commit()
        else:
            db.flush()
