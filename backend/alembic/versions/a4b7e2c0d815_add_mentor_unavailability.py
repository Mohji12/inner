"""add mentor_unavailability table

Revision ID: a4b7e2c0d815
Revises: f3a8c1d9e704
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a4b7e2c0d815"
down_revision: Union[str, None] = "f3a8c1d9e704"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mentor_unavailability",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("mentor_id", sa.CHAR(length=36), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("all_day", sa.Boolean(), nullable=False),
        sa.Column("start_at_utc", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at_utc", sa.DateTime(timezone=True), nullable=True),
        sa.Column("weekday", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["mentors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_mentor_unavailability_mentor", "mentor_unavailability", ["mentor_id"])
    op.create_index("ix_mentor_unavailability_mentor_id", "mentor_unavailability", ["mentor_id"])


def downgrade() -> None:
    op.drop_index("ix_mentor_unavailability_mentor_id", table_name="mentor_unavailability")
    op.drop_index("idx_mentor_unavailability_mentor", table_name="mentor_unavailability")
    op.drop_table("mentor_unavailability")
