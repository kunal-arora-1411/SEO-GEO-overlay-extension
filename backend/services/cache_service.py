import hashlib
import logging
from typing import Optional

import redis.asyncio as aioredis

from services.memory_cache import MemoryCache

logger = logging.getLogger(__name__)

# Default TTL if none is specified (24 hours)
_DEFAULT_TTL = 86400


class CacheService:
    """Multi-layer caching: L1 in-memory LRU → L2 Redis.

    L1 provides sub-millisecond lookups for hot keys.  L2 (Redis)
    provides persistence and shared state across workers.  All public
    methods fail gracefully when Redis is unavailable.
    """

    def __init__(self, redis_url: str) -> None:
        # L1: in-memory LRU (50 entries, 5 min TTL)
        self._l1 = MemoryCache(max_size=50, ttl_seconds=300)

        # L2: Redis
        try:
            self._redis = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception:
            logger.exception("Failed to create Redis client")
            self._redis = None

    async def get(self, key: str) -> Optional[str]:
        """Retrieve a cached value.  Checks L1 first, then L2."""
        # Check L1
        value = self._l1.get(key)
        if value is not None:
            return value

        # Check L2
        if self._redis is None:
            return None
        try:
            value = await self._redis.get(key)
            if value is not None:
                # Promote to L1
                self._l1.set(key, value)
            return value
        except Exception:
            logger.warning("Redis GET failed for key=%s", key, exc_info=True)
            return None

    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> None:
        """Store a value in both L1 and L2."""
        # Write to L1
        self._l1.set(key, value)

        # Write to L2
        if self._redis is None:
            return
        try:
            await self._redis.set(key, value, ex=ttl or _DEFAULT_TTL)
        except Exception:
            logger.warning("Redis SET failed for key=%s", key, exc_info=True)

    async def delete(self, key: str) -> None:
        """Remove a value from both cache layers."""
        self._l1.delete(key)
        if self._redis is None:
            return
        try:
            await self._redis.delete(key)
        except Exception:
            logger.warning("Redis DELETE failed for key=%s", key, exc_info=True)

    @staticmethod
    def make_key(url: str, content_hash: str) -> str:
        """Produce a deterministic cache key from a URL and content hash.

        The URL is itself hashed so that very long URLs do not cause key-
        length issues in Redis.
        """
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
        return f"seo-geo:{url_hash}:{content_hash}"

    @property
    def l1_stats(self) -> dict:
        """Return L1 cache statistics."""
        return self._l1.stats

    async def close(self) -> None:
        """Gracefully close the underlying Redis connection pool."""
        if self._redis is None:
            return
        try:
            await self._redis.close()
        except Exception:
            logger.warning("Error closing Redis connection", exc_info=True)
