"""Schemas for analytics event collection."""

from typing import Optional, Any
from pydantic import BaseModel, Field


class AnalyticsEvent(BaseModel):
    event: str
    properties: dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    timestamp: Optional[str] = None
    url: Optional[str] = None


class AnalyticsEventBatch(BaseModel):
    events: list[AnalyticsEvent] = Field(default_factory=list, max_length=100)


class AnalyticsResponse(BaseModel):
    received: int
    status: str = "ok"
