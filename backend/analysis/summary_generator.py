import json
import logging

from api.schemas import EnrichRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """\
You are an AI content extraction expert.

Generate a TL;DR summary optimised for AI engine extraction (ChatGPT, Perplexity).

Requirements:
- 3-5 bullet points
- Each bullet under 20 words
- Factual and scannable
- Include the primary topic/keyword naturally
- No filler phrases like "This article covers..." or "In this guide..."

Return ONLY valid JSON — no markdown fences, no extra text:
{"summary_points": ["point 1", "point 2", "point 3"]}
"""


class SummaryGenerator:
    """Generates a TL;DR bullet summary for AI engine extraction."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def generate(self, request: EnrichRequest) -> list[str]:
        """Return a list of summary bullet strings or empty list on failure."""
        user_prompt = self._build_prompt(request)
        raw = await self._llm.analyze(SUMMARY_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            points = data.get("summary_points", [])
            if not isinstance(points, list):
                return []
            return [str(p).strip() for p in points[:5] if p]
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error("SummaryGenerator failed to parse response: %s", raw[:200])
            return []

    @staticmethod
    def _build_prompt(request: EnrichRequest) -> str:
        title = request.title or "(none)"
        h1 = request.h1 or "(none)"
        excerpt = (request.content_excerpt or "")[:1200]

        return (
            f"Page title: {title}\n"
            f"H1: {h1}\n\n"
            f"Content excerpt (first 1200 chars):\n{excerpt}\n"
        )
