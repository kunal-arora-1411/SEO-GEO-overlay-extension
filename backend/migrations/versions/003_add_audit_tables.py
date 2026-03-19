"""Add site_audits and audit_pages tables.

Revision ID: 003
Revises: 002
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_audits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("domain", sa.String(255), nullable=False, index=True),
        sa.Column("start_url", sa.String(2048), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("max_pages", sa.Integer, server_default="50"),
        sa.Column("pages_crawled", sa.Integer, server_default="0"),
        sa.Column("avg_seo_score", sa.Integer, nullable=True),
        sa.Column("common_issues", JSON, nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "audit_pages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("audit_id", UUID(as_uuid=True), sa.ForeignKey("site_audits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("status_code", sa.Integer, server_default="0"),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("meta_description", sa.String(500), nullable=True),
        sa.Column("headings", JSON, nullable=True),
        sa.Column("word_count", sa.Integer, server_default="0"),
        sa.Column("has_schema", sa.Boolean, server_default="false"),
        sa.Column("seo_score", sa.Integer, nullable=True),
        sa.Column("geo_score", sa.Integer, nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("crawled_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_audit_pages_audit_id", "audit_pages", ["audit_id"])


def downgrade() -> None:
    op.drop_table("audit_pages")
    op.drop_table("site_audits")
