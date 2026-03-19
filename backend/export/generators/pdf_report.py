"""Generate a PDF report from analysis data.

Uses a simple HTML-to-bytes approach. The actual PDF rendering is deferred
to WeasyPrint integration; for now the function returns the HTML content
encoded as bytes with a PDF-compatible structure header so downstream
consumers can handle it.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from export.generators.html_diff import generate_html_report

logger = logging.getLogger(__name__)


def generate_pdf_report(analysis_data: dict[str, Any]) -> bytes:
    """Produce PDF bytes from analysis data.

    Strategy:
    1. Try using WeasyPrint if available (production).
    2. Fall back to returning the HTML report as UTF-8 bytes with a
       minimal PDF wrapper when WeasyPrint is not installed.

    Args:
        analysis_data: Dict containing the full analysis output.

    Returns:
        PDF document as bytes.
    """
    html_content = generate_html_report(analysis_data)

    # Attempt WeasyPrint rendering
    try:
        from weasyprint import HTML as WeasyprintHTML
        pdf_bytes = WeasyprintHTML(string=html_content).write_pdf()
        logger.info("PDF generated via WeasyPrint (%d bytes)", len(pdf_bytes))
        return pdf_bytes
    except ImportError:
        logger.info(
            "WeasyPrint not available; generating lightweight PDF fallback"
        )
    except Exception:
        logger.exception("WeasyPrint rendering failed; using fallback")

    # Lightweight PDF fallback -- produces a valid PDF with the HTML
    # content embedded as text.  This is a minimal but spec-compliant PDF
    # that any viewer can open.
    return _build_minimal_pdf(analysis_data, html_content)


def _build_minimal_pdf(
    analysis_data: dict[str, Any],
    html_content: str,
) -> bytes:
    """Build a minimal valid PDF document with analysis summary text.

    Produces a single-page PDF containing the key scores and a note
    that the full report is available in HTML format.
    """
    url = analysis_data.get("url", "Unknown URL")
    seo_score = analysis_data.get("seo_score", 0)
    geo_score = analysis_data.get("geo_score", 0)
    combined = analysis_data.get("combined_score", 0)
    intent = analysis_data.get("intent", "unknown")
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    issues = analysis_data.get("geo_issues", [])
    suggestions = analysis_data.get("suggestions", [])

    # Build text lines for the PDF content stream
    lines: list[str] = [
        "SEO & GEO Analysis Report",
        "",
        f"URL: {url}",
        f"Generated: {generated_at}",
        "",
        f"SEO Score: {seo_score}",
        f"GEO Score: {geo_score}",
        f"Combined Score: {combined}",
        f"Grade: {_score_to_grade(float(combined))}",
        f"Intent: {intent}",
        f"Primary Keyword: {analysis_data.get('primary_keyword', 'N/A')}",
        "",
        f"Issues Found: {len(issues)}",
        f"Suggestions: {len(suggestions)}",
        "",
    ]

    # Add top issues
    if issues:
        lines.append("Top Issues:")
        for issue in issues[:5]:
            if isinstance(issue, dict):
                msg = issue.get("message", issue.get("type", str(issue)))
            else:
                msg = str(issue)
            lines.append(f"  - {msg}")
        lines.append("")

    # Add top suggestions
    if suggestions:
        lines.append("Top Suggestions:")
        for sug in suggestions[:5]:
            if isinstance(sug, dict):
                sug_text = sug.get("suggestion", str(sug))
                element = sug.get("element", "")
                lines.append(f"  [{element}] {sug_text}")
            else:
                lines.append(f"  - {str(sug)}")
        lines.append("")

    lines.append("Note: For the full formatted report, export in HTML format.")

    # Build PDF content stream with text positioning
    page_height = 792  # Letter height in points
    margin_top = 50
    line_height = 14
    font_size = 10
    title_font_size = 16

    stream_parts: list[str] = ["BT"]
    stream_parts.append(f"/F1 {title_font_size} Tf")
    y_pos = page_height - margin_top
    stream_parts.append(f"50 {y_pos} Td")

    for i, line in enumerate(lines):
        if i == 0:
            # Title line uses larger font
            escaped = _pdf_escape(line)
            stream_parts.append(f"({escaped}) Tj")
            stream_parts.append(f"/F1 {font_size} Tf")
            stream_parts.append(f"0 -{line_height + 4} Td")
        else:
            escaped = _pdf_escape(line)
            stream_parts.append(f"0 -{line_height} Td")
            stream_parts.append(f"({escaped}) Tj")

    stream_parts.append("ET")
    stream_content = "\n".join(stream_parts)
    stream_bytes = stream_content.encode("latin-1", errors="replace")
    stream_length = len(stream_bytes)

    # Assemble PDF objects
    objects: list[str] = []

    # Object 1: Catalog
    objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")

    # Object 2: Pages
    objects.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj")

    # Object 3: Page
    objects.append(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R "
        "/MediaBox [0 0 612 792] "
        "/Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>\nendobj"
    )

    # Object 4: Content stream
    objects.append(
        f"4 0 obj\n<< /Length {stream_length} >>\n"
        f"stream\n{stream_content}\nendstream\nendobj"
    )

    # Object 5: Font
    objects.append(
        "5 0 obj\n<< /Type /Font /Subtype /Type1 "
        "/BaseFont /Helvetica >>\nendobj"
    )

    # Build the full PDF file
    pdf_parts: list[str] = ["%PDF-1.4"]

    offsets: list[int] = []
    current_offset = len("%PDF-1.4\n")

    for obj in objects:
        offsets.append(current_offset)
        pdf_parts.append(obj)
        current_offset += len(obj) + 1  # +1 for newline

    # Cross-reference table
    xref_offset = current_offset
    xref_lines = [f"xref\n0 {len(objects) + 1}"]
    xref_lines.append("0000000000 65535 f ")
    for offset in offsets:
        xref_lines.append(f"{offset:010d} 00000 n ")

    pdf_parts.append("\n".join(xref_lines))
    pdf_parts.append(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF"
    )

    pdf_str = "\n".join(pdf_parts)
    return pdf_str.encode("latin-1", errors="replace")


def _pdf_escape(text: str) -> str:
    """Escape special characters for PDF text strings."""
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


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
