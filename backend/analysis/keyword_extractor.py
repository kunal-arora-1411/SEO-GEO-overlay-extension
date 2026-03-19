import json
import logging

from api.schemas import AnalyzeRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

KEYWORD_SYSTEM_PROMPT = """\
You are an SEO keyword extraction expert.

Given metadata about a web page, extract the single most important primary
keyword/phrase and a list of LSI (latent semantic indexing) keywords that
are topically related.

Also estimate the keyword density of the primary keyword in the content
(as a decimal, e.g. 0.02 for 2%).

Return JSON:
{"primary": "primary keyword phrase", "lsi": ["keyword1", "keyword2", "keyword3"], "density": 0.02}
"""

_DEFAULT_RESULT: dict = {"primary": None, "lsi": []}


class KeywordExtractor:
    """Extracts primary and LSI keywords from page content using an LLM."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def extract(self, request: AnalyzeRequest) -> dict:
        """Return a dict with ``primary`` (str | None) and ``lsi``
        (list[str]) keys."""

        user_prompt = self._build_prompt(request)

        raw = await self._llm.analyze(KEYWORD_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            primary = data.get("primary")
            lsi = data.get("lsi", [])
            density = data.get("density", 0.0)

            if not isinstance(lsi, list):
                lsi = []

            return {
                "primary": primary if isinstance(primary, str) else None,
                "lsi": [str(k) for k in lsi],
                "density": float(density) if density else 0.0,
            }
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error(
                "Failed to parse keyword extractor response: %s", raw[:200]
            )
            return dict(_DEFAULT_RESULT)

    @staticmethod
    def _build_prompt(request: AnalyzeRequest) -> str:
        title = request.meta.title or "(none)"
        h1_text = request.headings.h1[0].text if request.headings.h1 else "(none)"
        h2_texts = ", ".join(h.text for h in request.headings.h2[:10]) or "(none)"
        first_1000 = (request.content.full_text or "")[:1000]

        return (
            f"URL: {request.url}\n"
            f"Title: {title}\n"
            f"H1: {h1_text}\n"
            f"H2s: {h2_texts}\n\n"
            f"First 1000 characters of content:\n{first_1000}\n"
        )
