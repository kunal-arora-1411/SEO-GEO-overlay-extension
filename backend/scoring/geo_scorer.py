import json
import logging
from typing import Any

from api.schemas import AnalyzeRequest, GEOCategoryScore
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

GEO_SYSTEM_PROMPT = """\
You are a Generative Engine Optimization (GEO) expert.
You analyze web content for its likelihood of being cited by AI search engines
(ChatGPT, Perplexity, Google AI Overviews, Claude).

Score the content on these 5 dimensions. For each, provide a score out of the max and a list of specific findings.

Return JSON:
{
  "answer_architecture": {"score": 0-25, "findings": ["finding1", "finding2"]},
  "citation_worthiness": {"score": 0-25, "findings": []},
  "machine_readability": {"score": 0-20, "findings": []},
  "content_precision": {"score": 0-15, "findings": []},
  "multi_engine": {"score": 0-15, "findings": []},
  "issues": [{"type": "warning", "impact": 1-10, "element": "what", "message": "specific issue"}]
}

SCORING CRITERIA (from Princeton KDD 2024 GEO research):

ANSWER ARCHITECTURE (25 pts):
- Does the opening directly answer the page's core question in 1-2 sentences? (6pts)
- Are there FAQ-style Q&A pairs with self-contained 2-4 sentence answers? (5pts)
- Are key terms explicitly defined (not assumed)? (4pts)
- Is comparison data presented structurally (tables, vs. format)? (5pts)
- Can each H2 section stand alone as an answer to a sub-query? (5pts)

CITATION WORTHINESS (25 pts):
- Does content include specific statistics with sources? (7pts)
- Are claims attributed to named sources/studies? (5pts)
- Are expert quotes included? (4pts)
- Is there a visible publication/update date within last 3 months? (5pts)
- Is there clear author attribution with credentials? (4pts)

MACHINE READABILITY (20 pts):
- Is JSON-LD schema markup present (Article, FAQPage, etc.)? (5pts)
- Does content use semantic HTML (proper headings, lists, tables)? (4pts)
- Is important text in HTML (not images)? (3pts)
- Is content in initial HTML (not JS-loaded only)? (4pts)
- Are AI crawlers not blocked? (2pts)
- Is there an llms.txt reference? (2pts)

CONTENT PRECISION (15 pts):
- Uses specific entity names, products, numbers over vague references? (5pts)
- Each paragraph has at least one verifiable claim? (5pts)
- No filler sentences adding zero information? (5pts)

MULTI-ENGINE (15 pts):
- Has Wikipedia-like neutral tone for definitions? (5pts)
- Addresses practical, experience-based questions? (5pts)
- Opening answers main question in first 50 words? (5pts)
"""

# Category name -> max score mapping
_CATEGORY_MAX: dict[str, float] = {
    "answer_architecture": 25.0,
    "citation_worthiness": 25.0,
    "machine_readability": 20.0,
    "content_precision": 15.0,
    "multi_engine": 15.0,
}


class GEOScorer:
    """Scores page content across five GEO dimensions using an LLM."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def score(
        self,
        request: AnalyzeRequest,
        intent: str,
        keywords: dict[str, Any],
    ) -> dict[str, Any]:
        """Return a dict with ``score`` (int 0-100), ``categories``
        (dict of GEOCategoryScore-compatible dicts), and ``issues``."""

        user_prompt = self._build_user_prompt(request, intent, keywords)

        raw = await self._llm.analyze(GEO_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.error("Failed to parse GEO scorer LLM response: %s", raw[:200])
            return self._fallback_result()

        return self._parse_result(data)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_user_prompt(
        self,
        request: AnalyzeRequest,
        intent: str,
        keywords: dict[str, Any],
    ) -> str:
        # Collect headings text
        headings_lines: list[str] = []
        for h1 in request.headings.h1:
            headings_lines.append(f"H1: {h1.text}")
        for h2 in request.headings.h2:
            headings_lines.append(f"H2: {h2.text}")
        for h3 in request.headings.h3:
            headings_lines.append(f"H3: {h3.text}")
        headings_text = "\n".join(headings_lines) if headings_lines else "(none)"

        # Truncate full text to 10 000 characters
        content_text = (request.content.full_text or "")[:10000]

        # Schema info
        schema_types = ", ".join(request.structured_data.json_ld_types) or "none"
        has_schema = "yes" if request.structured_data.has_schema else "no"

        primary_kw = keywords.get("primary", "unknown")

        return (
            f"URL: {request.url}\n"
            f"Title: {request.meta.title or '(none)'}\n"
            f"Meta description: {request.meta.meta_description or '(none)'}\n"
            f"Author: {request.meta.author or '(none)'}\n"
            f"Language: {request.meta.language or '(none)'}\n"
            f"Intent: {intent}\n"
            f"Primary keyword: {primary_kw}\n\n"
            f"HEADINGS:\n{headings_text}\n\n"
            f"CONTENT (first 10 000 chars):\n{content_text}\n\n"
            f"STATS:\n"
            f"  Word count: {request.content.word_count}\n"
            f"  Sentence count: {request.content.sentence_count}\n"
            f"  Paragraph count: {request.content.paragraph_count}\n"
            f"  Lists: {len(request.content.lists)}\n"
            f"  Tables: {len(request.content.tables)}\n\n"
            f"READABILITY:\n"
            f"  Flesch Reading Ease: {request.readability.flesch_reading_ease}\n"
            f"  Flesch-Kincaid Grade: {request.readability.flesch_kincaid_grade}\n"
            f"  SMOG Index: {request.readability.smog_index}\n\n"
            f"STRUCTURED DATA:\n"
            f"  Schema types: {schema_types}\n"
            f"  Has schema: {has_schema}\n\n"
            f"LINKS:\n"
            f"  Internal: {request.links.internal_count}\n"
            f"  External: {request.links.external_count}\n"
            f"  Broken: {request.links.broken_count}\n"
        )

    def _parse_result(self, data: dict[str, Any]) -> dict[str, Any]:
        categories: dict[str, GEOCategoryScore] = {}
        total_score = 0.0

        for cat_key, max_score in _CATEGORY_MAX.items():
            cat_data = data.get(cat_key, {})
            if isinstance(cat_data, dict):
                raw_score = float(cat_data.get("score", 0))
                # Clamp to valid range
                clamped = max(0.0, min(raw_score, max_score))
                findings = cat_data.get("findings", [])
                if not isinstance(findings, list):
                    findings = []
            else:
                clamped = 0.0
                findings = []

            total_score += clamped
            categories[cat_key] = GEOCategoryScore(
                score=clamped,
                max_score=max_score,
                findings=[str(f) for f in findings],
            )

        issues = data.get("issues", [])
        if not isinstance(issues, list):
            issues = []

        return {
            "score": int(round(total_score)),
            "categories": categories,
            "issues": issues,
        }

    @staticmethod
    def _fallback_result() -> dict[str, Any]:
        categories: dict[str, GEOCategoryScore] = {}
        for cat_key, max_score in _CATEGORY_MAX.items():
            categories[cat_key] = GEOCategoryScore(
                score=0.0,
                max_score=max_score,
                findings=["Unable to analyze -- LLM response could not be parsed"],
            )
        return {
            "score": 0,
            "categories": categories,
            "issues": [
                {
                    "type": "error",
                    "impact": 10,
                    "element": "analysis",
                    "message": "GEO analysis failed. Please try again.",
                }
            ],
        }
