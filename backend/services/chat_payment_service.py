from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from core.chat_states import CHAT_PURCHASE_PENDING, CHAT_PURCHASE_SUCCEEDED
from core.config import settings
from core.security import new_uuid
from models.chat_purchase import ChatPurchase
from services.fx_checkout import eur_to_checkout_amount
from services.mollie_service import _apply_chat_purchase_paid, create_mollie_payment
from services.promo_service import PromoError, apply_promo_code, calculate_discount, validate_promo_code


def create_chat_purchase_checkout(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    mentor_id: str,
    minutes: int,
    amount_eur_base: Decimal,
    checkout_currency: str,
    redirect_url: str,
    webhook_url: str | None,
    is_extension: bool,
    promo_code: str | None = None,
) -> tuple[ChatPurchase, str]:
    now = datetime.now(timezone.utc)
    transaction_fee = Decimal(str(settings.chat_session_transaction_fee_eur)).quantize(Decimal("0.01"))
    total_due = Decimal(str(amount_eur_base)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    discount_amount = Decimal("0.0")
    normalized_promo = (promo_code or "").strip().upper()

    if normalized_promo and not is_extension:
        session_amount = max(Decimal("0.0"), total_due - transaction_fee)
        promo = validate_promo_code(
            db,
            normalized_promo,
            total_due,
            user_id,
            mentor_id,
            scope="chat",
            duration_minutes=minutes,
        )
        discount_amount = calculate_discount(promo, total_due)

    final_amount = max(Decimal("0.0"), total_due - discount_amount)

    if final_amount <= 0:
        purchase = ChatPurchase(
            id=new_uuid(),
            session_id=session_id,
            user_id=user_id,
            minutes=minutes,
            amount=Decimal("0.0"),
            amount_base_eur=Decimal("0.0"),
            currency="EUR",
            fx_rate_used=None,
            status=CHAT_PURCHASE_SUCCEEDED,
            transaction_id=f"promo_{new_uuid().replace('-', '')}",
            created_at=now,
        )
        db.add(purchase)
        db.flush()
        _apply_chat_purchase_paid(db, purchase)
        apply_promo_code(db, normalized_promo, user_id=user_id, commit=False)
        return purchase, ""

    charged, checkout_ccy, fx_rate = eur_to_checkout_amount(final_amount, checkout_currency)
    amount_base_eur = final_amount
    payment_id, checkout_url = create_mollie_payment(
        amount=charged,
        currency=checkout_ccy,
        description=f"Chat {'extension' if is_extension else 'start'} {session_id[:8]}",
        redirect_url=redirect_url,
        webhook_url=webhook_url,
        metadata={
            "kind": "chat_purchase",
            "session_id": session_id,
            "user_id": user_id,
            "minutes": minutes,
            "is_extension": is_extension,
            "promo_code": normalized_promo,
        },
    )
    purchase = ChatPurchase(
        id=new_uuid(),
        session_id=session_id,
        user_id=user_id,
        minutes=minutes,
        amount=charged,
        amount_base_eur=amount_base_eur,
        currency=checkout_ccy,
        fx_rate_used=fx_rate if checkout_ccy != "EUR" else None,
        status=CHAT_PURCHASE_PENDING,
        transaction_id=payment_id,
        created_at=now,
    )
    db.add(purchase)
    return purchase, checkout_url
