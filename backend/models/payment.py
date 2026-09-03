from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    booking_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_base_eur: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    fx_rate_used: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    payment_gateway: Mapped[str] = mapped_column(String(64), default="placeholder")
    transaction_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="payments")
    booking = relationship("Booking", back_populates="payment")
