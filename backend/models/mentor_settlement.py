from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CHAR, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorSettlement(Base):
    __tablename__ = "mentor_settlements"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    cycle_start: Mapped[date] = mapped_column(Date)
    cycle_end: Mapped[date] = mapped_column(Date)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fee_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    net_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_by_admin: Mapped[str] = mapped_column(CHAR(36), ForeignKey("admins.id", ondelete="RESTRICT"))
    approved_by_admin: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("admins.id", ondelete="RESTRICT"), nullable=True)
    provider_batch_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    mentor = relationship("Mentor")
    items = relationship("MentorSettlementItem", back_populates="settlement", cascade="all, delete-orphan")


class MentorSettlementItem(Base):
    __tablename__ = "mentor_settlement_items"
    __table_args__ = (
        UniqueConstraint("source_type", "source_id", name="uq_settlement_source"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    settlement_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentor_settlements.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[str] = mapped_column(CHAR(36))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    settlement = relationship("MentorSettlement", back_populates="items")
