"""add mentor original image and crop JSON

Revision ID: f3a8c1d9e704
Revises: e8f2b0d5c613
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f3a8c1d9e704"
down_revision: Union[str, None] = "e8f2b0d5c613"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mentors", sa.Column("profile_image_original", sa.String(length=512), nullable=True))
    op.add_column("mentors", sa.Column("profile_image_crop", sa.JSON(), nullable=True))
    op.add_column("mentors", sa.Column("banner_image_original", sa.String(length=512), nullable=True))
    op.add_column("mentors", sa.Column("banner_image_crop", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("mentors", "banner_image_crop")
    op.drop_column("mentors", "banner_image_original")
    op.drop_column("mentors", "profile_image_crop")
    op.drop_column("mentors", "profile_image_original")
