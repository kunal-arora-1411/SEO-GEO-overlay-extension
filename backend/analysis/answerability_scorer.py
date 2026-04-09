import json
import logging

from api.schemas import EnrichRequest
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

ANSWERABILITY_SYSTEM_PROMPT = """\
You are a Generative Engine Optimization (GEO) expert.

Score this page's answerability for AI engines (ChatGPT, Perplexity, Google AIO) from 0-100.

Evaluate these dimensions:
1. Direct opening answer (0-25): Does the page open with a clear, direct answer?
2. FAQ / question coverage (0-25): Does the page answer common user questions?
3. Factual grounding (0-25): Are claims backed by data, sources, or examples?
4. Structure clarity (0-25): Are sections scannable and self-contained?

Identify the top 2-4 gaps that most reduce AI citation likelihood.

Return ONLY valid JSON — no markdown fences, no extra text:
{"score": 72, "breakdown": {"direct_opening": 18, "faq_coverage": 15, "factual_grounding": 20, "structure_clarity": 19}, "top_gaps": ["No FAQ section", "Opening paragraph is vague", "No cited statistics"]}
"""


class AnswerabilityScorer:
    """Scores how well a page can be cited by AI search engines."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def score(self, request: EnrichRequest) -> dict:
        """Return {score, top_gaps} or defaults on failure."""
        user_prompt = self._build_prompt(request)
        raw = await self._llm.analyze(ANSWERABILITY_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            score = int(data.get("score", 0))
            score = max(0, min(100, score))
            gaps = data.get("top_gaps", [])
            if not isinstance(gaps, list):
                gaps = []
            return {"score": score, "top_gaps": [str(g) for g in gaps[:4]]}
        except (json.JSONDecodeError, TypeError, AttributeError, ValueError):
            logger.error("AnswerabilityScorer failed to parse response: %s", raw[:200])
            return {"score": 0, "top_gaps": []}

    @staticmethod
    def _build_prompt(request: EnrichRequest) -> str:
        title = request.title or "(none)"
        h1 = request.h1 or "(none)"
        h2s = "\n".join(f"  - {h}" for h in request.h2s[:10]) if request.h2s else "  (none)"
        excerpt = (request.content_excerpt or "")[:800]
        word_count = request.word_count

        return (
            f"Page title: {title}\n"
            f"H1: {h1}\n"
            f"Word count: {word_count}\n"
            f"H2 headings:\n{h2s}\n\n"
            f"Content excerpt (first 800 chars):\n{excerpt}\n"
        )
