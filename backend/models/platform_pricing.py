from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CHAR, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class PlatformPricing(Base):
    __tablename__ = "platform_pricing"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    price_5_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_10_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_20_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_30_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    price_60_min: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
