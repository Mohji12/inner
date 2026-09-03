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
from services.pricing_service import booking_transaction_fee_eur
from services.wallet_service import credit_wallet

WALLET_TOPUP_MIN_EUR = Decimal("5.00")
WALLET_TOPUP_MAX_EUR = Decimal("500.00")
WALLET_TOPUP_CURRENCY = "EUR"
WALLET_TOPUP_REFERENCE_TYPE = "deposit"


def wallet_topup_fee_eur() -> Decimal:
    """Fixed Mollie checkout fee; not credited to the wallet."""
    return booking_transaction_fee_eur()


def wallet_topup_charge_eur(credit_amount: Decimal) -> Decimal:
    return q2(q2(credit_amount) + wallet_topup_fee_eur())


def resolve_wallet_topup_credit_amount(payment_data: dict[str, Any]) -> tuple[Decimal | None, str]:
    """Wallet credit is the chosen amount, never the Mollie total that includes the fee."""
    metadata = payment_data.get("metadata") or {}
    currency = str(metadata.get("currency") or WALLET_TOPUP_CURRENCY).strip().upper() or WALLET_TOPUP_CURRENCY
    for key in ("credit_amount", "amount"):
        raw = metadata.get(key)
        if raw is None or not str(raw).strip():
            continue
        credit = q2(Decimal(str(raw)))
        if credit > 0:
            return credit, currency

    parsed = parse_amount_from_mollie_payload(payment_data)
    if not parsed:
        return None, currency
    charged, parsed_ccy = parsed
    charged = q2(charged)
    if parsed_ccy:
        currency = str(parsed_ccy).strip().upper() or currency
    has_fee_meta = bool(
        str(metadata.get("charge_amount") or "").strip()
        or str(metadata.get("transaction_fee") or "").strip()
    )
    if has_fee_meta:
        credit = q2(charged - wallet_topup_fee_eur())
        if credit > 0:
            return credit, currency
    if charged > 0:
        return charged, currency
    return None, currency


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
    amount, currency = resolve_wallet_topup_credit_amount(payment_data)
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
