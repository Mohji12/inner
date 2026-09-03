from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class PromoCodeRedemption(Base):
    __tablename__ = "promo_code_redemptions"
    __table_args__ = (UniqueConstraint("user_id", "promo_code_id", name="uq_promo_redemption_user_promo"),)

    id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    promo_code_id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("promo_codes.id", ondelete="CASCADE"), index=True)
    booking_id: Mapped[str | None] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    promo_code = relationship("PromoCode")
    user = relationship("User")
    booking = relationship("Booking")
