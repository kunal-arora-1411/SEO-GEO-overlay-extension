"""Competitor analysis API endpoints."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user
from competitors.analyzer import CompetitorAnalyzer
from competitors.schemas import (
    AddCompetitorRequest,
    CompetitorComparisonResponse,
    CompetitorListResponse,
    CompetitorResponse,
    GapItem,
)
from db.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/competitors", tags=["competitors"])

# In-memory storage (replaced by DB in a later migration)
_competitors: dict[str, dict[str, Any]] = {}
_your_latest_analysis: dict[str, Any] = {}


def set_your_latest_analysis(analysis: dict[str, Any]) -> None:
    """Store the user's latest analysis for comparison purposes.

    Called externally after a successful analysis completes.
    """
    _your_latest_analysis.update(analysis)


def _get_analyzer() -> CompetitorAnalyzer:
    return CompetitorAnalyzer()


@router.get("", response_model=CompetitorListResponse)
async def list_competitors(
    user: User = Depends(get_current_user),
) -> CompetitorListResponse:
    """List all tracked competitors."""
    competitors = [
        CompetitorResponse(
            id=c["id"],
            url=c["url"],
            domain=c["domain"],
            name=c.get("name"),
            last_analyzed=c.get("last_analyzed"),
            seo_score=c.get("seo_score"),
            geo_score=c.get("geo_score"),
        )
        for c in _competitors.values()
    ]
    return CompetitorListResponse(competitors=competitors)


@router.post("", response_model=CompetitorResponse, status_code=status.HTTP_201_CREATED)
async def add_competitor(
    request: AddCompetitorRequest,
    user: User = Depends(get_current_user),
) -> CompetitorResponse:
    """Add a new competitor to track."""
    parsed = urlparse(request.url)
    domain = parsed.netloc

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL: could not extract domain",
        )

    # Check for duplicate URL
    for comp in _competitors.values():
        if comp["url"] == request.url:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This competitor URL is already being tracked",
            )

    competitor_id = str(uuid.uuid4())
    name = request.name or domain

    competitor = {
        "id": competitor_id,
        "url": request.url,
        "domain": domain,
        "name": name,
        "added_at": datetime.now(timezone.utc),
        "last_analyzed": None,
        "seo_score": None,
        "geo_score": None,
        "analysis_data": None,
    }
    _competitors[competitor_id] = competitor

    logger.info("Competitor added: %s (%s)", name, request.url)

    return CompetitorResponse(
        id=competitor_id,
        url=request.url,
        domain=domain,
        name=name,
        last_analyzed=None,
        seo_score=None,
        geo_score=None,
    )


@router.delete("/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
) -> None:
    """Remove a competitor from tracking."""
    if competitor_id not in _competitors:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found",
        )
    del _competitors[competitor_id]
    logger.info("Competitor %s removed", competitor_id)


@router.post("/{competitor_id}/analyze", response_model=CompetitorResponse)
async def analyze_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> CompetitorResponse:
    """Trigger an analysis of a tracked competitor."""
    competitor = _competitors.get(competitor_id)
    if competitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found",
        )

    analysis = await analyzer.analyze_competitor(competitor["url"])

    if analysis.get("error"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to analyse competitor: {analysis['error']}",
        )

    # Update stored competitor with analysis results
    now = datetime.now(timezone.utc)
    competitor["last_analyzed"] = now
    competitor["seo_score"] = analysis.get("seo_score")
    competitor["geo_score"] = analysis.get("geo_score")
    competitor["analysis_data"] = analysis

    return CompetitorResponse(
        id=competitor["id"],
        url=competitor["url"],
        domain=competitor["domain"],
        name=competitor.get("name"),
        last_analyzed=now,
        seo_score=analysis.get("seo_score"),
        geo_score=analysis.get("geo_score"),
    )


@router.get("/{competitor_id}/compare", response_model=CompetitorComparisonResponse)
async def compare_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> CompetitorComparisonResponse:
    """Compare your latest analysis with a competitor's analysis."""
    competitor = _competitors.get(competitor_id)
    if competitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found",
        )

    comp_analysis = competitor.get("analysis_data")
    if comp_analysis is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Competitor has not been analysed yet. Trigger an analysis first.",
        )

    if not _your_latest_analysis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No analysis data available for your site. Run an analysis first.",
        )

    result = analyzer.compare(_your_latest_analysis, comp_analysis)

    gaps = [
        GapItem(
            category=g["category"],
            your_score=g["your_score"],
            competitor_score=g["competitor_score"],
            difference=g["difference"],
            recommendation=g["recommendation"],
        )
        for g in result["gaps"]
    ]

    return CompetitorComparisonResponse(
        your_scores=result["your_scores"],
        competitor_scores=result["competitor_scores"],
        gaps=gaps,
    )


@router.get("/gaps", response_model=list[GapItem])
async def aggregated_gaps(
    user: User = Depends(get_current_user),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> list[GapItem]:
    """Aggregated gap analysis across all analysed competitors.

    Returns a deduplicated list of categories where any competitor leads
    by more than 10 points, sorted by the largest gap.
    """
    if not _your_latest_analysis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No analysis data available for your site. Run an analysis first.",
        )

    # Collect worst gaps across all competitors
    worst_gaps: dict[str, dict[str, Any]] = {}

    for competitor in _competitors.values():
        comp_analysis = competitor.get("analysis_data")
        if comp_analysis is None:
            continue

        result = analyzer.compare(_your_latest_analysis, comp_analysis)

        for gap in result["gaps"]:
            category = gap["category"]
            if category not in worst_gaps or gap["difference"] > worst_gaps[category]["difference"]:
                worst_gaps[category] = gap

    sorted_gaps = sorted(worst_gaps.values(), key=lambda g: g["difference"], reverse=True)

    return [
        GapItem(
            category=g["category"],
            your_score=g["your_score"],
            competitor_score=g["competitor_score"],
            difference=g["difference"],
            recommendation=g["recommendation"],
        )
        for g in sorted_gaps
    ]
