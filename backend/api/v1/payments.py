from decimal import Decimal
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from datetime import datetime, timezone

from database import get_db
from api.deps import get_current_user, AnyActorDep, AnyActor
from models.user import User
from models.chat_purchase import ChatPurchase
from models.mentor_onboarding_payment import MentorOnboardingPayment
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from models.booking import Booking
from models.payment import Payment
from core.security import new_uuid
from services.mollie_service import (
    MollieServiceError,
    create_mollie_payment,
    get_mollie_payment,
    parse_webhook_payment_id,
    process_mollie_webhook_by_payment_id,
    resolve_mollie_webhook_url,
    verify_mollie_webhook_signature,
)
from services.ledger_service import credit_user_wallet_topup, q2
from services.marketplace_service import (
    audit_log,
    record_webhook_event,
    verify_generic_hmac_signature,
)
from services.promo_service import validate_promo_code, calculate_discount, apply_promo_code
from services.mollie_service import _mark_booking_paid
from services.pricing_service import PricingError, booking_base_eur_amount, booking_transaction_fee_eur
from core.config import settings
from services.fx_checkout import (
    FxCheckoutError,
    FxUpstreamError,
    eur_to_checkout_amount,
    normalized_checkout_currency_list,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["Payments"])


class CheckoutCurrenciesResponse(BaseModel):
    currencies: list[str]


class CreateIntentRequest(BaseModel):
    booking_id: str
    promo_code: str | None = None
    checkout_currency: str | None = None


class CreateIntentResponse(BaseModel):
    checkout_url: str
    payment_id: str
    amount: float
    currency: str


class BookingCheckoutPreview(BaseModel):
    session_amount_eur: float
    transaction_fee_eur: float
    total_eur: float


class SyncMolliePaymentIn(BaseModel):
    mollie_payment_id: str


class WalletTopupIntentIn(BaseModel):
    amount: Decimal
    currency: str = "EUR"


class WalletTopupIntentOut(BaseModel):
    checkout_url: str
    mollie_payment_id: str
    amount: Decimal
    currency: str


def _ensure_actor_can_sync_mollie_payment(db: Session, actor: AnyActor, payment_id: str) -> None:
    if actor.role == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin cannot sync via this endpoint")
    bp = db.query(Payment).filter(Payment.transaction_id == payment_id).first()
    if bp:
        if actor.role != "user" or bp.user_id != actor.subject_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your payment")
        return
    cp = db.query(ChatPurchase).filter(ChatPurchase.transaction_id == payment_id).first()
    if cp:
        if actor.role != "user" or cp.user_id != actor.subject_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your chat payment")
        return
    ob = db.query(MentorOnboardingPayment).filter(MentorOnboardingPayment.mollie_payment_id == payment_id).first()
    if ob:
        if actor.role != "mentor" or ob.mentor_id != actor.subject_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your onboarding payment")
        return
    inv = db.query(MentorMonthlyInvoice).filter(MentorMonthlyInvoice.mollie_payment_id == payment_id).first()
    if inv:
        if actor.role != "mentor" or inv.mentor_id != actor.subject_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not your invoice payment")
        return
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Payment not tied to your account")


@router.post("/wallet/topup-intent", response_model=WalletTopupIntentOut)
def create_wallet_topup_intent(
    request: Request,
    body: WalletTopupIntentIn,
    actor: AnyActorDep,
    db: Session = Depends(get_db),
) -> WalletTopupIntentOut:
    if actor.role != "user":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only users can top up wallet")
    amount = q2(body.amount)
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    currency = (body.currency or "EUR").strip().upper()
    redirect_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/user/wallet?topup=success"
    webhook_url = resolve_mollie_webhook_url(request)
    try:
        mollie_payment_id, checkout_url = create_mollie_payment(
            amount=amount,
            currency=currency,
            description=f"Wallet topup {actor.subject_id[:8]}",
            redirect_url=redirect_url,
            webhook_url=webhook_url,
            metadata={
                "kind": "wallet_topup",
                "user_id": actor.subject_id,
                "amount": str(amount),
                "currency": currency,
            },
        )
    except MollieServiceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    audit_log(
        db,
        actor_role="user",
        actor_id=actor.subject_id,
        action="wallet.topup.intent_created",
        entity_type="mollie_payment",
        entity_id=mollie_payment_id,
        details={"amount": str(amount), "currency": currency},
    )
    db.commit()
    return WalletTopupIntentOut(
        checkout_url=checkout_url,
        mollie_payment_id=mollie_payment_id,
        amount=amount,
        currency=currency,
    )


@router.post("/sync-mollie-payment")
def sync_mollie_payment_route(
    body: SyncMolliePaymentIn,
    actor: AnyActorDep,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    When Mollie cannot reach webhookUrl (SPA-only Amplify host, localhost, etc.), the browser
    can call this after redirect so bookings/chats finalize from Mollie API state.
    """
    pid = (body.mollie_payment_id or "").strip()
    if not pid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="mollie_payment_id required")
    _ensure_actor_can_sync_mollie_payment(db, actor, pid)
    return process_mollie_webhook_by_payment_id(db, pid)


@router.get("/checkout-currencies", response_model=CheckoutCurrenciesResponse)
def checkout_currencies():
    return CheckoutCurrenciesResponse(currencies=normalized_checkout_currency_list())


@router.get("/booking-checkout-preview", response_model=BookingCheckoutPreview)
def booking_checkout_preview(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    mentor = booking.mentor
    try:
        session_amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=booking.duration)
    except PricingError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    transaction_fee = booking_transaction_fee_eur()
    return BookingCheckoutPreview(
        session_amount_eur=float(session_amount),
        transaction_fee_eur=float(transaction_fee),
        total_eur=float(session_amount + transaction_fee),
    )


@router.post("/create-intent", response_model=CreateIntentResponse)
def create_intent(
    request: Request,
    req: CreateIntentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    mentor = booking.mentor
    try:
        base_amount = booking_base_eur_amount(db, mentor=mentor, duration_minutes=booking.duration)
    except PricingError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    discount_amount = Decimal("0.0")
    transaction_fee = booking_transaction_fee_eur()
    total_due = base_amount + transaction_fee

    if req.promo_code:
        try:
            promo = validate_promo_code(db, req.promo_code, total_due, current_user.id, mentor.id)
            discount_amount = calculate_discount(promo, total_due)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    final_amount = max(Decimal("0.0"), total_due - discount_amount)

    if final_amount <= 0:
        # Bypass Mollie when session and fee are fully covered (e.g. future fee-waiving promos).
        fake_payment_id = f"promo_{new_uuid().replace('-', '')}"
        payment = Payment(
            id=new_uuid(),
            user_id=current_user.id,
            booking_id=booking.id,
            amount=Decimal("0.0"),
            amount_base_eur=Decimal("0.0"),
            currency="EUR",
            payment_gateway="promo",
            transaction_id=fake_payment_id,
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(payment)

        _mark_booking_paid(db, payment)

        if req.promo_code:
            apply_promo_code(db, req.promo_code)

        db.commit()

        return CreateIntentResponse(
            checkout_url=f"/booking/success?bookingId={booking.id}",
            payment_id=fake_payment_id,
            amount=0.0,
            currency="EUR",
        )

    ccy_req = (req.checkout_currency or "EUR").strip()
    try:
        charged, checkout_ccy, fx_rate = eur_to_checkout_amount(final_amount, ccy_req)
    except FxCheckoutError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FxUpstreamError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    try:
        redirect_url = f"{settings.mollie_redirect_base_url.rstrip('/')}/booking/success?bookingId={booking.id}"
        webhook_url = resolve_mollie_webhook_url(request)
        mollie_payment_id, checkout_url = create_mollie_payment(
            amount=charged,
            currency=checkout_ccy,
            description=f"Booking payment {booking.id[:8]}",
            redirect_url=redirect_url,
            webhook_url=webhook_url,
            metadata={
                "kind": "booking",
                "booking_id": booking.id,
                "user_id": current_user.id,
                "promo_code": req.promo_code or ""
            }
        )
        payment = Payment(
            id=new_uuid(),
            user_id=current_user.id,
            booking_id=booking.id,
            amount=charged,
            amount_base_eur=final_amount,
            currency=checkout_ccy,
            fx_rate_used=fx_rate if checkout_ccy != "EUR" else None,
            payment_gateway="mollie",
            transaction_id=mollie_payment_id,
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        db.commit()
        
        return CreateIntentResponse(
            checkout_url=checkout_url,
            payment_id=mollie_payment_id,
            amount=float(charged),
            currency=checkout_ccy
        )
    except MollieServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def mollie_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("x-mollie-signature")
    sig_valid = verify_mollie_webhook_signature(payload, sig_header) and verify_generic_hmac_signature(
        secret=(settings.mollie_webhook_secret or "").strip(),
        payload=payload,
        signature=sig_header,
    )
    if not sig_valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    form = await request.form()
    payment_id = parse_webhook_payment_id(payload, dict(form))
    event = record_webhook_event(
        db,
        provider="mollie",
        event_key=payment_id,
        event_type="payment.status",
        payload=payload,
        signature_valid=sig_valid,
    )
    if event.processing_status == "processed":
        return {"status": "duplicate", "payment_id": payment_id}
    out = process_mollie_webhook_by_payment_id(db, payment_id)
    payment_data = get_mollie_payment(payment_id)
    metadata = payment_data.get("metadata") or {}
    if metadata.get("kind") == "wallet_topup" and out.get("status") == "paid":
        user_id = str(metadata.get("user_id") or "")
        amount_raw = metadata.get("amount")
        currency = str(metadata.get("currency") or "EUR").upper()
        if user_id and amount_raw:
            credit_user_wallet_topup(
                db,
                user_id=user_id,
                amount=q2(Decimal(str(amount_raw))),
                currency=currency,
                external_payment_id=payment_id,
            )
            audit_log(
                db,
                actor_role="system",
                actor_id="system",
                action="wallet.topup.settled",
                entity_type="mollie_payment",
                entity_id=payment_id,
                details={"user_id": user_id, "amount": str(amount_raw), "currency": currency},
            )
    event.processing_status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return out
