"""Add brand_voices, competitors, and competitor_snapshots tables.

Revision ID: 008
Revises: 007
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brand_voices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("sample_urls", JSON, nullable=True),
        sa.Column("avg_sentence_length", sa.Float, nullable=True),
        sa.Column("vocabulary_level", sa.String(20), nullable=True),
        sa.Column("formality_score", sa.Float, nullable=True),
        sa.Column("tone_descriptors", JSON, nullable=True),
        sa.Column("style_description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "competitors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "competitor_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("competitor_id", UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seo_score", sa.Integer, nullable=True),
        sa.Column("geo_score", sa.Integer, nullable=True),
        sa.Column("combined_score", sa.Integer, nullable=True),
        sa.Column("categories", JSON, nullable=True),
        sa.Column("page_data", JSON, nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_competitors_user_id", "competitors", ["user_id"])
    op.create_index("ix_competitor_snapshots_competitor_id", "competitor_snapshots", ["competitor_id"])

    # Add FK for analyses.brand_voice_id now that brand_voices table exists
    op.create_foreign_key(
        "fk_analyses_brand_voice_id",
        "analyses",
        "brand_voices",
        ["brand_voice_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_table("competitor_snapshots")
    op.drop_table("competitors")
    op.drop_table("brand_voices")
