import json
import logging

from api.schemas import EnrichRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

FAQ_SYSTEM_PROMPT = """\
You are an AI-search optimization expert.

Generate 4-6 FAQ question-answer pairs for this page content that:
- Match natural language search queries users ask ChatGPT, Perplexity, or Google AIO
- Are concise and directly answerable (answer within 60 words)
- Cover the most common user intents around the topic
- Use plain language, no jargon

Return ONLY valid JSON — no markdown fences, no extra text:
{"faqs": [{"q": "question text", "a": "answer text (max 60 words)"}]}
"""


class FAQGenerator:
    """Generates FAQ pairs for AI-engine snippet eligibility."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def generate(self, request: EnrichRequest) -> list[dict]:
        """Return a list of {q, a} dicts or empty list on failure."""
        user_prompt = self._build_prompt(request)
        raw = await self._llm.analyze(FAQ_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            faqs = data.get("faqs", [])
            if not isinstance(faqs, list):
                return []
            # Validate each entry has q and a
            return [f for f in faqs if isinstance(f, dict) and f.get("q") and f.get("a")]
        except (json.JSONDecodeError, TypeError, AttributeError):
            logger.error("FAQGenerator failed to parse response: %s", raw[:200])
            return []

    @staticmethod
    def _build_prompt(request: EnrichRequest) -> str:
        title = request.title or "(none)"
        h1 = request.h1 or "(none)"
        h2s = "\n".join(f"  - {h}" for h in request.h2s[:10]) if request.h2s else "  (none)"
        excerpt = (request.content_excerpt or "")[:1000]

        return (
            f"Page title: {title}\n"
            f"H1: {h1}\n"
            f"H2 headings:\n{h2s}\n\n"
            f"Content excerpt (first 1000 chars):\n{excerpt}\n"
        )
