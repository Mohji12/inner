"""add chat session join timer fields

Revision ID: c4d8e2f1a903
Revises: b2c9e401a872
Create Date: 2026-05-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c4d8e2f1a903"
down_revision: Union[str, None] = "b2c9e401a872"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("allocated_duration_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("user_joined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("mentor_joined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("timer_started_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_sessions", "timer_started_at")
    op.drop_column("chat_sessions", "mentor_joined_at")
    op.drop_column("chat_sessions", "user_joined_at")
    op.drop_column("chat_sessions", "allocated_duration_minutes")
