from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class MentorOnboardingPayment(Base):
    __tablename__ = "mentor_onboarding_payments"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_base_eur: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    fx_rate_used: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open")
    mollie_payment_id: Mapped[str] = mapped_column(String(128), unique=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_plan: Mapped[str] = mapped_column(String(16), default="full")
    installment_number: Mapped[int] = mapped_column(Integer, default=1)
    installment_total: Mapped[int] = mapped_column(Integer, default=1)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    mentor = relationship("Mentor")
