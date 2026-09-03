from datetime import datetime

from sqlalchemy import Boolean, CHAR, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    sender_role: Mapped[str] = mapped_column(String(16))
    body: Mapped[str] = mapped_column(Text)
    body_i18n: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_to_message_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attachment_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    session = relationship("ChatSession", back_populates="messages")
