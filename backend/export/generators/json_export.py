"""Generate a formatted JSON report from analysis data."""

import json
from datetime import datetime, timezone
from typing import Any


def generate_json_report(analysis_data: dict[str, Any]) -> str:
    """Produce a formatted JSON string containing all analysis data.

    The output includes metadata, scores, issues, suggestions, and page
    data with consistent key naming. Datetime objects are serialized to
    ISO 8601 strings.

    Args:
        analysis_data: Dict containing the full analysis output.

    Returns:
        Pretty-printed JSON string.
    """
    report = {
        "report": {
            "generator": "SEO & GEO Optimizer",
            "version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "analysis": {
            "url": analysis_data.get("url", ""),
            "domain": analysis_data.get("domain", ""),
            "intent": analysis_data.get("intent", "unknown"),
            "primary_keyword": analysis_data.get("primary_keyword"),
        },
        "scores": {
            "seo_score": analysis_data.get("seo_score", 0),
            "geo_score": analysis_data.get("geo_score", 0),
            "combined_score": analysis_data.get("combined_score", 0),
            "grade": _score_to_grade(
                float(analysis_data.get("combined_score", 0))
            ),
        },
        "categories": _serialize_categories(
            analysis_data.get("geo_categories", {})
        ),
        "issues": _serialize_issues(
            analysis_data.get("geo_issues", [])
        ),
        "suggestions": _serialize_suggestions(
            analysis_data.get("suggestions", [])
        ),
        "page_data": _serialize_value(
            analysis_data.get("page_data", {})
        ),
    }

    return json.dumps(report, indent=2, default=_json_serializer, ensure_ascii=False)


def _serialize_categories(categories: Any) -> dict[str, Any]:
    """Normalize category data for JSON output."""
    if not isinstance(categories, dict):
        return {}

    result: dict[str, Any] = {}
    for name, data in categories.items():
        if isinstance(data, dict):
            result[name] = {
                "score": data.get("score", 0),
                "max_score": data.get("max_score", 100),
                "findings": data.get("findings", []),
            }
        else:
            result[name] = {
                "score": float(data) if data is not None else 0,
                "max_score": 100,
                "findings": [],
            }
    return result


def _serialize_issues(issues: Any) -> list[dict[str, Any]]:
    """Normalize issue data for JSON output."""
    if not isinstance(issues, list):
        return []

    result: list[dict[str, Any]] = []
    for issue in issues:
        if isinstance(issue, dict):
            result.append({
                "type": issue.get("type", "unknown"),
                "message": issue.get("message", str(issue)),
                "impact": issue.get("impact", 0),
                "element": issue.get("element", ""),
            })
        else:
            result.append({
                "type": "general",
                "message": str(issue),
                "impact": 0,
                "element": "",
            })
    return result


def _serialize_suggestions(suggestions: Any) -> list[dict[str, Any]]:
    """Normalize suggestion data for JSON output."""
    if not isinstance(suggestions, list):
        return []

    result: list[dict[str, Any]] = []
    for sug in suggestions:
        if isinstance(sug, dict):
            result.append({
                "type": sug.get("type", "general"),
                "element": sug.get("element", ""),
                "selector": sug.get("selector"),
                "original": sug.get("original"),
                "suggestion": sug.get("suggestion", ""),
                "reason": sug.get("reason", ""),
                "impact": sug.get("impact", 0),
            })
        else:
            result.append({
                "type": "general",
                "element": "",
                "selector": None,
                "original": None,
                "suggestion": str(sug),
                "reason": "",
                "impact": 0,
            })
    return result


def _serialize_value(value: Any) -> Any:
    """Recursively handle datetime serialization in nested dicts/lists."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def _json_serializer(obj: Any) -> Any:
    """Custom JSON serializer for objects not serializable by default."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _score_to_grade(score: float) -> str:
    """Convert a numeric score to a letter grade."""
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "F"
