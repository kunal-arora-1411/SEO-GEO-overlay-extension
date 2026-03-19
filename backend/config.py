from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SEO-GEO Optimizer API"
    debug: bool = False
    cors_origins: list[str] = ["*"]
    gemini_api_key: str = ""
    gemini_model_analysis: str = "gemini-2.0-flash"
    gemini_model_rewrite: str = "gemini-2.0-flash"
    llm_temperature: float = 0.3
    llm_max_tokens_analysis: int = 2000
    llm_max_tokens_rewrite: int = 1000
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 86400
    max_requests_per_minute: int = 10
    max_requests_per_day: int = 100

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/seo_geo_optimizer"

    # JWT Authentication
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Stripe Billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_ids: dict[str, str] = {
        "starter": "",
        "pro": "",
        "agency": "",
    }

    # Tier limits (scans per day; -1 = unlimited)
    tier_limits: dict[str, int] = {
        "free": 3,
        "starter": 50,
        "pro": 200,
        "agency": -1,
    }

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Observability
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    class Config:
        env_file = ".env"
