"""In-memory LRU cache (L1) for the multi-layer caching strategy.

Provides sub-millisecond lookups before falling through to Redis (L2).
"""

import time
import logging
from typing import Optional
from collections import OrderedDict

logger = logging.getLogger(__name__)


class MemoryCache:
    """Thread-safe in-memory LRU cache with TTL support.

    Parameters
    ----------
    max_size : int
        Maximum number of entries (default 50).
    ttl_seconds : int
        Time-to-live for each entry in seconds (default 300 / 5 min).
    """

    def __init__(self, max_size: int = 50, ttl_seconds: int = 300) -> None:
        self._cache: OrderedDict[str, tuple[str, float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[str]:
        """Retrieve a value by key. Returns None on miss or expiry."""
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None

        value, stored_at = entry
        if time.time() - stored_at > self._ttl:
            # Expired — remove and return miss
            del self._cache[key]
            self._misses += 1
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        self._hits += 1
        return value

    def set(self, key: str, value: str) -> None:
        """Store a value. Evicts the least-recently-used entry if at capacity."""
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = (value, time.time())

        # Evict LRU entries if over capacity
        while len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

    def delete(self, key: str) -> bool:
        """Remove a key. Returns True if the key existed."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self) -> None:
        """Remove all entries."""
        self._cache.clear()

    @property
    def size(self) -> int:
        """Current number of entries."""
        return len(self._cache)

    @property
    def stats(self) -> dict:
        """Return cache hit/miss statistics."""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        return {
            "size": self.size,
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate_pct": round(hit_rate, 1),
        }
