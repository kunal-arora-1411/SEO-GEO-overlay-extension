"""Celery tasks for asynchronous competitor analysis."""

import asyncio
import logging
from datetime import datetime, timezone

from celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_competitor_task(self, competitor_id: str, url: str) -> dict:
    """Asynchronously analyse a competitor page via Celery.

    This task wraps the async CompetitorAnalyzer in a synchronous Celery
    task by running the coroutine in a fresh event loop. Results are
    stored back into the in-memory competitor registry.

    Args:
        competitor_id: ID of the competitor record to update.
        url: URL to analyse.

    Returns:
        Dict with analysis results or error information.
    """
    from competitors.analyzer import CompetitorAnalyzer
    from competitors.router import _competitors

    logger.info("Starting competitor analysis task for %s (%s)", competitor_id, url)

    try:
        analyzer = CompetitorAnalyzer()
        loop = asyncio.new_event_loop()
        try:
            analysis = loop.run_until_complete(analyzer.analyze_competitor(url))
        finally:
            loop.close()

        if analysis.get("error"):
            logger.warning(
                "Competitor analysis for %s returned error: %s",
                url, analysis["error"],
            )
            # Retry on transient errors
            if "timed out" in str(analysis["error"]).lower():
                raise self.retry(exc=Exception(analysis["error"]))

            return {
                "competitor_id": competitor_id,
                "status": "failed",
                "error": analysis["error"],
            }

        # Update the in-memory competitor record
        competitor = _competitors.get(competitor_id)
        if competitor is not None:
            now = datetime.now(timezone.utc)
            competitor["last_analyzed"] = now
            competitor["seo_score"] = analysis.get("seo_score")
            competitor["geo_score"] = analysis.get("geo_score")
            competitor["analysis_data"] = analysis
            logger.info(
                "Competitor %s analysis complete: SEO=%.1f, GEO=%.1f",
                competitor_id,
                analysis.get("seo_score", 0),
                analysis.get("geo_score", 0),
            )
        else:
            logger.warning(
                "Competitor %s no longer exists; analysis results discarded",
                competitor_id,
            )

        return {
            "competitor_id": competitor_id,
            "status": "completed",
            "seo_score": analysis.get("seo_score"),
            "geo_score": analysis.get("geo_score"),
        }

    except self.MaxRetriesExceededError:
        logger.error(
            "Competitor analysis for %s exhausted all retries", competitor_id
        )
        return {
            "competitor_id": competitor_id,
            "status": "failed",
            "error": "Max retries exceeded",
        }
    except Exception as exc:
        logger.exception("Unexpected error in competitor analysis task for %s", url)
        raise self.retry(exc=exc)
