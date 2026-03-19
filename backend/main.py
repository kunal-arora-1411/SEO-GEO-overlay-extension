from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import Settings
from services.cache_service import CacheService
from api.routes import router
from auth.router import router as auth_router
from auth.google import router as google_auth_router
from billing.router import router as billing_router
from schema_gen.router import router as schema_router
from audit.router import router as audit_router
from analytics.router import router as analytics_router
from history.router import router as history_router
from teams.router import router as teams_router
from competitors.router import router as competitors_router
from brand_voice.router import router as brand_voice_router
from export.router import router as export_router
from db.session import init_db, close_db
from observability.logging import setup_logging
from observability.sentry import init_sentry
from observability.posthog import init_posthog


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    setup_logging(debug=settings.debug)
    init_sentry(dsn=settings.sentry_dsn, environment=settings.sentry_environment)
    init_posthog(api_key=settings.posthog_api_key, host=settings.posthog_host)
    cache = CacheService(settings.redis_url)
    app.state.cache = cache
    app.state.settings = settings
    await init_db(settings.database_url)
    yield
    await close_db()
    await cache.close()


app = FastAPI(
    title="SEO-GEO Optimizer API",
    version="1.0.0",
    lifespan=lifespan,
)

settings = Settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(google_auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(schema_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(competitors_router, prefix="/api/v1")
app.include_router(brand_voice_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "seo-geo-optimizer"}
