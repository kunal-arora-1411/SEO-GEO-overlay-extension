"""Site audit models for multi-page audit storage."""

import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, ForeignKey, DateTime, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class SiteAudit(Base):
    __tablename__ = "site_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    start_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="running"
    )  # running, completed, failed
    max_pages: Mapped[int] = mapped_column(Integer, default=50)
    pages_crawled: Mapped[int] = mapped_column(Integer, default=0)
    avg_seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    common_issues: Mapped[Optional[list[str]]] = mapped_column(
        JSON, nullable=True
    )
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    pages: Mapped[list["AuditPage"]] = relationship(
        back_populates="audit", cascade="all, delete-orphan"
    )


class AuditPage(Base):
    __tablename__ = "audit_pages"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    audit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("site_audits.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    headings: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    has_schema: Mapped[bool] = mapped_column(default=False)
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    crawled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    audit: Mapped["SiteAudit"] = relationship(back_populates="pages")
