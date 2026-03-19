"""Celery tasks for asynchronous brand voice training."""

import asyncio
import logging
from datetime import datetime, timezone

from celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=2, default_retry_delay=120)
def train_brand_voice_task(self, voice_id: str, sample_urls: list[str]) -> dict:
    """Asynchronously train a brand voice profile via Celery.

    Fetches sample URLs, computes style metrics, and stores the result
    back into the in-memory voice registry.

    Args:
        voice_id: ID of the brand voice record to update.
        sample_urls: URLs to fetch and analyse for style.

    Returns:
        Dict with training status and style metrics.
    """
    from brand_voice.trainer import BrandVoiceTrainer
    from brand_voice.router import _voices

    logger.info("Starting brand voice training task for %s", voice_id)

    voice = _voices.get(voice_id)
    if voice is None:
        logger.warning("Brand voice %s not found; task aborted", voice_id)
        return {"voice_id": voice_id, "status": "failed", "error": "Voice not found"}

    voice["status"] = "training"

    try:
        trainer = BrandVoiceTrainer()
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(trainer.train(sample_urls=sample_urls))
        finally:
            loop.close()

        voice["status"] = result["status"]
        voice["style_metrics"] = result.get("style_metrics")
        voice["style_description"] = result.get("style_description")

        logger.info(
            "Brand voice %s training complete with status: %s",
            voice_id, result["status"],
        )

        return {
            "voice_id": voice_id,
            "status": result["status"],
            "style_metrics": result.get("style_metrics"),
        }

    except Exception as exc:
        logger.exception("Brand voice training task failed for %s", voice_id)
        voice["status"] = "failed"
        raise self.retry(exc=exc)
