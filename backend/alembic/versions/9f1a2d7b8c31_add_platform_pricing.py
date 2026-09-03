"""add_platform_pricing

Revision ID: 9f1a2d7b8c31
Revises: 716a50825d63
Create Date: 2026-05-04 18:30:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f1a2d7b8c31"
down_revision: Union[str, None] = "716a50825d63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_pricing",
        sa.Column("id", sa.CHAR(length=36), nullable=False),
        sa.Column("price_5_min", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("price_10_min", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("price_20_min", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("price_30_min", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default=sa.text("'EUR'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO platform_pricing (
                id, price_5_min, price_10_min, price_20_min, price_30_min, currency, is_active, created_at, updated_at
            ) VALUES (
                :id, 0.00, 0.00, 0.00, 0.00, 'EUR', 0, NOW(), NOW()
            )
            """
        ).bindparams(id=str(uuid.uuid4()))
    )


def downgrade() -> None:
    op.drop_table("platform_pricing")
