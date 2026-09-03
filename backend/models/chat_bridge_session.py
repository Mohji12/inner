from datetime import datetime

from sqlalchemy import CHAR, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class ChatBridgeSession(Base):
    __tablename__ = "chat_bridge_sessions"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    actor_role: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[str] = mapped_column(CHAR(36), index=True)
    number_a: Mapped[str] = mapped_column(String(32))
    number_b: Mapped[str] = mapped_column(String(32))
    label_a: Mapped[str | None] = mapped_column(String(64), nullable=True)
    label_b: Mapped[str | None] = mapped_column(String(64), nullable=True)
    room_name: Mapped[str] = mapped_column(String(128), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="dialing")
    leg_a_participant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    leg_a_sip_call_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    leg_b_participant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    leg_b_sip_call_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
