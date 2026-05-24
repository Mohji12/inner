"""add mentor banner_image

Revision ID: b2c9e401a872
Revises: 9f1a2d7b8c31
Create Date: 2026-05-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c9e401a872"
down_revision: Union[str, None] = "9f1a2d7b8c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mentors",
        sa.Column("banner_image", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mentors", "banner_image")
