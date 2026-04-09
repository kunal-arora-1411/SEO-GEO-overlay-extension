import json
import logging

from api.schemas import EnrichRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

HEADING_OPTIMIZER_SYSTEM_PROMPT = """\
You are an SEO and GEO (Generative Engine Optimization) expert.

Given a page's headings, suggest improvements that maximise both traditional SEO and AI engine citation:
- H1 must include the primary keyword and be specific (not generic)
- H2s should use question format (What/How/Why/When/Which) where natural
- Maintain logical H1 → H2 → H3 hierarchy
- Avoid generic labels like "Introduction", "Conclusion", "Overview"

Return ONLY valid JSON — no markdown fences, no extra text:
{"h1_suggestion": "Improved H1 text", "h2_suggestions": ["Improved H2 1", "Improved H2 2"], "reason": "One sentence explaining the key change"}
"""


class HeadingOptimizer:
    """Suggests improved headings for SEO and AI citation eligibility."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def optimize(self, request: EnrichRequest, primary_keyword: str | None = None) -> dict | None:
        """Return {h1_suggestion, h2_suggestions, reason} or None on failure."""
        user_prompt = self._build_prompt(request, primary_keyword)
        raw = await self._llm.analyze(HEADING_OPTIMIZER_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            h1 = data.get("h1_suggestion", "")
            h2s = data.get("h2_suggestions", [])
            reason = data.get("reason", "")
            if not h1:
                return None
            if not isinstance(h2s, list):
                h2s = []
            return {
                "h1_suggestion": str(h1).strip(),
                "h2_suggestions": [str(h).strip() for h in h2s[:8] if h],
                "reason": str(reason).strip(),
            }
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error("HeadingOptimizer failed to parse response: %s", raw[:200])
            return None

    @staticmethod
    def _build_prompt(request: EnrichRequest, primary_keyword: str | None) -> str:
        h1 = request.h1 or "(none)"
        h2s = "\n".join(f"  - {h}" for h in request.h2s[:10]) if request.h2s else "  (none)"
        keyword = primary_keyword or "(unknown)"

        return (
            f"Primary keyword: {keyword}\n"
            f"Current H1: {h1}\n"
            f"Current H2 headings:\n{h2s}\n"
        )
