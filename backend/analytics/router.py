"""Analytics event collection API endpoints."""

import logging

from fastapi import APIRouter, Request

from analytics.schemas import AnalyticsEventBatch, AnalyticsResponse
from analytics.storage import AnalyticsStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

_storage = AnalyticsStorage()


@router.post("/events", response_model=AnalyticsResponse)
async def receive_events(batch: AnalyticsEventBatch, request: Request):
    """Receive a batch of analytics events from the extension."""
    # Extract user_id from auth if available (optional)
    user_id = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        # We'll resolve user_id from token when auth is integrated
        # For now just store events without user association
        pass

    events_data = [e.model_dump() for e in batch.events]
    stored = await _storage.store_events(events_data, user_id=user_id)

    return AnalyticsResponse(received=stored)


@router.get("/summary")
async def get_analytics_summary():
    """Get a summary of collected analytics events."""
    counts = await _storage.get_event_counts()
    return {
        "event_counts": counts,
        "total_events": sum(counts.values()),
    }
