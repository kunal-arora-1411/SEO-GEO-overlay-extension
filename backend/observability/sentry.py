"""Sentry error tracking integration."""

import logging

logger = logging.getLogger(__name__)


def init_sentry(dsn: str, environment: str = "production") -> None:
    """Initialize Sentry SDK for error tracking.

    Does nothing if dsn is empty, allowing graceful degradation
    in development environments.
    """
    if not dsn:
        logger.info("Sentry DSN not configured, skipping initialization")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
        )
        logger.info("Sentry initialized for environment: %s", environment)
    except ImportError:
        logger.warning("sentry-sdk not installed, skipping Sentry initialization")
