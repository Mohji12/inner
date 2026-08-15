"""Settle Mollie wallet top-ups into the simple wallet + marketplace ledger."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from core.security import new_uuid
from models.marketplace import AuditLog
from models.wallet import WalletTransaction
from services.fx_checkout import parse_amount_from_mollie_payload
from services.ledger_service import credit_user_wallet_topup, q2
from services.wallet_service import credit_wallet

WALLET_TOPUP_MIN_EUR = Decimal("5.00")
WALLET_TOPUP_MAX_EUR = Decimal("500.00")
WALLET_TOPUP_CURRENCY = "EUR"
WALLET_TOPUP_REFERENCE_TYPE = "deposit"


def settle_wallet_topup(
    db: Session,
    *,
    mollie_payment_id: str,
    payment_data: dict[str, Any],
) -> dict[str, str]:
    """Credit both wallets when a Mollie wallet_topup payment is paid. Idempotent."""
    status_str = str(payment_data.get("status") or "unknown")
    metadata = payment_data.get("metadata") or {}
    if str(metadata.get("kind") or "") != "wallet_topup":
        return {"status": status_str, "type": "unmatched"}
    if status_str != "paid":
        return {"status": status_str, "type": "wallet_topup"}

    user_id = str(metadata.get("user_id") or "").strip()
    currency = str(metadata.get("currency") or WALLET_TOPUP_CURRENCY).strip().upper() or WALLET_TOPUP_CURRENCY
    amount_raw = metadata.get("amount")
    amount: Decimal | None = None
    if amount_raw is not None and str(amount_raw).strip():
        amount = q2(Decimal(str(amount_raw)))
    if amount is None or amount <= 0:
        parsed = parse_amount_from_mollie_payload(payment_data)
        if parsed:
            amount, parsed_ccy = parsed
            amount = q2(amount)
            if parsed_ccy:
                currency = str(parsed_ccy).strip().upper() or currency
    if not user_id or amount is None or amount <= 0:
        return {"status": status_str, "type": "wallet_topup"}

    credit_user_wallet_topup(
        db,
        user_id=user_id,
        amount=amount,
        currency=currency,
        external_payment_id=mollie_payment_id,
    )

    existing = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.reference_type == WALLET_TOPUP_REFERENCE_TYPE,
            WalletTransaction.reference_id == mollie_payment_id,
        )
        .first()
    )
    if not existing:
        credit_wallet(
            db,
            user_id,
            amount,
            description="Wallet top-up",
            reference_type=WALLET_TOPUP_REFERENCE_TYPE,
            reference_id=mollie_payment_id,
        )

    db.add(
        AuditLog(
            id=new_uuid(),
            actor_role="system",
            actor_id="system",
            action="wallet.topup.settled",
            entity_type="mollie_payment",
            entity_id=mollie_payment_id,
            details_json={"user_id": user_id, "amount": str(amount), "currency": currency},
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return {"status": status_str, "type": "wallet_topup"}
