from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    stripe_customer_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    subscription_status: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    scans: Mapped[list["Scan"]] = relationship(  # noqa: F821
        back_populates="user", lazy="selectin"
    )
    daily_usages: Mapped[list["DailyUsage"]] = relationship(  # noqa: F821
        back_populates="user", lazy="selectin"
    )
