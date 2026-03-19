import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDPrimaryKeyMixin


class SuggestionRecord(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "suggestions"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("scans.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    element: Mapped[str] = mapped_column(String(100), nullable=False)
    selector: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_text: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[int] = mapped_column(Integer, nullable=False)
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    scan: Mapped["Scan"] = relationship(  # noqa: F821
        back_populates="suggestions"
    )
