"""Analytics event storage.

Stores events in-memory during development. Replaced by DB storage
when the analytics_events table is available (migration 004).
"""

import logging
from typing import Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory storage for development
_events: list[dict[str, Any]] = []
_MAX_MEMORY_EVENTS = 10000


class AnalyticsStorage:
    """Stores and retrieves analytics events."""

    async def store_events(
        self,
        events: list[dict[str, Any]],
        user_id: Optional[str] = None,
    ) -> int:
        """Store a batch of analytics events. Returns count stored."""
        stored = 0
        for event in events:
            record = {
                "event": event.get("event", "unknown"),
                "properties": event.get("properties", {}),
                "session_id": event.get("session_id"),
                "timestamp": event.get("timestamp") or datetime.utcnow().isoformat(),
                "url": event.get("url"),
                "user_id": user_id,
                "stored_at": datetime.utcnow().isoformat(),
            }
            _events.append(record)
            stored += 1

        # Trim to prevent unbounded memory growth
        if len(_events) > _MAX_MEMORY_EVENTS:
            del _events[: len(_events) - _MAX_MEMORY_EVENTS]

        logger.debug("Stored %d analytics events (total: %d)", stored, len(_events))
        return stored

    async def get_events(
        self,
        event_type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Retrieve stored events with optional filters."""
        filtered = _events
        if event_type:
            filtered = [e for e in filtered if e["event"] == event_type]
        if user_id:
            filtered = [e for e in filtered if e.get("user_id") == user_id]
        return filtered[-limit:]

    async def get_event_counts(
        self,
        user_id: Optional[str] = None,
    ) -> dict[str, int]:
        """Get event counts grouped by event type."""
        counts: dict[str, int] = {}
        for event in _events:
            if user_id and event.get("user_id") != user_id:
                continue
            name = event["event"]
            counts[name] = counts.get(name, 0) + 1
        return counts
