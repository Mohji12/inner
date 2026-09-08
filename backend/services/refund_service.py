from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from core.booking_states import PAYMENT_RECORD_SUCCEEDED
from core.security import new_uuid
from models.booking import Booking
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.marketplace import AuditLog
from models.payment import Payment
from models.wallet import WalletTransaction
from services.booking_slot_service import release_booking_slot
from services.ledger_service import (
    q2,
    refund_user_wallet_for_booking,
    refund_user_wallet_for_chat,
)
from services.live_session_service import booking_for_chat_session, chat_session_for_booking
from services.notification_service import create_notification
from services.promo_service import reverse_promo_redemption_for_booking
from services.wallet_service import credit_wallet

logger = logging.getLogger(__name__)

SUCCESS_PAYMENT_STATUSES = (PAYMENT_RECORD_SUCCEEDED, "paid")
BOOKING_REFUND_REF_TYPE = "booking_refund"
CHAT_REFUND_REF_TYPE = "chat_refund"


def session_was_coach_no_show(session: ChatSession) -> bool:
    """Return True if session ended/is ending and coach never joined."""
    if session.mentor_joined_at is not None:
        return False
    if session.timer_started_at is not None:
        return False
    return True


def refund_session_to_user_wallet(
    db: Session,
    *,
    session: ChatSession,
    actor_user_id: str | None = None,
    commit: bool = False,
) -> dict:
    """
    If the coach failed to join and the user ends the session (or session expires unattended),
    refund the full payment (wallet or card transaction) back to the user's wallet.
    Idempotent: will not double-refund if already refunded.
    """
    if not session_was_coach_no_show(session):
        return {"refunded": False, "reason": "coach_joined"}

    user_id = session.user_id
    if not user_id:
        return {"refunded": False, "reason": "no_user"}

    now = datetime.now(timezone.utc)
    booking = booking_for_chat_session(db, session.id)

    if booking:
        return _refund_booking_session(
            db,
            session=session,
            booking=booking,
            user_id=user_id,
            now=now,
            commit=commit,
        )

    return _refund_instant_chat_session(
        db,
        session=session,
        user_id=user_id,
        now=now,
        commit=commit,
    )


def refund_booking_to_user_wallet_direct(
    db: Session,
    *,
    booking: Booking,
    commit: bool = False,
) -> dict:
    """Directly refund a booking to user wallet when coach misses."""
    session = chat_session_for_booking(db, booking)
    if session and not session_was_coach_no_show(session):
        return {"refunded": False, "reason": "coach_joined"}
    user_id = booking.user_id
    if not user_id:
        return {"refunded": False, "reason": "no_user"}
    now = datetime.now(timezone.utc)
    return _refund_booking_session(
        db,
        session=session,
        booking=booking,
        user_id=user_id,
        now=now,
        commit=commit,
    )


def _refund_booking_session(
    db: Session,
    *,
    session: ChatSession | None,
    booking: Booking,
    user_id: str,
    now: datetime,
    commit: bool,
) -> dict:
    # 1. Check idempotency: has this booking already been refunded?
    existing_refund = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.reference_type == BOOKING_REFUND_REF_TYPE,
            WalletTransaction.reference_id == booking.id,
        )
        .first()
    )
    if existing_refund:
        return {
            "refunded": True,
            "already_refunded": True,
            "amount": float(existing_refund.amount),
            "currency": "EUR",
            "booking_id": booking.id,
        }

    # 2. Find payment record
    payment = (
        db.query(Payment)
        .filter(
            Payment.booking_id == booking.id,
            Payment.status.in_(SUCCESS_PAYMENT_STATUSES),
        )
        .order_by(Payment.created_at.desc())
        .first()
    )

    amount = Decimal("0.00")
    currency = "EUR"
    if payment:
        raw_amount = payment.amount_base_eur if payment.amount_base_eur is not None else payment.amount
        amount = q2(Decimal(str(raw_amount or 0)))
        currency = (payment.currency or "EUR").upper()

    coach_name = booking.mentor.full_name if booking.mentor else "coach"
    user_name = booking.user.full_name if booking.user else "the user"

    # 3. If money was paid, credit user's wallet (both ledger and wallet table)
    if amount > 0:
        try:
            refund_user_wallet_for_booking(
                db,
                user_id=user_id,
                amount=amount,
                currency=currency,
                booking_id=booking.id,
                reason="coach_no_show",
            )
        except Exception as e:
            logger.warning("Ledger refund for booking %s failed: %s", booking.id, e)

        credit_wallet(
            db,
            user_id=user_id,
            amount=amount,
            description=f"Refund for session with {coach_name} (coach did not join)",
            reference_type=BOOKING_REFUND_REF_TYPE,
            reference_id=booking.id,
            commit=False,
        )

        if payment:
            payment.status = "refunded"

        db.add(
            AuditLog(
                id=new_uuid(),
                actor_role="system",
                actor_id="system",
                action="session.refunded.coach_no_show",
                entity_type="booking",
                entity_id=booking.id,
                details_json={
                    "user_id": user_id,
                    "mentor_id": booking.mentor_id,
                    "amount": str(amount),
                    "currency": currency,
                    "payment_id": payment.id if payment else None,
                },
                created_at=now,
            )
        )

    # 4. Update booking status to unattended, coach no-show
    booking.status = "unattended"
    booking.no_show_by = "mentor"
    try:
        release_booking_slot(db, booking)
    except Exception as e:
        logger.warning("Release booking slot for %s failed: %s", booking.id, e)

    # 5. Reverse any promo code redemption (WELCOME5 etc.)
    reverse_promo_redemption_for_booking(db, booking.id, commit=False)

    # 6. Send notifications
    if amount > 0:
        create_notification(
            db,
            user_id=user_id,
            type="session_refunded",
            title="Session Refunded to Wallet",
            body=f"€{amount:.2f} has been refunded to your wallet because {coach_name} did not join the session.",
            link="/user/wallet",
            commit=False,
        )
    else:
        create_notification(
            db,
            user_id=user_id,
            type="session_unattended",
            title="Session Cancelled",
            body=f"Your session with {coach_name} was cancelled because the coach did not join. Any promo code used has been restored.",
            link="/user/appointments",
            commit=False,
        )

    create_notification(
        db,
        mentor_id=booking.mentor_id,
        type="session_unattended",
        title="Session Missed",
        body=f"The session with {user_name} was marked as unattended and refunded because you did not join.",
        link="/mentor/appointments",
        commit=False,
    )

    if commit:
        db.commit()

    return {
        "refunded": True,
        "already_refunded": False,
        "amount": float(amount),
        "currency": currency,
        "booking_id": booking.id,
    }


def _refund_instant_chat_session(
    db: Session,
    *,
    session: ChatSession,
    user_id: str,
    now: datetime,
    commit: bool,
) -> dict:
    existing_refund = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.reference_type == CHAT_REFUND_REF_TYPE,
            WalletTransaction.reference_id == session.id,
        )
        .first()
    )
    if existing_refund:
        return {
            "refunded": True,
            "already_refunded": True,
            "amount": float(existing_refund.amount),
            "currency": "EUR",
            "session_id": session.id,
        }

    purchases = (
        db.query(ChatPurchase)
        .filter(
            ChatPurchase.session_id == session.id,
            ChatPurchase.status == "succeeded",
        )
        .all()
    )

    total_refund = Decimal("0.00")
    for p in purchases:
        raw_amt = p.amount_base_eur if p.amount_base_eur is not None else p.amount
        total_refund += q2(Decimal(str(raw_amt or 0)))

    if total_refund > 0:
        try:
            refund_user_wallet_for_chat(
                db,
                user_id=user_id,
                amount=total_refund,
                currency="EUR",
                session_id=session.id,
                reason="coach_no_show",
            )
        except Exception as e:
            logger.warning("Ledger refund for chat %s failed: %s", session.id, e)

        coach_name = session.mentor.full_name if session.mentor else "coach"
        credit_wallet(
            db,
            user_id=user_id,
            amount=total_refund,
            description=f"Refund for chat session with {coach_name} (coach did not join)",
            reference_type=CHAT_REFUND_REF_TYPE,
            reference_id=session.id,
            commit=False,
        )

        for p in purchases:
            p.status = "refunded"

        create_notification(
            db,
            user_id=user_id,
            type="session_refunded",
            title="Chat Session Refunded to Wallet",
            body=f"€{total_refund:.2f} has been refunded to your wallet because your coach did not join the chat.",
            link="/user/wallet",
            commit=False,
        )

    if commit:
        db.commit()

    return {
        "refunded": total_refund > 0,
        "already_refunded": False,
        "amount": float(total_refund),
        "currency": "EUR",
        "session_id": session.id,
    }
