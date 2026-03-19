"""Generate an HTML report with scores, issues, and suggestion diffs."""

from datetime import datetime, timezone
from typing import Any


def generate_html_report(analysis_data: dict[str, Any]) -> str:
    """Produce a standalone HTML report from analysis data.

    The report includes:
    - Cover section with overall scores
    - Score breakdown per category
    - Issues list with impact ratings
    - Suggestions with colour-coded diffs (green = added, red = removed)
    - Fully styled with inline CSS for email/download portability

    Args:
        analysis_data: Dict containing seo_score, geo_score, combined_score,
            geo_categories, geo_issues, suggestions, url, intent, etc.

    Returns:
        Complete HTML document as a string.
    """
    url = analysis_data.get("url", "Unknown URL")
    seo_score = analysis_data.get("seo_score", 0)
    geo_score = analysis_data.get("geo_score", 0)
    combined = analysis_data.get("combined_score", 0)
    intent = analysis_data.get("intent", "unknown")
    primary_keyword = analysis_data.get("primary_keyword", "N/A")
    categories = analysis_data.get("geo_categories", {})
    issues = analysis_data.get("geo_issues", [])
    suggestions = analysis_data.get("suggestions", [])
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Score colour helper
    def score_colour(score: float) -> str:
        if score >= 80:
            return "#22c55e"
        if score >= 60:
            return "#eab308"
        if score >= 40:
            return "#f97316"
        return "#ef4444"

    # Build category rows
    category_rows = ""
    for cat_name, cat_data in categories.items():
        if isinstance(cat_data, dict):
            cat_score = cat_data.get("score", 0)
            cat_max = cat_data.get("max_score", 100)
            findings = cat_data.get("findings", [])
        else:
            cat_score = float(cat_data) if cat_data else 0
            cat_max = 100
            findings = []

        pct = (cat_score / cat_max * 100) if cat_max > 0 else 0
        findings_html = "".join(f"<li>{f}</li>" for f in findings) if findings else "<li>No findings</li>"
        category_rows += f"""
        <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:500;">{_format_name(cat_name)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">
                <span style="color:{score_colour(pct)};font-weight:700;">{cat_score}</span> / {cat_max}
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
                <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
                    <div style="background:{score_colour(pct)};height:100%;width:{min(pct, 100):.0f}%;"></div>
                </div>
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;">
                <ul style="margin:0;padding-left:18px;">{findings_html}</ul>
            </td>
        </tr>"""

    # Build issues list
    issues_html = ""
    for issue in issues:
        if isinstance(issue, dict):
            msg = issue.get("message", issue.get("type", str(issue)))
            impact = issue.get("impact", "")
            impact_badge = f' <span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:3px;font-size:11px;">impact: {impact}</span>' if impact else ""
        else:
            msg = str(issue)
            impact_badge = ""
        issues_html += f'<li style="margin-bottom:6px;">{msg}{impact_badge}</li>'

    if not issues_html:
        issues_html = '<li style="color:#6b7280;">No issues detected</li>'

    # Build suggestion diffs
    suggestions_html = ""
    for idx, sug in enumerate(suggestions, 1):
        if isinstance(sug, dict):
            sug_type = sug.get("type", "general")
            element = sug.get("element", "")
            original = sug.get("original", "")
            suggestion_text = sug.get("suggestion", "")
            reason = sug.get("reason", "")
            impact = sug.get("impact", 0)
        else:
            sug_type = "general"
            element = ""
            original = ""
            suggestion_text = str(sug)
            reason = ""
            impact = 0

        diff_html = ""
        if original and suggestion_text:
            diff_html = f"""
            <div style="margin:8px 0;">
                <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;margin-bottom:4px;font-family:monospace;font-size:13px;white-space:pre-wrap;color:#991b1b;">- {_escape(original)}</div>
                <div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;font-family:monospace;font-size:13px;white-space:pre-wrap;color:#166534;">+ {_escape(suggestion_text)}</div>
            </div>"""
        elif suggestion_text:
            diff_html = f"""
            <div style="margin:8px 0;">
                <div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:8px 12px;font-family:monospace;font-size:13px;white-space:pre-wrap;color:#166534;">+ {_escape(suggestion_text)}</div>
            </div>"""

        reason_html = f'<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">{_escape(reason)}</p>' if reason else ""

        suggestions_html += f"""
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;">#{idx} {_format_name(sug_type)}</span>
                <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:12px;">
                    {element}
                </span>
            </div>
            {f'<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:3px;font-size:11px;">Impact: {impact}/10</span>' if impact else ""}
            {diff_html}
            {reason_html}
        </div>"""

    if not suggestions_html:
        suggestions_html = '<p style="color:#6b7280;">No suggestions generated.</p>'

    # Grade letter
    grade = _score_to_grade(combined)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEO &amp; GEO Analysis Report</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
    <div style="max-width:800px;margin:0 auto;padding:24px;">

        <!-- Cover -->
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);color:#fff;border-radius:12px;padding:32px;margin-bottom:24px;">
            <h1 style="margin:0 0 8px;font-size:24px;">SEO &amp; GEO Analysis Report</h1>
            <p style="margin:0 0 20px;opacity:0.85;font-size:14px;">{_escape(url)}</p>
            <div style="display:flex;gap:24px;flex-wrap:wrap;">
                <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:16px 24px;text-align:center;min-width:100px;">
                    <div style="font-size:36px;font-weight:700;">{seo_score}</div>
                    <div style="font-size:13px;opacity:0.8;">SEO Score</div>
                </div>
                <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:16px 24px;text-align:center;min-width:100px;">
                    <div style="font-size:36px;font-weight:700;">{geo_score}</div>
                    <div style="font-size:13px;opacity:0.8;">GEO Score</div>
                </div>
                <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:16px 24px;text-align:center;min-width:100px;">
                    <div style="font-size:36px;font-weight:700;">{combined}</div>
                    <div style="font-size:13px;opacity:0.8;">Combined</div>
                </div>
                <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:16px 24px;text-align:center;min-width:80px;">
                    <div style="font-size:36px;font-weight:700;">{grade}</div>
                    <div style="font-size:13px;opacity:0.8;">Grade</div>
                </div>
            </div>
            <div style="margin-top:16px;font-size:13px;opacity:0.7;">
                Intent: {intent} &middot; Keyword: {_escape(str(primary_keyword))} &middot; Generated: {generated_at}
            </div>
        </div>

        <!-- Category Breakdown -->
        <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin:0 0 16px;font-size:18px;">Score Breakdown</h2>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="border-bottom:2px solid #e5e7eb;">
                        <th style="text-align:left;padding:8px 10px;font-size:13px;color:#6b7280;">Category</th>
                        <th style="text-align:center;padding:8px 10px;font-size:13px;color:#6b7280;">Score</th>
                        <th style="text-align:left;padding:8px 10px;font-size:13px;color:#6b7280;width:120px;">Progress</th>
                        <th style="text-align:left;padding:8px 10px;font-size:13px;color:#6b7280;">Findings</th>
                    </tr>
                </thead>
                <tbody>
                    {category_rows if category_rows else '<tr><td colspan="4" style="padding:16px;color:#6b7280;text-align:center;">No category data available</td></tr>'}
                </tbody>
            </table>
        </div>

        <!-- Issues -->
        <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin:0 0 16px;font-size:18px;">Issues Found</h2>
            <ul style="margin:0;padding-left:20px;">
                {issues_html}
            </ul>
        </div>

        <!-- Suggestions with Diffs -->
        <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin:0 0 16px;font-size:18px;">Suggestions</h2>
            {suggestions_html}
        </div>

        <!-- Footer -->
        <div style="text-align:center;color:#9ca3af;font-size:12px;padding:16px 0;">
            Generated by SEO &amp; GEO Optimizer &middot; {generated_at}
        </div>

    </div>
</body>
</html>"""
    return html


def _escape(text: str) -> str:
    """HTML-escape special characters."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def _format_name(name: str) -> str:
    """Convert snake_case or kebab-case names to title case."""
    return name.replace("_", " ").replace("-", " ").title()


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
