"""Update subscription tiers to 4-tier system.

Revision ID: 010
Revises: 009
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tier_limits column to store per-tier configuration
    # The actual tier logic is handled in application code
    # This migration just ensures the data model supports the 4-tier system

    # Update any existing 'pro' subscriptions to keep working
    # The tiers are: free, starter, pro, agency
    op.execute("""
        UPDATE subscriptions
        SET tier = 'free'
        WHERE tier NOT IN ('free', 'starter', 'pro', 'agency')
    """)

    # Add monthly_scan_limit and monthly_audit_limit for explicit tracking
    op.add_column("subscriptions",
        sa.Column("monthly_scan_limit", sa.Integer, nullable=True)
    )
    op.add_column("subscriptions",
        sa.Column("monthly_audit_limit", sa.Integer, nullable=True)
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "monthly_audit_limit")
    op.drop_column("subscriptions", "monthly_scan_limit")
