"""Validates generated JSON-LD schema markup."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {"@context", "@type"}

VALID_CONTEXTS = {
    "https://schema.org",
    "http://schema.org",
    "https://schema.org/",
    "http://schema.org/",
}

KNOWN_TYPES = {
    "Article", "NewsArticle", "BlogPosting", "TechArticle",
    "FAQPage", "HowTo", "Product", "Review", "Organization",
    "Person", "WebPage", "WebSite", "BreadcrumbList",
    "LocalBusiness", "Event", "Recipe", "VideoObject",
    "SoftwareApplication", "Course", "ItemList",
}


def validate_schema(schema: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate a JSON-LD schema object.

    Returns (is_valid, list_of_issues).
    """
    issues: list[str] = []

    if not isinstance(schema, dict):
        return False, ["Schema must be a JSON object"]

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in schema:
            issues.append(f"Missing required field: {field}")

    if issues:
        return False, issues

    # Validate @context
    context = schema.get("@context", "")
    if context not in VALID_CONTEXTS:
        issues.append(f"Invalid @context: {context}. Use 'https://schema.org'")

    # Validate @type
    schema_type = schema.get("@type", "")
    if isinstance(schema_type, list):
        for t in schema_type:
            if t not in KNOWN_TYPES:
                issues.append(f"Unknown @type: {t}")
    elif schema_type not in KNOWN_TYPES:
        issues.append(f"Unknown @type: {schema_type}. Consider using a standard Schema.org type")

    # Validate no empty required properties
    if schema_type == "Article" or schema_type == "BlogPosting":
        if not schema.get("headline"):
            issues.append("Article schema should include 'headline'")

    if schema_type == "FAQPage":
        main_entity = schema.get("mainEntity", [])
        if not main_entity:
            issues.append("FAQPage schema should include 'mainEntity' with Q&A pairs")

    if schema_type == "Product":
        if not schema.get("name"):
            issues.append("Product schema should include 'name'")

    # Check JSON serialization
    try:
        json.dumps(schema)
    except (TypeError, ValueError) as e:
        issues.append(f"Schema is not JSON-serializable: {e}")

    is_valid = len(issues) == 0
    return is_valid, issues


def fix_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Attempt to fix common schema issues."""
    fixed = dict(schema)

    # Fix @context
    context = fixed.get("@context", "")
    if context not in VALID_CONTEXTS:
        fixed["@context"] = "https://schema.org"

    return fixed
