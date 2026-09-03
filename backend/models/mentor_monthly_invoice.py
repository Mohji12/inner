from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CHAR, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorMonthlyInvoice(Base):
    __tablename__ = "mentor_monthly_invoices"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    invoice_month: Mapped[date] = mapped_column(Date)  # month anchor (first day)
    gross_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fee_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    fee_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    checkout_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    checkout_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    fee_fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    status: Mapped[str] = mapped_column(String(32), default="open")
    mollie_payment_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    mollie_checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    mentor = relationship("Mentor")
