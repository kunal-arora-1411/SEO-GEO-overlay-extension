"""Analysis history and trend API endpoints."""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth.dependencies import get_current_user
from db.models.user import User
from history.schemas import (
    AnalysisDetailResponse,
    AnalysisHistoryItem,
    DomainSummary,
    PaginatedResponse,
    TrendPoint,
    TrendResponse,
)
from history.trend_calculator import TrendCalculator

logger = logging.getLogger(__name__)

router = APIRouter(tags=["history"])

# In-memory analysis storage (replaced by DB in a later migration)
_analyses: list[dict[str, Any]] = []
_MAX_STORED = 10000


def store_analysis(analysis: dict[str, Any]) -> str:
    """Store an analysis record and return its ID.

    Called externally (e.g. from the analyze endpoint) to persist results.
    """
    analysis_id = str(uuid.uuid4())
    record = {**analysis, "id": analysis_id}

    if "created_at" not in record:
        record["created_at"] = datetime.now(timezone.utc)

    if "domain" not in record and "url" in record:
        parsed = urlparse(record["url"])
        record["domain"] = parsed.netloc

    if "combined_score" not in record:
        seo = float(record.get("seo_score", 0))
        geo = float(record.get("geo_score", 0))
        record["combined_score"] = round((seo + geo) / 2, 1)

    _analyses.append(record)

    # Prevent unbounded growth
    if len(_analyses) > _MAX_STORED:
        del _analyses[: len(_analyses) - _MAX_STORED]

    return analysis_id


def _find_analysis_by_id(analysis_id: str) -> Optional[dict[str, Any]]:
    """Look up a single analysis by its ID."""
    for analysis in _analyses:
        if analysis.get("id") == analysis_id:
            return analysis
    return None


@router.get("/analyses", response_model=PaginatedResponse)
async def list_analyses(
    cursor: Optional[str] = Query(default=None, description="Cursor for pagination"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    domain: Optional[str] = Query(default=None, description="Filter by domain"),
    user: User = Depends(get_current_user),
) -> PaginatedResponse:
    """Return paginated analysis history with optional domain filter.

    Uses cursor-based pagination where the cursor is the ID of the last
    item on the previous page.
    """
    # Filter by domain if requested
    filtered = _analyses
    if domain:
        filtered = [a for a in filtered if a.get("domain") == domain]

    # Sort by created_at descending (newest first)
    filtered = sorted(filtered, key=lambda a: a.get("created_at", ""), reverse=True)

    # Apply cursor: find the position after the cursor ID
    start_index = 0
    if cursor:
        for idx, analysis in enumerate(filtered):
            if analysis.get("id") == cursor:
                start_index = idx + 1
                break

    page = filtered[start_index: start_index + limit]
    has_more = (start_index + limit) < len(filtered)
    next_cursor = page[-1]["id"] if page and has_more else None

    items = [
        AnalysisHistoryItem(
            id=a["id"],
            url=a.get("url", ""),
            domain=a.get("domain", ""),
            seo_score=float(a.get("seo_score", 0)),
            geo_score=float(a.get("geo_score", 0)),
            combined_score=float(a.get("combined_score", 0)),
            intent=a.get("intent", "unknown"),
            created_at=a.get("created_at", datetime.now(timezone.utc)),
        )
        for a in page
    ]

    return PaginatedResponse(items=items, cursor=next_cursor, has_more=has_more)


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: str,
    user: User = Depends(get_current_user),
) -> AnalysisDetailResponse:
    """Return full details for a single analysis."""
    analysis = _find_analysis_by_id(analysis_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    return AnalysisDetailResponse(
        id=analysis["id"],
        url=analysis.get("url", ""),
        domain=analysis.get("domain", ""),
        seo_score=float(analysis.get("seo_score", 0)),
        geo_score=float(analysis.get("geo_score", 0)),
        combined_score=float(analysis.get("combined_score", 0)),
        intent=analysis.get("intent", "unknown"),
        primary_keyword=analysis.get("primary_keyword"),
        geo_categories=analysis.get("geo_categories", {}),
        geo_issues=analysis.get("geo_issues", []),
        suggestions=analysis.get("suggestions", []),
        page_data=analysis.get("page_data", {}),
        created_at=analysis.get("created_at", datetime.now(timezone.utc)),
    )


@router.get("/trends/{domain}", response_model=TrendResponse)
async def get_trends(
    domain: str,
    period: int = Query(default=30, ge=7, le=90, description="Days to look back"),
    user: User = Depends(get_current_user),
) -> TrendResponse:
    """Return trend data for a domain over the given period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=period)

    domain_analyses = [
        a for a in _analyses
        if a.get("domain") == domain and a.get("created_at", datetime.min) >= cutoff
    ]

    calculator = TrendCalculator()
    daily_points = calculator.aggregate_daily(domain_analyses)
    trend = calculator.calculate_trend(daily_points)

    data_points = [
        TrendPoint(
            date=dp["date"],
            seo_score=dp["seo_score"],
            geo_score=dp["geo_score"],
            combined_score=dp["combined_score"],
            scan_count=dp["scan_count"],
        )
        for dp in daily_points
    ]

    return TrendResponse(
        domain=domain,
        period=period,
        data_points=data_points,
        trend_direction=trend["direction"],
        slope=trend["slope"],
    )


@router.get("/domains", response_model=list[DomainSummary])
async def list_domains(
    user: User = Depends(get_current_user),
) -> list[DomainSummary]:
    """List all analysed domains with summary statistics."""
    domain_data: dict[str, dict[str, Any]] = {}

    for analysis in _analyses:
        domain = analysis.get("domain", "")
        if not domain:
            continue

        if domain not in domain_data:
            domain_data[domain] = {
                "seo_total": 0.0,
                "geo_total": 0.0,
                "combined_total": 0.0,
                "count": 0,
                "last_scan": analysis.get("created_at", datetime.min),
            }

        entry = domain_data[domain]
        entry["seo_total"] += float(analysis.get("seo_score", 0))
        entry["geo_total"] += float(analysis.get("geo_score", 0))
        entry["combined_total"] += float(analysis.get("combined_score", 0))
        entry["count"] += 1

        scan_time = analysis.get("created_at", datetime.min)
        if scan_time > entry["last_scan"]:
            entry["last_scan"] = scan_time

    summaries = []
    for domain, data in sorted(domain_data.items()):
        count = data["count"]
        summaries.append(
            DomainSummary(
                domain=domain,
                total_scans=count,
                avg_seo=round(data["seo_total"] / count, 1),
                avg_geo=round(data["geo_total"] / count, 1),
                avg_combined=round(data["combined_total"] / count, 1),
                last_scan=data["last_scan"],
            )
        )

    return summaries
