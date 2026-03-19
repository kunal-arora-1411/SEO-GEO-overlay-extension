"""Schemas for multi-page audit endpoints."""

from typing import Optional
from pydantic import BaseModel, Field


class StartAuditRequest(BaseModel):
    url: str
    max_pages: int = Field(default=50, ge=1, le=500)


class AuditPageResult(BaseModel):
    url: str
    status_code: int = 0
    title: Optional[str] = None
    meta_description: Optional[str] = None
    headings: dict = Field(default_factory=dict)
    word_count: int = 0
    links_found: int = 0
    has_schema: bool = False
    canonical_url: Optional[str] = None
    seo_score: Optional[int] = None
    geo_score: Optional[int] = None
    error: Optional[str] = None


class AuditStatusResponse(BaseModel):
    audit_id: str
    status: str  # "running", "completed", "failed"
    pages_crawled: int = 0
    total_pages: int = 0
    progress_pct: int = 0


class AuditResultsResponse(BaseModel):
    audit_id: str
    status: str
    domain: str
    start_url: str
    pages_crawled: int
    pages: list[AuditPageResult] = Field(default_factory=list)
    avg_seo_score: Optional[float] = None
    common_issues: list[str] = Field(default_factory=list)
