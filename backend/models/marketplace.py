from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class CapabilityMatrix(Base):
    __tablename__ = "capability_matrix"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    country_code: Mapped[str] = mapped_column(String(2), index=True)
    entity_type: Mapped[str] = mapped_column(String(32))
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    supports_connect: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_payouts: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_transfers: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CommissionConfig(Base):
    __tablename__ = "commission_configs"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    scope: Mapped[str] = mapped_column(String(32), default="global")
    scope_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    percent: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_admin: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WalletAccount(Base):
    __tablename__ = "wallet_accounts"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(16), index=True)
    owner_id: Mapped[str] = mapped_column(CHAR(36), index=True)
    account_kind: Mapped[str] = mapped_column(String(32), index=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    entries = relationship("LedgerEntry", back_populates="wallet_account")


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    txn_type: Mapped[str] = mapped_column(String(64), index=True)
    reference_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    entries = relationship("LedgerEntry", back_populates="transaction", cascade="all, delete-orphan")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("ledger_transactions.id", ondelete="CASCADE"),
        index=True,
    )
    wallet_account_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("wallet_accounts.id", ondelete="RESTRICT"),
        index=True,
    )
    direction: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    memo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    transaction = relationship("LedgerTransaction", back_populates="entries")
    wallet_account = relationship("WalletAccount", back_populates="entries")


class WalletHold(Base):
    __tablename__ = "wallet_holds"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    amount_reserved: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    amount_consumed: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    transaction_fee_charged: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="active")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SessionBillingEvent(Base):
    __tablename__ = "session_billing_events"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    hold_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("wallet_holds.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(32))
    seconds_billed: Mapped[int] = mapped_column(Integer, default=0)
    amount_gross: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount_tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    #: Platform fee portion of metered gross (same column as before; memos use "platform fee").
    amount_commission: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount_coach_net: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount_transaction_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CoachConnectAccount(Base):
    __tablename__ = "coach_connect_accounts"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("mentors.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), default="mollie")
    provider_account_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    provider_account_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_account_masked: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_state: Mapped[str] = mapped_column(String(32), default="not_started")
    kyc_status: Mapped[str] = mapped_column(String(32), default="pending")
    payouts_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    connect_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    connect_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    connect_token_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    connect_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    connect_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    capabilities_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    capabilities_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tax_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    tax_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_redirect_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CoachPayoutRequest(Base):
    __tablename__ = "coach_payout_requests"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(32), default="requested", index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    approved_by_admin_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("admins.id", ondelete="SET NULL"),
        nullable=True,
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)


class CoachPayoutAttempt(Base):
    __tablename__ = "coach_payout_attempts"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    payout_request_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("coach_payout_requests.id", ondelete="CASCADE"),
        index=True,
    )
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    provider_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="processing")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WebhookEventLog(Base):
    __tablename__ = "webhook_event_logs"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    event_key: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signature_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    payload_hash: Mapped[str] = mapped_column(String(128))
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    actor_role: Mapped[str] = mapped_column(String(16), index=True)
    actor_id: Mapped[str] = mapped_column(CHAR(36), index=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str] = mapped_column(String(128), index=True)
    details_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    aggregate_type: Mapped[str] = mapped_column(String(64), index=True)
    aggregate_id: Mapped[str] = mapped_column(String(128), index=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
