"""Generate a CSV report from analysis data."""

import csv
import io
from typing import Any


def generate_csv_report(analysis_data: dict[str, Any]) -> str:
    """Produce a CSV-formatted string from analysis data.

    Columns: URL, SEO Score, GEO Score, Combined, Grade, Issue Count, Top Issues

    If the analysis data contains multiple pages (e.g. from an audit), each
    page gets its own row. For a single-page analysis, a single row is emitted.

    Args:
        analysis_data: Dict containing seo_score, geo_score, combined_score,
            geo_issues, url, etc. May also contain a 'pages' key for
            multi-page audits.

    Returns:
        CSV content as a string (UTF-8).
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header row
    writer.writerow([
        "URL",
        "SEO Score",
        "GEO Score",
        "Combined Score",
        "Grade",
        "Intent",
        "Primary Keyword",
        "Issue Count",
        "Top Issues",
    ])

    pages = analysis_data.get("pages")
    if pages and isinstance(pages, list):
        # Multi-page audit format
        for page in pages:
            _write_page_row(writer, page)
    else:
        # Single analysis format
        _write_page_row(writer, analysis_data)

    return output.getvalue()


def _write_page_row(writer: csv.writer, data: dict[str, Any]) -> None:
    """Write a single CSV row for a page or analysis result."""
    url = data.get("url", "")
    seo_score = data.get("seo_score", 0)
    geo_score = data.get("geo_score", 0)
    combined = data.get("combined_score", 0)

    if not combined and (seo_score or geo_score):
        combined = round((float(seo_score) + float(geo_score)) / 2, 1)

    grade = _score_to_grade(float(combined))
    intent = data.get("intent", "")
    primary_keyword = data.get("primary_keyword", "")

    # Issues
    issues = data.get("geo_issues", [])
    if not issues:
        issues = data.get("issues", [])
    issue_count = len(issues)

    # Top 3 issues as semicolon-separated string
    top_issues_parts: list[str] = []
    for issue in issues[:3]:
        if isinstance(issue, dict):
            msg = issue.get("message", issue.get("type", str(issue)))
        else:
            msg = str(issue)
        top_issues_parts.append(msg)
    top_issues = "; ".join(top_issues_parts)

    writer.writerow([
        url,
        seo_score,
        geo_score,
        combined,
        grade,
        intent,
        primary_keyword or "",
        issue_count,
        top_issues,
    ])


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
