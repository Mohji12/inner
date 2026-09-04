from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.promo_code import PromoCode
from models.promo_code_redemption import PromoCodeRedemption
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from core.chat_states import CHAT_PURCHASE_SUCCEEDED
from core.booking_states import STATUS_COMPLETED, STATUS_CONFIRMED

PromoScope = Literal["booking", "onboarding", "chat", "all"]


class PromoError(Exception):
    pass


def user_has_redeemed_promo(db: Session, user_id: str, promo: PromoCode) -> bool:
    return (
        db.query(PromoCodeRedemption)
        .filter(
            PromoCodeRedemption.user_id == user_id,
            PromoCodeRedemption.promo_code_id == promo.id,
        )
        .first()
        is not None
    )


def _chat_purchase_counts_as_prior_paid_session(purchase: ChatPurchase) -> bool:
    """Ignore abandoned checkouts, €0 promo bypasses, and Mollie test-mode payments."""
    if purchase.status != CHAT_PURCHASE_SUCCEEDED:
        return False
    amount = purchase.amount_base_eur if purchase.amount_base_eur is not None else purchase.amount
    if Decimal(str(amount or 0)) <= 0:
        return False
    tid = (purchase.transaction_id or "").strip().lower()
    if tid.startswith("promo_"):
        return False
    if tid.startswith("tr_test_"):
        return False
    return True


def user_has_completed_booking(db: Session, user_id: str) -> bool:
    return (
        db.query(Booking)
        .filter(
            Booking.user_id == user_id,
            Booking.status.in_([STATUS_CONFIRMED, STATUS_COMPLETED]),
        )
        .first()
        is not None
    )


def user_has_completed_paid_chat(db: Session, user_id: str) -> bool:
    purchases = (
        db.query(ChatPurchase)
        .filter(
            ChatPurchase.user_id == user_id,
            ChatPurchase.status == CHAT_PURCHASE_SUCCEEDED,
        )
        .all()
    )
    return any(_chat_purchase_counts_as_prior_paid_session(p) for p in purchases)


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
    scope: Literal["booking", "onboarding", "chat"] = "booking",
    duration_minutes: int | None = None,
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

    if scope in ("booking", "chat") and promo.mentor_id and promo.mentor_id != mentor_id:
        raise PromoError("Promo code is not valid for this mentor")

    allowed_duration = getattr(promo, "allowed_duration_minutes", None)
    if scope in ("booking", "chat") and allowed_duration is not None:
        if duration_minutes is None:
            raise PromoError(f"Promo code is valid for {allowed_duration}-minute sessions only")
        if int(duration_minutes) != int(allowed_duration):
            raise PromoError(f"Promo code is valid for {allowed_duration}-minute sessions only")

    if promo.first_time_only and user_id:
        if user_has_redeemed_promo(db, user_id, promo):
            raise PromoError("You have already used this promo code")
        if user_has_completed_booking(db, user_id):
            raise PromoError("Promo code is for first-time users only")
        if user_has_completed_paid_chat(db, user_id):
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

def apply_promo_code(
    db: Session,
    code: str,
    *,
    user_id: str | None = None,
    booking_id: str | None = None,
    commit: bool = True,
) -> None:
    """
    Increments the usage count of a promo code and records a per-user redemption.
    Call this when payment is successful.
    """
    normalized_code = code.strip().upper()
    if not normalized_code:
        return

    promo = db.query(PromoCode).filter(PromoCode.code == normalized_code).with_for_update().first()
    if not promo:
        return

    if user_id and not user_has_redeemed_promo(db, user_id, promo):
        db.add(
            PromoCodeRedemption(
                id=new_uuid(),
                user_id=user_id,
                promo_code_id=promo.id,
                booking_id=booking_id,
                created_at=datetime.now(timezone.utc),
            )
        )
        db.flush()

    promo.current_uses += 1
    if commit:
        db.commit()
    else:
        db.flush()


def reverse_promo_redemption_for_booking(
    db: Session,
    booking_id: str,
    *,
    commit: bool = False,
) -> bool:
    """
    Undo a checkout redemption for a booking (e.g. coach no-show).

    Deletes the per-user redemption row and decrements promo.current_uses so
    first-time codes like WELCOME5 become usable again.
    """
    if not booking_id:
        return False

    redemptions = (
        db.query(PromoCodeRedemption)
        .filter(PromoCodeRedemption.booking_id == booking_id)
        .with_for_update()
        .all()
    )
    if not redemptions:
        return False

    reversed_any = False
    for redemption in redemptions:
        promo = (
            db.query(PromoCode)
            .filter(PromoCode.id == redemption.promo_code_id)
            .with_for_update()
            .first()
        )
        db.delete(redemption)
        if promo and promo.current_uses > 0:
            promo.current_uses -= 1
        reversed_any = True

    if reversed_any:
        if commit:
            db.commit()
        else:
            db.flush()
    return reversed_any
