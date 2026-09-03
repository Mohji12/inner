"""add site_page_views table

Revision ID: b6c9d4e2f917
Revises: a4b7e2c0d815
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b6c9d4e2f917"
down_revision: Union[str, None] = "a4b7e2c0d815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_page_views",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=False),
        sa.Column("session_key", sa.CHAR(length=36), nullable=False),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.Column("visitor_kind", sa.String(length=16), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_site_page_views_created", "site_page_views", ["created_at"])
    op.create_index("idx_site_page_views_session", "site_page_views", ["session_key"])
    op.create_index("idx_site_page_views_path", "site_page_views", ["path"])


def downgrade() -> None:
    op.drop_index("idx_site_page_views_path", table_name="site_page_views")
    op.drop_index("idx_site_page_views_session", table_name="site_page_views")
    op.drop_index("idx_site_page_views_created", table_name="site_page_views")
    op.drop_table("site_page_views")
