from datetime import datetime
from decimal import Decimal
from sqlalchemy import CHAR, DateTime, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base

class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True)
    user_id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="wallet")
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), primary_key=True)
    wallet_id: Mapped[str] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), ForeignKey("wallets.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(16))  # "credit" or "debit"
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    description: Mapped[str] = mapped_column(String(255))
    reference_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # "booking", "chat_session", "refund", "deposit"
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    admin_actor_id: Mapped[str | None] = mapped_column(CHAR(36, collation="utf8mb4_unicode_ci"), nullable=True, index=True)
    admin_actor_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    wallet = relationship("Wallet", back_populates="transactions")
