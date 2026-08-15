"""Pay a scheduled booking from wallet credits (simple wallet + ledger)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from core.booking_states import PAYMENT_PAID, PAYMENT_RECORD_SUCCEEDED
from core.security import new_uuid
from models.booking import Booking
from models.payment import Payment
from models.wallet import Wallet, WalletTransaction
from services.ledger_service import (
    ACCOUNT_USER_AVAILABLE,
    OWNER_USER,
    LedgerError,
    get_account_balance,
    get_or_create_wallet_account,
    q2,
    spend_user_available_for_booking,
)
from services.mollie_service import _mark_booking_paid
from services.pricing_service import PricingError, booking_base_eur_amount, booking_transaction_fee_eur
from services.promo_service import PromoError, apply_promo_code, calculate_discount, validate_promo_code
from services.wallet_service import WalletError, debit_wallet, get_or_create_wallet

WALLET_PAY_GATEWAY = "wallet"
WALLET_PAY_CURRENCY = "EUR"
BOOKING_WALLET_REF_TYPE = "booking"


class WalletPaymentError(Exception):
    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class WalletBookingPayResult:
    payment: Payment
    amount: Decimal
    currency: str
    booking_id: str


def _wallet_transaction_id(booking_id: str) -> str:
    return f"wallet_{booking_id}"


def _existing_booking_debit(db: Session, *, wallet_id: str, booking_id: str) -> WalletTransaction | None:
    return (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.wallet_id == wallet_id,
            WalletTransaction.reference_type == BOOKING_WALLET_REF_TYPE,
            WalletTransaction.reference_id == booking_id,
            WalletTransaction.type == "debit",
        )
        .first()
    )


def _result_from_payment(payment: Payment) -> WalletBookingPayResult:
    amount = q2(payment.amount_base_eur if payment.amount_base_eur is not None else payment.amount)
    return WalletBookingPayResult(
        payment=payment,
        amount=amount,
        currency=(payment.currency or WALLET_PAY_CURRENCY).upper(),
        booking_id=payment.booking_id,
    )


def pay_booking_with_wallet(
    db: Session,
    *,
    user_id: str,
    booking_id: str,
    promo_code: str | None = None,
) -> WalletBookingPayResult:
    """Debit both wallets, record a Payment, and confirm the booking. Does not commit."""
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise WalletPaymentError("Booking not found", status_code=404)
    if booking.user_id != user_id:
        raise WalletPaymentError("Forbidden", status_code=403)

    existing_wallet_payment = (
        db.query(Payment).filter(Payment.transaction_id == _wallet_transaction_id(booking_id)).first()
    )
    if existing_wallet_payment:
        if existing_wallet_payment.status != PAYMENT_RECORD_SUCCEEDED:
            _mark_booking_paid(db, existing_wallet_payment)
        return _result_from_payment(existing_wallet_payment)

    if booking.payment_status == PAYMENT_PAID:
        paid = db.query(Payment).filter(Payment.id == booking.payment_id).first() if booking.payment_id else None
        if paid:
            return _result_from_payment(paid)
        raise WalletPaymentError("Booking is already paid")

    mentor = booking.mentor
    try:
        base_amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=booking.duration)
    except PricingError as e:
        raise WalletPaymentError(e.message) from e

    transaction_fee = booking_transaction_fee_eur()
    total_due = q2(base_amount + transaction_fee)
    discount_amount = Decimal("0.0")
    normalized_promo = (promo_code or "").strip() or None
    if normalized_promo:
        try:
            promo = validate_promo_code(db, normalized_promo, total_due, user_id, mentor.id)
            discount_amount = calculate_discount(promo, total_due)
        except PromoError as e:
            raise WalletPaymentError(str(e)) from e

    final_amount = q2(max(Decimal("0.0"), total_due - discount_amount))

    wallet = get_or_create_wallet(db, user_id, commit=False)
    already_debited = _existing_booking_debit(db, wallet_id=wallet.id, booking_id=booking_id)

    if final_amount > 0:
        if not already_debited:
            wallet = db.query(Wallet).filter(Wallet.id == wallet.id).with_for_update().first() or wallet
            if q2(wallet.balance) < final_amount:
                raise WalletPaymentError("Insufficient wallet balance")
            user_available = get_or_create_wallet_account(
                db,
                owner_type=OWNER_USER,
                owner_id=user_id,
                account_kind=ACCOUNT_USER_AVAILABLE,
                currency=WALLET_PAY_CURRENCY,
            )
            ledger_balance = get_account_balance(db, user_available.id)
            if ledger_balance < final_amount:
                raise WalletPaymentError("Insufficient wallet balance")
        try:
            spend_user_available_for_booking(
                db,
                user_id=user_id,
                amount=final_amount,
                currency=WALLET_PAY_CURRENCY,
                booking_id=booking_id,
            )
        except LedgerError as e:
            msg = str(e)
            if "Insufficient" in msg:
                raise WalletPaymentError("Insufficient wallet balance") from e
            raise WalletPaymentError(msg) from e
        if not already_debited:
            try:
                debit_wallet(
                    db,
                    user_id=user_id,
                    amount=final_amount,
                    description="Booking payment",
                    reference_type=BOOKING_WALLET_REF_TYPE,
                    reference_id=booking_id,
                    commit=False,
                )
            except WalletError as e:
                msg = str(e)
                if "Insufficient" in msg:
                    raise WalletPaymentError("Insufficient wallet balance") from e
                raise WalletPaymentError(msg) from e

    payment = Payment(
        id=new_uuid(),
        user_id=user_id,
        booking_id=booking.id,
        amount=final_amount,
        amount_base_eur=final_amount,
        currency=WALLET_PAY_CURRENCY,
        payment_gateway=WALLET_PAY_GATEWAY,
        transaction_id=_wallet_transaction_id(booking_id),
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.flush()
    if normalized_promo:
        apply_promo_code(db, normalized_promo, commit=False)
    _mark_booking_paid(db, payment)

    return _result_from_payment(payment)
