"""Brand voice model."""

import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, ForeignKey, DateTime, Float, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class BrandVoice(Base):
    __tablename__ = "brand_voices"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending, training, ready, failed

    # Training data
    sample_urls: Mapped[Optional[list[str]]] = mapped_column(
        JSON, nullable=True
    )

    # Style metrics (computed during training)
    avg_sentence_length: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    vocabulary_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # basic, intermediate, advanced
    formality_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )  # 0.0 (very informal) to 1.0 (very formal)
    tone_descriptors: Mapped[Optional[list[str]]] = mapped_column(
        JSON, nullable=True
    )  # e.g. ["professional", "friendly", "technical"]
    style_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # LLM-generated description of the brand's writing style

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
