"""Schemas for analysis history and trend endpoints."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AnalysisHistoryItem(BaseModel):
    id: str
    url: str
    domain: str
    seo_score: float
    geo_score: float
    combined_score: float
    intent: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisDetailResponse(BaseModel):
    id: str
    url: str
    domain: str
    seo_score: float
    geo_score: float
    combined_score: float
    intent: str
    primary_keyword: Optional[str] = None
    geo_categories: dict[str, Any] = Field(default_factory=dict)
    geo_issues: list[dict[str, Any]] = Field(default_factory=list)
    suggestions: list[dict[str, Any]] = Field(default_factory=list)
    page_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class TrendPoint(BaseModel):
    date: str = Field(description="ISO date string (YYYY-MM-DD)")
    seo_score: float
    geo_score: float
    combined_score: float
    scan_count: int


class TrendResponse(BaseModel):
    domain: str
    period: int = Field(description="Number of days covered")
    data_points: list[TrendPoint] = Field(default_factory=list)
    trend_direction: str = Field(description="improving, declining, or stable")
    slope: float = Field(description="Linear regression slope of combined_score")


class DomainSummary(BaseModel):
    domain: str
    total_scans: int
    avg_seo: float
    avg_geo: float
    avg_combined: float
    last_scan: datetime


class PaginatedResponse(BaseModel):
    items: list[AnalysisHistoryItem] = Field(default_factory=list)
    cursor: Optional[str] = None
    has_more: bool = False
