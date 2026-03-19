import uuid
from datetime import date as date_type
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDPrimaryKeyMixin


class DailyUsage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "daily_usage"

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_usage_user_date"),
        UniqueConstraint("ip_address", "date", name="uq_daily_usage_ip_date"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    scan_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        back_populates="daily_usages"
    )
