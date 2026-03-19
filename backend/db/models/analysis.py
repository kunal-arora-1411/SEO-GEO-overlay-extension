"""Expanded analysis model for storing full analysis results."""

import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, ForeignKey, DateTime, Integer, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Scores
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    combined_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)

    # Classification
    intent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    primary_keyword: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Full data (JSON blobs)
    seo_categories: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    geo_categories: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    issues: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True
    )
    suggestions: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True
    )
    page_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )

    # Brand voice applied
    brand_voice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("brand_voices.id", ondelete="SET NULL"), nullable=True
    )

    # Metadata
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
