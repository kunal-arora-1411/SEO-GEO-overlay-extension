"""Export API endpoints for downloading analysis reports."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from auth.dependencies import get_current_user
from db.models.user import User
from export.generators.csv_export import generate_csv_report
from export.generators.html_diff import generate_html_report
from export.generators.json_export import generate_json_report
from export.generators.pdf_report import generate_pdf_report
from export.generators.wordpress_xml import generate_wordpress_xml

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])

# Format registry mapping format names to generator functions and MIME types
_FORMATS: dict[str, dict[str, Any]] = {
    "html": {
        "generator": generate_html_report,
        "media_type": "text/html",
        "extension": "html",
        "is_binary": False,
    },
    "csv": {
        "generator": generate_csv_report,
        "media_type": "text/csv",
        "extension": "csv",
        "is_binary": False,
    },
    "json": {
        "generator": generate_json_report,
        "media_type": "application/json",
        "extension": "json",
        "is_binary": False,
    },
    "wordpress_xml": {
        "generator": generate_wordpress_xml,
        "media_type": "application/xml",
        "extension": "xml",
        "is_binary": False,
    },
    "pdf": {
        "generator": generate_pdf_report,
        "media_type": "application/pdf",
        "extension": "pdf",
        "is_binary": True,
    },
}


def _get_analysis(analysis_id: str) -> dict[str, Any]:
    """Look up an analysis by ID from the history store.

    Falls back to returning a minimal placeholder if the history module
    has no matching record (allows the export router to work independently
    during development).
    """
    try:
        from history.router import _find_analysis_by_id
        analysis = _find_analysis_by_id(analysis_id)
        if analysis is not None:
            return analysis
    except ImportError:
        logger.debug("History module not available for analysis lookup")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Analysis not found",
    )


@router.post("/{analysis_id}")
async def export_analysis(
    analysis_id: str,
    format: str = Query(
        default="html",
        description="Export format",
        pattern="^(html|csv|json|wordpress_xml|pdf)$",
    ),
    user: User = Depends(get_current_user),
) -> Response:
    """Export an analysis in the specified format.

    Supported formats: html, csv, json, wordpress_xml, pdf.
    Returns the file as a downloadable response with appropriate headers.
    """
    format_config = _FORMATS.get(format)
    if format_config is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format: {format}. Supported: {', '.join(_FORMATS.keys())}",
        )

    analysis_data = _get_analysis(analysis_id)

    generator = format_config["generator"]
    content = generator(analysis_data)

    media_type = format_config["media_type"]
    extension = format_config["extension"]
    filename = f"seo-geo-report-{analysis_id[:8]}.{extension}"

    if format_config["is_binary"]:
        # Binary content (e.g. PDF)
        if isinstance(content, str):
            content = content.encode("utf-8")
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    # Text content
    if isinstance(content, bytes):
        content = content.decode("utf-8")

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
