"""Competitor tracking models."""

import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, ForeignKey, DateTime, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    snapshots: Mapped[list["CompetitorSnapshot"]] = relationship(
        back_populates="competitor", cascade="all, delete-orphan"
    )


class CompetitorSnapshot(Base):
    __tablename__ = "competitor_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    competitor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False
    )
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    combined_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    categories: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    page_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    competitor: Mapped["Competitor"] = relationship(back_populates="snapshots")
