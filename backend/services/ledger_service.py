from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from services.pricing_service import effective_chat_price_per_minute_eur
from core.security import new_uuid
from models.marketplace import (
    CommissionConfig,
    LedgerEntry,
    LedgerTransaction,
    OutboxEvent,
    SessionBillingEvent,
    WalletAccount,
    WalletHold,
)
from models.mentor import Mentor

MONEY_QUANT = Decimal("0.01")

OWNER_PLATFORM = "platform"
OWNER_USER = "user"
OWNER_COACH = "coach"

ACCOUNT_USER_AVAILABLE = "user_available"
ACCOUNT_USER_HOLD = "user_hold"
ACCOUNT_COACH_PENDING = "coach_pending"
ACCOUNT_COACH_WITHDRAWABLE = "coach_withdrawable"
ACCOUNT_PLATFORM_REVENUE = "platform_revenue"
ACCOUNT_PLATFORM_CASH = "platform_cash"


class LedgerError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def q2(amount: Decimal | str | float) -> Decimal:
    return Decimal(str(amount)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def metered_split_amounts(
    gross: Decimal,
    *,
    tax_percent: Decimal,
    platform_percent: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    """Split metered gross: platform fee + optional tax; coach receives the remainder (q2 each leg)."""
    g = q2(gross)
    tax_amt = q2(g * tax_percent / Decimal("100"))
    platform_amt = q2(g * platform_percent / Decimal("100"))
    coach_net = q2(g - tax_amt - platform_amt)
    if coach_net < Decimal("0.00"):
        raise LedgerError("Metered split would make coach net negative; check percentages vs gross.")
    return tax_amt, platform_amt, coach_net


def get_or_create_wallet_account(
    db: Session,
    *,
    owner_type: str,
    owner_id: str,
    account_kind: str,
    currency: str,
) -> WalletAccount:
    """Create wallet row if missing. Avoid FOR UPDATE on a miss — that locks index gaps and deadlocks with concurrent INSERTs."""
    currency_code = (currency or "EUR").upper()
    filt = (
        WalletAccount.owner_type == owner_type,
        WalletAccount.owner_id == owner_id,
        WalletAccount.account_kind == account_kind,
        WalletAccount.currency == currency_code,
    )
    existing = db.query(WalletAccount).filter(*filt).first()
    if existing:
        return (
            db.query(WalletAccount)
            .filter(WalletAccount.id == existing.id)
            .with_for_update()
            .one()
        )

    now = _utcnow()
    try:
        with db.begin_nested():
            account = WalletAccount(
                id=new_uuid(),
                owner_type=owner_type,
                owner_id=owner_id,
                account_kind=account_kind,
                currency=currency_code,
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(account)
            db.flush()
    except IntegrityError:
        account = None
    else:
        return account

    locked = db.query(WalletAccount).filter(*filt).with_for_update().first()
    if not locked:
        raise LedgerError("Could not create or load wallet account")
    return locked


def get_account_balance(db: Session, account_id: str) -> Decimal:
    credit = (
        db.query(func.coalesce(func.sum(LedgerEntry.amount), 0))
        .filter(LedgerEntry.wallet_account_id == account_id, LedgerEntry.direction == "credit")
        .scalar()
    )
    debit = (
        db.query(func.coalesce(func.sum(LedgerEntry.amount), 0))
        .filter(LedgerEntry.wallet_account_id == account_id, LedgerEntry.direction == "debit")
        .scalar()
    )
    return q2(Decimal(str(credit)) - Decimal(str(debit)))


def post_double_entry(
    db: Session,
    *,
    txn_type: str,
    amount: Decimal,
    currency: str,
    debit_account: WalletAccount,
    credit_account: WalletAccount,
    reference_type: str | None = None,
    reference_id: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
    debit_memo: str | None = None,
    credit_memo: str | None = None,
) -> LedgerTransaction:
    amt = q2(amount)
    if amt <= 0:
        raise LedgerError("Amount must be greater than zero")
    currency_code = (currency or "EUR").upper()

    if idempotency_key:
        existing = db.query(LedgerTransaction).filter(LedgerTransaction.idempotency_key == idempotency_key).first()
        if existing:
            return existing

    now = _utcnow()
    txn = LedgerTransaction(
        id=new_uuid(),
        txn_type=txn_type,
        reference_type=reference_type,
        reference_id=reference_id,
        idempotency_key=idempotency_key,
        metadata_json=metadata,
        created_at=now,
    )
    db.add(txn)
    db.flush()
    db.add(
        LedgerEntry(
            id=new_uuid(),
            transaction_id=txn.id,
            wallet_account_id=debit_account.id,
            direction="debit",
            amount=amt,
            currency=currency_code,
            memo=debit_memo,
            created_at=now,
        )
    )
    db.add(
        LedgerEntry(
            id=new_uuid(),
            transaction_id=txn.id,
            wallet_account_id=credit_account.id,
            direction="credit",
            amount=amt,
            currency=currency_code,
            memo=credit_memo,
            created_at=now,
        )
    )
    return txn


def get_or_create_commission_config(db: Session, *, currency: str = "EUR") -> CommissionConfig:
    now = _utcnow()
    config = (
        db.query(CommissionConfig)
        .filter(
            CommissionConfig.scope == "global",
            CommissionConfig.currency == currency,
            CommissionConfig.is_active == True,  # noqa: E712
            CommissionConfig.effective_from <= now,
            (CommissionConfig.effective_to.is_(None) | (CommissionConfig.effective_to > now)),
        )
        .order_by(CommissionConfig.effective_from.desc())
        .first()
    )
    if config:
        return config
    config = CommissionConfig(
        id=new_uuid(),
        scope="global",
        scope_ref=None,
        country_code=None,
        currency=currency,
        percent=q2(settings.marketplace_default_commission_percent),
        is_active=True,
        effective_from=now,
        effective_to=None,
        created_by_admin=None,
        created_at=now,
    )
    db.add(config)
    db.flush()
    return config


def ensure_platform_accounts(db: Session, *, currency: str = "EUR") -> tuple[WalletAccount, WalletAccount]:
    revenue = get_or_create_wallet_account(
        db,
        owner_type=OWNER_PLATFORM,
        owner_id="platform",
        account_kind=ACCOUNT_PLATFORM_REVENUE,
        currency=currency,
    )
    cash = get_or_create_wallet_account(
        db,
        owner_type=OWNER_PLATFORM,
        owner_id="platform",
        account_kind=ACCOUNT_PLATFORM_CASH,
        currency=currency,
    )
    return revenue, cash


def credit_user_wallet_topup(
    db: Session,
    *,
    user_id: str,
    amount: Decimal,
    currency: str,
    external_payment_id: str,
) -> LedgerTransaction:
    revenue, cash = ensure_platform_accounts(db, currency=currency)
    _ = revenue
    user_available = get_or_create_wallet_account(
        db,
        owner_type=OWNER_USER,
        owner_id=user_id,
        account_kind=ACCOUNT_USER_AVAILABLE,
        currency=currency,
    )
    txn = post_double_entry(
        db,
        txn_type="wallet_topup",
        amount=q2(amount),
        currency=currency,
        debit_account=cash,
        credit_account=user_available,
        reference_type="mollie_payment",
        reference_id=external_payment_id,
        idempotency_key=f"wallet_topup:{external_payment_id}",
        metadata={"user_id": user_id, "external_payment_id": external_payment_id},
        debit_memo="Platform cash source",
        credit_memo="User wallet topup",
    )
    db.add(
        OutboxEvent(
            id=new_uuid(),
            event_type="wallet.topup.settled",
            aggregate_type="ledger_transaction",
            aggregate_id=txn.id,
            payload_json={"user_id": user_id, "amount": str(q2(amount)), "currency": currency},
            status="pending",
            available_at=_utcnow(),
            created_at=_utcnow(),
        )
    )
    return txn


def reserve_user_hold_for_session(
    db: Session,
    *,
    user_id: str,
    session_id: str,
    amount: Decimal,
    currency: str,
) -> WalletHold:
    amt = q2(amount)
    user_available = get_or_create_wallet_account(
        db,
        owner_type=OWNER_USER,
        owner_id=user_id,
        account_kind=ACCOUNT_USER_AVAILABLE,
        currency=currency,
    )
    balance = get_account_balance(db, user_available.id)
    if balance < amt:
        raise LedgerError("Insufficient wallet balance")
    user_hold_account = get_or_create_wallet_account(
        db,
        owner_type=OWNER_USER,
        owner_id=user_id,
        account_kind=ACCOUNT_USER_HOLD,
        currency=currency,
    )
    post_double_entry(
        db,
        txn_type="session_hold_reserve",
        amount=amt,
        currency=currency,
        debit_account=user_available,
        credit_account=user_hold_account,
        reference_type="chat_session",
        reference_id=session_id,
        idempotency_key=f"session_hold_reserve:{session_id}",
        metadata={"user_id": user_id, "session_id": session_id},
        debit_memo="Reserve for session",
        credit_memo="Held for session billing",
    )
    now = _utcnow()
    hold = WalletHold(
        id=new_uuid(),
        user_id=user_id,
        session_id=session_id,
        currency=currency.upper(),
        amount_reserved=amt,
        amount_consumed=Decimal("0.00"),
        transaction_fee_charged=False,
        status="active",
        expires_at=now + timedelta(minutes=settings.marketplace_hold_expiry_minutes),
        created_at=now,
        updated_at=now,
    )
    db.add(hold)
    db.flush()
    return hold


def _session_consumption_accounts(db: Session, *, user_id: str, mentor_id: str, currency: str) -> tuple[WalletAccount, WalletAccount, WalletAccount]:
    user_hold = get_or_create_wallet_account(
        db,
        owner_type=OWNER_USER,
        owner_id=user_id,
        account_kind=ACCOUNT_USER_HOLD,
        currency=currency,
    )
    coach_pending = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=mentor_id,
        account_kind=ACCOUNT_COACH_PENDING,
        currency=currency,
    )
    platform_revenue = get_or_create_wallet_account(
        db,
        owner_type=OWNER_PLATFORM,
        owner_id="platform",
        account_kind=ACCOUNT_PLATFORM_REVENUE,
        currency=currency,
    )
    return user_hold, coach_pending, platform_revenue


def consume_hold_for_session(
    db: Session,
    *,
    hold: WalletHold,
    mentor_id: str,
    amount_gross: Decimal,
    seconds_billed: int,
) -> SessionBillingEvent:
    if hold.status != "active":
        raise LedgerError("Hold is not active")
    remaining = q2(Decimal(str(hold.amount_reserved)) - Decimal(str(hold.amount_consumed)))
    gross = q2(amount_gross)
    if gross <= 0:
        raise LedgerError("Gross amount must be positive")
    fee_amt = Decimal("0.00")
    if not hold.transaction_fee_charged:
        fee_amt = q2(settings.chat_session_transaction_fee_eur)
    total_needed = q2(gross + fee_amt)
    if total_needed > remaining:
        raise LedgerError("Not enough reserved amount")
    commission_cfg = get_or_create_commission_config(db, currency=hold.currency)
    tax_pct = Decimal(str(settings.chat_session_tax_percent))
    platform_pct = Decimal(str(commission_cfg.percent))
    tax_amt, platform_amt, coach_net = metered_split_amounts(
        gross,
        tax_percent=tax_pct,
        platform_percent=platform_pct,
    )

    user_hold, coach_pending, platform_revenue = _session_consumption_accounts(
        db,
        user_id=hold.user_id,
        mentor_id=mentor_id,
        currency=hold.currency,
    )
    if coach_net > 0:
        post_double_entry(
            db,
            txn_type="session_consume_coach_net",
            amount=coach_net,
            currency=hold.currency,
            debit_account=user_hold,
            credit_account=coach_pending,
            reference_type="chat_session",
            reference_id=hold.session_id,
            metadata={"hold_id": hold.id},
            debit_memo="Session billed coach net",
            credit_memo="Coach pending earnings",
        )
    if tax_amt > 0:
        post_double_entry(
            db,
            txn_type="session_consume_tax",
            amount=tax_amt,
            currency=hold.currency,
            debit_account=user_hold,
            credit_account=platform_revenue,
            reference_type="chat_session",
            reference_id=hold.session_id,
            metadata={"hold_id": hold.id},
            debit_memo="Session tax (metered gross)",
            credit_memo="Platform tax revenue",
        )
    if platform_amt > 0:
        post_double_entry(
            db,
            txn_type="session_consume_platform_fee",
            amount=platform_amt,
            currency=hold.currency,
            debit_account=user_hold,
            credit_account=platform_revenue,
            reference_type="chat_session",
            reference_id=hold.session_id,
            metadata={"hold_id": hold.id},
            debit_memo="Session platform fee (metered gross)",
            credit_memo="Platform fee revenue",
        )
    if fee_amt > 0:
        post_double_entry(
            db,
            txn_type="session_transaction_fee",
            amount=fee_amt,
            currency=hold.currency,
            debit_account=user_hold,
            credit_account=platform_revenue,
            reference_type="chat_session",
            reference_id=hold.session_id,
            idempotency_key=f"session_transaction_fee:{hold.id}",
            metadata={"hold_id": hold.id},
            debit_memo="Per-session transaction fee",
            credit_memo="Platform transaction fee",
        )
        hold.transaction_fee_charged = True

    consumed_incr = q2(gross + fee_amt)
    hold.amount_consumed = q2(Decimal(str(hold.amount_consumed)) + consumed_incr)
    hold.updated_at = _utcnow()
    if q2(Decimal(str(hold.amount_reserved)) - Decimal(str(hold.amount_consumed))) <= Decimal("0.00"):
        hold.status = "consumed"
    event = SessionBillingEvent(
        id=new_uuid(),
        session_id=hold.session_id,
        hold_id=hold.id,
        event_type="consume",
        seconds_billed=max(0, int(seconds_billed)),
        amount_gross=gross,
        amount_tax=tax_amt,
        amount_commission=platform_amt,
        amount_coach_net=coach_net,
        amount_transaction_fee=fee_amt,
        currency=hold.currency,
        created_at=_utcnow(),
    )
    db.add(event)
    db.flush()
    return event


def release_session_hold(db: Session, *, hold: WalletHold) -> SessionBillingEvent | None:
    if hold.status not in ("active", "consumed"):
        return None
    remaining = q2(Decimal(str(hold.amount_reserved)) - Decimal(str(hold.amount_consumed)))
    if remaining > 0:
        user_hold = get_or_create_wallet_account(
            db,
            owner_type=OWNER_USER,
            owner_id=hold.user_id,
            account_kind=ACCOUNT_USER_HOLD,
            currency=hold.currency,
        )
        user_available = get_or_create_wallet_account(
            db,
            owner_type=OWNER_USER,
            owner_id=hold.user_id,
            account_kind=ACCOUNT_USER_AVAILABLE,
            currency=hold.currency,
        )
        post_double_entry(
            db,
            txn_type="session_hold_release",
            amount=remaining,
            currency=hold.currency,
            debit_account=user_hold,
            credit_account=user_available,
            reference_type="chat_session",
            reference_id=hold.session_id,
            idempotency_key=f"session_hold_release:{hold.id}",
            metadata={"hold_id": hold.id},
            debit_memo="Hold release",
            credit_memo="Return unused reserve",
        )
    hold.status = "released"
    hold.updated_at = _utcnow()
    ev = SessionBillingEvent(
        id=new_uuid(),
        session_id=hold.session_id,
        hold_id=hold.id,
        event_type="release",
        seconds_billed=0,
        amount_gross=Decimal("0.00"),
        amount_tax=Decimal("0.00"),
        amount_commission=Decimal("0.00"),
        amount_coach_net=Decimal("0.00"),
        amount_transaction_fee=Decimal("0.00"),
        currency=hold.currency,
        created_at=_utcnow(),
    )
    db.add(ev)
    db.flush()
    return ev


def move_coach_pending_to_withdrawable(db: Session, *, mentor_id: str, currency: str, amount: Decimal) -> LedgerTransaction:
    pending = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=mentor_id,
        account_kind=ACCOUNT_COACH_PENDING,
        currency=currency,
    )
    withdrawable = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=mentor_id,
        account_kind=ACCOUNT_COACH_WITHDRAWABLE,
        currency=currency,
    )
    return post_double_entry(
        db,
        txn_type="coach_pending_release",
        amount=q2(amount),
        currency=currency,
        debit_account=pending,
        credit_account=withdrawable,
        reference_type="coach",
        reference_id=mentor_id,
        metadata={"mentor_id": mentor_id},
        debit_memo="Pending earnings release",
        credit_memo="Withdrawable earnings",
    )


def settle_coach_payout_to_platform_cash(
    db: Session,
    *,
    mentor_id: str,
    payout_request_id: str,
    currency: str,
    amount: Decimal,
) -> LedgerTransaction:
    amt = q2(amount)
    if amt <= 0:
        raise LedgerError("Payout settlement amount must be greater than zero")
    withdrawable = get_or_create_wallet_account(
        db,
        owner_type=OWNER_COACH,
        owner_id=mentor_id,
        account_kind=ACCOUNT_COACH_WITHDRAWABLE,
        currency=currency,
    )
    withdrawable_balance = get_account_balance(db, withdrawable.id)
    if withdrawable_balance < amt:
        raise LedgerError("Insufficient coach withdrawable balance for payout settlement")
    platform_cash = get_or_create_wallet_account(
        db,
        owner_type=OWNER_PLATFORM,
        owner_id="platform",
        account_kind=ACCOUNT_PLATFORM_CASH,
        currency=currency,
    )
    return post_double_entry(
        db,
        txn_type="coach_payout_settlement",
        amount=amt,
        currency=currency,
        debit_account=withdrawable,
        credit_account=platform_cash,
        reference_type="coach_payout_request",
        reference_id=payout_request_id,
        idempotency_key=f"coach_payout_settlement:{payout_request_id}",
        metadata={"mentor_id": mentor_id, "payout_request_id": payout_request_id},
        debit_memo="Coach withdrawable payout settled",
        credit_memo="Platform cash payout settlement",
    )


def current_price_per_second_for_session(db: Session, *, mentor_id: str) -> Decimal:
    mentor = db.query(Mentor).filter(Mentor.id == mentor_id).first()
    if not mentor:
        raise LedgerError("Coach not found")
    per_min = effective_chat_price_per_minute_eur(mentor)
    return per_min / Decimal("60")
