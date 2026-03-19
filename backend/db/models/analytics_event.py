"""Analytics event model for persistent event storage."""

import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, ForeignKey, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    properties: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    url: Mapped[Optional[str]] = mapped_column(
        String(2048), nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
