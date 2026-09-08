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
    """
    Check if user has an effective redemption for this promo code.
    If a previous redemption belonged to a booking where the coach missed,
    was unattended, or coach never joined, it does NOT count as redeemed.
    """
    query = db.query(PromoCodeRedemption).filter(
        PromoCodeRedemption.user_id == user_id,
        PromoCodeRedemption.promo_code_id == promo.id,
    )
    raw_redemptions = query.all()
    if isinstance(raw_redemptions, (list, tuple)) and raw_redemptions:
        redemptions = raw_redemptions
    else:
        first_r = query.first()
        redemptions = [first_r] if first_r else []

    if not redemptions:
        return False

    for r in redemptions:
        booking_id = getattr(r, "booking_id", None)
        if not booking_id:
            return True
        b = db.query(Booking).filter(Booking.id == booking_id).first()
        if not b:
            continue
        if getattr(b, "no_show_by", None) == "mentor" or getattr(b, "status", None) in ("unattended", "cancelled"):
            continue
        try:
            from services.live_session_service import chat_session_for_booking
            cs = chat_session_for_booking(db, b)
            if cs and cs.mentor_joined_at is None and cs.timer_started_at is None and cs.status == "ended":
                continue
        except Exception:
            pass
        return True
    return False


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
    """
    Return True if user has completed a live booking session where the coach actually participated.
    Bookings where the coach did not join (no-show / unattended / cancelled) do NOT count as completed.
    """
    query = db.query(Booking).filter(
        Booking.user_id == user_id,
        Booking.status.in_([STATUS_CONFIRMED, STATUS_COMPLETED]),
    )
    raw_bookings = query.all()
    if isinstance(raw_bookings, (list, tuple)) and raw_bookings:
        bookings = raw_bookings
    else:
        first_b = query.first()
        bookings = [first_b] if first_b else []

    if not bookings:
        return False

    from services.live_session_service import chat_session_for_booking

    for b in bookings:
        b_status = getattr(b, "status", None)
        no_show_by = getattr(b, "no_show_by", None)
        if no_show_by == "mentor" or b_status in ("unattended", "cancelled"):
            continue
        try:
            cs = chat_session_for_booking(db, b)
        except Exception:
            cs = None
        if cs is not None:
            if cs.mentor_joined_at is None and cs.timer_started_at is None:
                continue
        return True
    return False


def user_has_completed_paid_chat(db: Session, user_id: str) -> bool:
    """
    Return True if user has completed a paid chat session where the coach actually participated.
    """
    purchases = (
        db.query(ChatPurchase)
        .filter(
            ChatPurchase.user_id == user_id,
            ChatPurchase.status == CHAT_PURCHASE_SUCCEEDED,
        )
        .all()
    )
    for p in purchases:
        if not _chat_purchase_counts_as_prior_paid_session(p):
            continue
        if p.session_id:
            from models.chat_session import ChatSession
            cs = db.query(ChatSession).filter(ChatSession.id == p.session_id).first()
            if cs and cs.mentor_joined_at is None and cs.timer_started_at is None and cs.status == "ended":
                continue
        return True
    return False


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

    One redemption row exists per (user, promo). Retries and forgiven prior bookings
    rebind that row to the new booking_id instead of inserting a duplicate.
    """
    from sqlalchemy.exc import IntegrityError

    normalized_code = code.strip().upper()
    if not normalized_code:
        return

    promo = db.query(PromoCode).filter(PromoCode.code == normalized_code).with_for_update().first()
    if not promo:
        return

    now = datetime.now(timezone.utc)

    if user_id:
        existing = (
            db.query(PromoCodeRedemption)
            .filter(
                PromoCodeRedemption.user_id == user_id,
                PromoCodeRedemption.promo_code_id == promo.id,
            )
            .with_for_update()
            .first()
        )
        if existing:
            # Same checkout retry, or rebind after a forgiven prior booking.
            if existing.booking_id != booking_id:
                existing.booking_id = booking_id
                existing.created_at = now
            if commit:
                db.commit()
            else:
                db.flush()
            return

        db.add(
            PromoCodeRedemption(
                id=new_uuid(),
                user_id=user_id,
                promo_code_id=promo.id,
                booking_id=booking_id,
                created_at=now,
            )
        )
        try:
            db.flush()
        except IntegrityError as exc:
            raise PromoError("You have already used this promo code") from exc

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
