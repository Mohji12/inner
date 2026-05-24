from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from core.chat_states import CHAT_PURCHASE_PENDING
from core.security import new_uuid
from models.chat_purchase import ChatPurchase
from services.fx_checkout import eur_to_checkout_amount
from services.mollie_service import create_mollie_payment


def create_chat_purchase_checkout(
    db: Session,
    *,
    session_id: str,
    user_id: str,
    minutes: int,
    amount_eur_base: Decimal,
    checkout_currency: str,
    redirect_url: str,
    webhook_url: str | None,
    is_extension: bool,
) -> tuple[ChatPurchase, str]:
    now = datetime.now(timezone.utc)
    charged, checkout_ccy, fx_rate = eur_to_checkout_amount(amount_eur_base, checkout_currency)
    amount_base_eur = Decimal(str(amount_eur_base)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
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
