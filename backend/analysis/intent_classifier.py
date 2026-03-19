import json
import logging

from api.schemas import AnalyzeRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

_VALID_INTENTS = frozenset(
    {
        "informational",
        "transactional",
        "navigational",
        "comparison",
        "how_to",
        "landing_page",
    }
)

INTENT_SYSTEM_PROMPT = """\
You are a search-intent classification expert.

Given metadata about a web page, classify its primary intent into exactly one
of these types:

- informational  -- educates or explains a topic
- transactional  -- drives a purchase, signup, or conversion
- navigational   -- helps users reach a specific brand/page
- comparison     -- compares products, services, or options
- how_to         -- step-by-step guide or tutorial
- landing_page   -- marketing/campaign landing page

Return JSON:
{"intent": "<type>", "confidence": <0.0-1.0>}
"""


class IntentClassifier:
    """Classifies the dominant intent of a page using an LLM."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def classify(self, request: AnalyzeRequest) -> str:
        """Return the intent string (e.g. ``"informational"``)."""

        user_prompt = self._build_prompt(request)

        raw = await self._llm.analyze(INTENT_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            intent = data.get("intent", "informational")
            if intent not in _VALID_INTENTS:
                logger.warning("LLM returned unknown intent '%s', defaulting", intent)
                return "informational"
            return intent
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error("Failed to parse intent classifier response: %s", raw[:200])
            return "informational"

    @staticmethod
    def _build_prompt(request: AnalyzeRequest) -> str:
        title = request.meta.title or "(none)"
        h1_text = request.headings.h1[0].text if request.headings.h1 else "(none)"
        first_500 = (request.content.full_text or "")[:500]
        word_count = request.content.word_count

        # Simple CTA detection heuristic
        cta_keywords = {"buy", "sign up", "subscribe", "get started", "add to cart", "free trial"}
        lower_text = (request.content.full_text or "").lower()
        has_cta = any(kw in lower_text for kw in cta_keywords)

        return (
            f"URL: {request.url}\n"
            f"Title: {title}\n"
            f"H1: {h1_text}\n"
            f"Word count: {word_count}\n"
            f"Has CTA: {'yes' if has_cta else 'no'}\n\n"
            f"First 500 characters of content:\n{first_500}\n"
        )
