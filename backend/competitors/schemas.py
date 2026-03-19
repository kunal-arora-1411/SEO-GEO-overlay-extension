"""Schemas for competitor analysis endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AddCompetitorRequest(BaseModel):
    url: str = Field(description="Competitor page URL to track")
    name: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional display name for the competitor",
    )


class CompetitorResponse(BaseModel):
    id: str
    url: str
    domain: str
    name: Optional[str] = None
    last_analyzed: Optional[datetime] = None
    seo_score: Optional[float] = None
    geo_score: Optional[float] = None

    model_config = {"from_attributes": True}


class GapItem(BaseModel):
    category: str
    your_score: float
    competitor_score: float
    difference: float = Field(description="Positive means competitor leads")
    recommendation: str


class CompetitorComparisonResponse(BaseModel):
    your_scores: dict[str, float] = Field(default_factory=dict)
    competitor_scores: dict[str, float] = Field(default_factory=dict)
    gaps: list[GapItem] = Field(default_factory=list)


class CompetitorListResponse(BaseModel):
    competitors: list[CompetitorResponse] = Field(default_factory=list)
