"""Add expanded analyses table.

Revision ID: 007
Revises: 006
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analyses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False, index=True),
        sa.Column("seo_score", sa.Integer, nullable=True),
        sa.Column("geo_score", sa.Integer, nullable=True),
        sa.Column("combined_score", sa.Integer, nullable=True),
        sa.Column("grade", sa.String(5), nullable=True),
        sa.Column("intent", sa.String(50), nullable=True),
        sa.Column("primary_keyword", sa.String(200), nullable=True),
        sa.Column("seo_categories", JSON, nullable=True),
        sa.Column("geo_categories", JSON, nullable=True),
        sa.Column("issues", JSON, nullable=True),
        sa.Column("suggestions", JSON, nullable=True),
        sa.Column("page_data", JSON, nullable=True),
        sa.Column("brand_voice_id", UUID(as_uuid=True), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("processing_time_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    op.create_index("ix_analyses_user_id", "analyses", ["user_id"])


def downgrade() -> None:
    op.drop_table("analyses")
