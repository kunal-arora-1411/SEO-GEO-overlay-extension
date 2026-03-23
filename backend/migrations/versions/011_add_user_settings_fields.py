"""Add notifications_enabled and weekly_reports to users.

Revision ID: 011
Revises: 010
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notifications_enabled", sa.Boolean, nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("weekly_reports", sa.Boolean, nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("users", "weekly_reports")
    op.drop_column("users", "notifications_enabled")
