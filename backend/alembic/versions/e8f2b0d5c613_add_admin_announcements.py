"""add admin_announcements table

Revision ID: e8f2b0d5c613
Revises: d7e1a9c4b502
Create Date: 2026-07-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e8f2b0d5c613"
down_revision: Union[str, None] = "d7e1a9c4b502"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_announcements",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("admin_id", sa.CHAR(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("emails_sent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["admins.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_announcements_admin_id", "admin_announcements", ["admin_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_announcements_admin_id", table_name="admin_announcements")
    op.drop_table("admin_announcements")
