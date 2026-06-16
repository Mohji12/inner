from datetime import datetime
from decimal import Decimal
from sqlalchemy import CHAR, Boolean, DateTime, Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base

class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    discount_type: Mapped[str] = mapped_column(String(16))  # "percentage" or "fixed"
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_uses: Mapped[int] = mapped_column(Integer, default=0)
    min_order_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mentor_id: Mapped[str | None] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("mentors.id", ondelete="SET NULL"), nullable=True, index=True)
    #: "booking" (session checkout), "onboarding" (coach registration), or "all".
    scope: Mapped[str] = mapped_column(String(16), default="booking")
    first_time_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    mentor = relationship("Mentor")
