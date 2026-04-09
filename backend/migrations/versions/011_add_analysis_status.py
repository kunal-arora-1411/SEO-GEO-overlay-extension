"""Add status column to analyses table.

Revision ID: 011
Revises: 010
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
    )


def downgrade() -> None:
    op.drop_column("analyses", "status")
