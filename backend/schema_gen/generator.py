"""LLM-powered JSON-LD schema generator."""

import json
import logging
from typing import Any

from services.llm_service import LLMService
from schema_gen.prompt_templates import SCHEMA_SYSTEM_PROMPT, SCHEMA_USER_PROMPT
from schema_gen.validator import validate_schema, fix_schema

logger = logging.getLogger(__name__)


class SchemaGenerator:
    """Generates JSON-LD structured data markup using an LLM."""

    def __init__(self, llm: LLMService) -> None:
        self._llm = llm

    async def generate(
        self,
        url: str,
        title: str,
        meta_description: str,
        intent: str,
        primary_keyword: str,
        headings: list[dict[str, Any]],
        content_text: str,
        existing_schemas: list[str],
    ) -> dict[str, Any]:
        """Generate and validate JSON-LD schema markup.

        Returns a dict with:
        - schema: the JSON-LD object
        - type_rationale: explanation of type choice
        - is_valid: whether validation passed
        - validation_issues: list of issues found
        - html_snippet: ready-to-paste <script> tag
        """
        user_prompt = self._build_prompt(
            url, title, meta_description, intent, primary_keyword,
            headings, content_text, existing_schemas,
        )

        raw = await self._llm.rewrite(SCHEMA_SYSTEM_PROMPT, user_prompt)

        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.error("Failed to parse schema generator response: %s", raw[:200])
            return self._fallback_result()

        schema = data.get("schema", {})
        type_rationale = data.get("type_rationale", "")

        if not isinstance(schema, dict) or "@type" not in schema:
            return self._fallback_result()

        # Validate and fix
        schema = fix_schema(schema)
        is_valid, issues = validate_schema(schema)

        # Generate HTML snippet
        html_snippet = (
            '<script type="application/ld+json">\n'
            + json.dumps(schema, indent=2)
            + "\n</script>"
        )

        return {
            "schema": schema,
            "type_rationale": type_rationale,
            "is_valid": is_valid,
            "validation_issues": issues,
            "html_snippet": html_snippet,
        }

    def _build_prompt(
        self,
        url: str,
        title: str,
        meta_description: str,
        intent: str,
        primary_keyword: str,
        headings: list[dict[str, Any]],
        content_text: str,
        existing_schemas: list[str],
    ) -> str:
        heading_lines = []
        for h in headings:
            level = h.get("level", "H2")
            text = h.get("text", "")
            heading_lines.append(f"{level}: {text}")
        headings_text = "\n".join(heading_lines) if heading_lines else "(none)"

        content_lower = content_text.lower()
        has_faq = "?" in content_text and any(
            q in content_lower for q in ["what is", "how to", "why", "when", "faq"]
        )
        has_howto = any(
            s in content_lower for s in ["step 1", "step one", "first,", "instructions"]
        )
        has_product = any(
            s in content_lower for s in ["price", "buy", "add to cart", "$", "product"]
        )
        has_review = any(
            s in content_lower for s in ["review", "rating", "stars", "recommend"]
        )

        return SCHEMA_USER_PROMPT.format(
            url=url,
            title=title or "(none)",
            meta_description=meta_description or "(none)",
            intent=intent,
            primary_keyword=primary_keyword or "(unknown)",
            has_faq="yes" if has_faq else "no",
            has_howto="yes" if has_howto else "no",
            has_product="yes" if has_product else "no",
            has_review="yes" if has_review else "no",
            existing_schemas=", ".join(existing_schemas) if existing_schemas else "none",
            headings_text=headings_text,
            content_preview=content_text[:2000],
        )

    @staticmethod
    def _fallback_result() -> dict[str, Any]:
        return {
            "schema": {},
            "type_rationale": "Schema generation failed",
            "is_valid": False,
            "validation_issues": ["LLM response could not be parsed"],
            "html_snippet": "",
        }
