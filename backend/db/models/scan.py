import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDPrimaryKeyMixin


class Scan(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "scans"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    combined_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    primary_keyword: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    page_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        back_populates="scans"
    )
    suggestions: Mapped[list["SuggestionRecord"]] = relationship(  # noqa: F821
        back_populates="scan", lazy="selectin", cascade="all, delete-orphan"
    )
