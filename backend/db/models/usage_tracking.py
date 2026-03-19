"""Detailed usage tracking model."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # scan, audit, export, schema_gen, competitor_analysis
    resource_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )  # ID of the resource (scan_id, audit_id, etc.)
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True
    )
    credits_used: Mapped[int] = mapped_column(
        Integer, default=1
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
