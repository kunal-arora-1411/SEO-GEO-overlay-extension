from fastapi import Request

from services.cache_service import CacheService


async def get_cache(request: Request) -> CacheService:
    return request.app.state.cache
