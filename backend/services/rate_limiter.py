"""Simple in-memory rate limiter placeholder.

A production implementation would use Redis sliding-window counters.
This placeholder provides the interface for future integration.
"""


class RateLimiter:
    """Per-client rate limiter.

    Currently a no-op -- all requests are allowed.  Replace the internals
    with a Redis-backed sliding window when ready.
    """

    def __init__(
        self,
        max_per_minute: int = 10,
        max_per_day: int = 100,
    ) -> None:
        self.max_per_minute = max_per_minute
        self.max_per_day = max_per_day

    async def is_allowed(self, client_id: str) -> bool:  # noqa: ARG002
        """Return ``True`` if the client has not exceeded rate limits."""
        return True

    async def record(self, client_id: str) -> None:  # noqa: ARG002
        """Record a request for the given client."""
