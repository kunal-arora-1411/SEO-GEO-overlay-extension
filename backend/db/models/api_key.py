"""API key model for programmatic access."""

import uuid
import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


def generate_api_key() -> str:
    """Generate a secure API key with a recognizable prefix."""
    return "sgo_" + secrets.token_urlsafe(32)


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    key_prefix: Mapped[str] = mapped_column(
        String(12), nullable=False
    )  # First 8 chars for identification
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
