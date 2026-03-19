"""PostHog product analytics integration."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

_client: Any = None


def init_posthog(api_key: str, host: str = "https://app.posthog.com") -> None:
    """Initialize PostHog client for product analytics.

    Does nothing if api_key is empty.
    """
    global _client

    if not api_key:
        logger.info("PostHog API key not configured, skipping initialization")
        return

    try:
        import posthog

        posthog.project_api_key = api_key
        posthog.host = host
        _client = posthog
        logger.info("PostHog initialized")
    except ImportError:
        logger.warning("posthog not installed, skipping PostHog initialization")


def capture(
    distinct_id: str,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    """Capture a product analytics event.

    Silently no-ops if PostHog is not initialized.
    """
    if _client is None:
        return

    try:
        _client.capture(
            distinct_id=distinct_id,
            event=event,
            properties=properties or {},
        )
    except Exception:
        logger.debug("Failed to capture PostHog event: %s", event, exc_info=True)


def identify(
    distinct_id: str,
    properties: dict[str, Any] | None = None,
) -> None:
    """Identify a user with properties.

    Silently no-ops if PostHog is not initialized.
    """
    if _client is None:
        return

    try:
        _client.identify(distinct_id=distinct_id, properties=properties or {})
    except Exception:
        logger.debug("Failed to identify user in PostHog", exc_info=True)
