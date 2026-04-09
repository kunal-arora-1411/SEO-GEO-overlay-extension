import json
import logging

from api.schemas import EnrichRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

META_DESC_SYSTEM_PROMPT = """\
You are an SEO expert. Generate one compelling meta description for this page.

Requirements:
- 145-160 characters (count carefully)
- Include the primary keyword near the start
- End with a soft call-to-action (e.g. "Learn more", "Find out how", "Discover")
- Factual and informative, not promotional or hype-filled
- Do NOT start with the site/brand name

Return ONLY valid JSON — no markdown fences, no extra text:
{"meta_description": "...", "char_count": 155}
"""


class MetaDescriptionGenerator:
    """Generates an optimised meta description for a page."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def generate(self, request: EnrichRequest, primary_keyword: str | None = None) -> str | None:
        """Return a meta description string or None on failure."""
        user_prompt = self._build_prompt(request, primary_keyword)
        raw = await self._llm.analyze(META_DESC_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            desc = data.get("meta_description", "")
            if not desc or len(desc) < 50:
                logger.warning("MetaDescriptionGenerator: short/empty result")
                return None
            return desc.strip()
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error("MetaDescriptionGenerator failed to parse response: %s", raw[:200])
            return None

    @staticmethod
    def _build_prompt(request: EnrichRequest, primary_keyword: str | None) -> str:
        title = request.title or "(none)"
        h1 = request.h1 or "(none)"
        keyword = primary_keyword or "(unknown)"
        excerpt = (request.content_excerpt or "")[:500]

        return (
            f"Page title: {title}\n"
            f"H1: {h1}\n"
            f"Primary keyword: {keyword}\n\n"
            f"Content excerpt (first 500 chars):\n{excerpt}\n"
        )
