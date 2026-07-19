"""add mentor presence weeks tracking

Revision ID: d7e1a9c4b502
Revises: c4d8e2f1a903
Create Date: 2026-07-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d7e1a9c4b502"
down_revision: Union[str, None] = "c4d8e2f1a903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mentors",
        sa.Column("presence_accrued_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "mentor_presence_weeks",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("mentor_id", sa.CHAR(length=36), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("seconds_online", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["mentors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mentor_id", "week_start", name="uq_mentor_presence_week"),
    )
    op.create_index("ix_mentor_presence_weeks_mentor_id", "mentor_presence_weeks", ["mentor_id"])
    op.create_index("ix_mentor_presence_weeks_week_start", "mentor_presence_weeks", ["week_start"])


def downgrade() -> None:
    op.drop_index("ix_mentor_presence_weeks_week_start", table_name="mentor_presence_weeks")
    op.drop_index("ix_mentor_presence_weeks_mentor_id", table_name="mentor_presence_weeks")
    op.drop_table("mentor_presence_weeks")
    op.drop_column("mentors", "presence_accrued_at")
