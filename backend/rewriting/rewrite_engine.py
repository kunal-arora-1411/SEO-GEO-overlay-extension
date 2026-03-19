import json
import logging
from typing import Any

from api.schemas import AnalyzeRequest, Suggestion
from services.llm_service import LLMService
from rewriting.prompt_templates import REWRITE_SYSTEM_PROMPT, REWRITE_USER_PROMPT

logger = logging.getLogger(__name__)


class RewriteEngine:
    """Generates concrete rewrite suggestions using an LLM."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def generate(
        self,
        request: AnalyzeRequest,
        intent: str,
        keywords: dict[str, Any],
        geo_result: dict[str, Any],
        max_suggestions: int = 5,
    ) -> list[Suggestion]:
        """Return a list of ``Suggestion`` objects sorted by impact
        (highest first).  Returns an empty list on any failure."""

        user_prompt = self._build_user_prompt(
            request, intent, keywords, geo_result, max_suggestions
        )

        raw = await self._llm.rewrite(REWRITE_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
            raw_suggestions = data.get("suggestions", [])
            if not isinstance(raw_suggestions, list):
                return []

            suggestions: list[Suggestion] = []
            for item in raw_suggestions:
                if not isinstance(item, dict):
                    continue
                try:
                    impact = int(item.get("impact", 5))
                    impact = max(1, min(10, impact))

                    suggestions.append(
                        Suggestion(
                            type=str(item.get("type", "paragraph")),
                            element=str(item.get("element", "")),
                            selector=item.get("selector"),
                            original=item.get("original"),
                            suggestion=str(item.get("suggestion", "")),
                            reason=str(item.get("reason", "")),
                            impact=impact,
                        )
                    )
                except (ValueError, TypeError) as exc:
                    logger.warning("Skipping malformed suggestion: %s", exc)
                    continue

            # Sort by impact descending
            suggestions.sort(key=lambda s: s.impact, reverse=True)
            return suggestions[:max_suggestions]

        except (json.JSONDecodeError, TypeError):
            logger.error("Failed to parse rewrite engine response: %s", raw[:200])
            return []

    # ------------------------------------------------------------------
    # Prompt building
    # ------------------------------------------------------------------

    def _build_user_prompt(
        self,
        request: AnalyzeRequest,
        intent: str,
        keywords: dict[str, Any],
        geo_result: dict[str, Any],
        max_suggestions: int,
    ) -> str:
        # SEO issues text
        seo_lines: list[str] = []
        for issue in request.seo_issues:
            seo_lines.append(
                f"- [{issue.type}] {issue.element}: {issue.message} (impact: {issue.impact})"
            )
        seo_issues_text = "\n".join(seo_lines) if seo_lines else "(none)"

        # GEO issues text
        geo_issues = geo_result.get("issues", [])
        geo_lines: list[str] = []
        for issue in geo_issues:
            if isinstance(issue, dict):
                geo_lines.append(
                    f"- [{issue.get('type', 'warning')}] "
                    f"{issue.get('element', '?')}: "
                    f"{issue.get('message', '')} "
                    f"(impact: {issue.get('impact', '?')})"
                )
        geo_issues_text = "\n".join(geo_lines) if geo_lines else "(none)"

        # Headings text
        heading_lines: list[str] = []
        for h1 in request.headings.h1:
            heading_lines.append(f"H1: {h1.text}")
        for h2 in request.headings.h2:
            heading_lines.append(f"H2: {h2.text}")
        for h3 in request.headings.h3:
            heading_lines.append(f"H3: {h3.text}")
        headings_text = "\n".join(heading_lines) if heading_lines else "(none)"

        # Weak paragraphs -- pick the shortest ones by word count
        sorted_paras = sorted(
            request.content.paragraphs, key=lambda p: p.word_count
        )
        weak = sorted_paras[:5]
        weak_lines: list[str] = []
        for p in weak:
            selector_info = f" [{p.selector}]" if p.selector else ""
            text_preview = p.text[:200]
            weak_lines.append(
                f"- Paragraph {p.index}{selector_info} ({p.word_count} words): "
                f"{text_preview}"
            )
        weak_paragraphs_text = "\n".join(weak_lines) if weak_lines else "(none)"

        primary_keyword = keywords.get("primary", "(unknown)")

        return REWRITE_USER_PROMPT.format(
            url=request.url,
            intent=intent,
            primary_keyword=primary_keyword,
            title=request.meta.title or "(none)",
            meta_description=request.meta.meta_description or "(none)",
            seo_issues_text=seo_issues_text,
            geo_issues_text=geo_issues_text,
            headings_text=headings_text,
            weak_paragraphs_text=weak_paragraphs_text,
            max_suggestions=max_suggestions,
        )
