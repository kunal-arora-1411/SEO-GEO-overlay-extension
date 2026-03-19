"""Add billing fields to users table: stripe_customer_id, subscription_status, subscription_id.

Revision ID: 002
Revises: 001
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("subscription_status", sa.String(50), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("subscription_id", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_users_stripe_customer_id",
        "users",
        ["stripe_customer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_stripe_customer_id", table_name="users")
    op.drop_column("users", "subscription_id")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "stripe_customer_id")
