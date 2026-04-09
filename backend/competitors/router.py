"""Competitor analysis API endpoints."""

import logging
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from competitors.analyzer import CompetitorAnalyzer
from competitors.schemas import (
    CompetitorComparisonResponse,
    GapItem,
)
from db.models.competitor import Competitor, CompetitorSnapshot
from db.models.user import User
from db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/competitors", tags=["competitors"])

_your_latest_analysis: dict[str, Any] = {}


def set_your_latest_analysis(analysis: dict[str, Any]) -> None:
    """Store the user's latest analysis for comparison purposes."""
    _your_latest_analysis.update(analysis)


def _get_analyzer() -> CompetitorAnalyzer:
    return CompetitorAnalyzer()


# ---------------------------------------------------------------------------
# Schemas matching the frontend Competitor interface
# ---------------------------------------------------------------------------

class CompetitorOut(BaseModel):
    id: str
    domain: str
    last_score: int
    trend: list[int]
    tracked_since: str


class AddCompetitorBody(BaseModel):
    domain: str


def _build_out(competitor: Competitor, snapshots: list[CompetitorSnapshot]) -> CompetitorOut:
    sorted_snaps = sorted(snapshots, key=lambda s: s.analyzed_at)
    trend = [s.combined_score or 0 for s in sorted_snaps[-5:]]
    last_score = sorted_snaps[-1].combined_score or 0 if sorted_snaps else 0
    return CompetitorOut(
        id=str(competitor.id),
        domain=competitor.domain,
        last_score=last_score,
        trend=trend,
        tracked_since=competitor.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# CRUD routes (DB-backed)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CompetitorOut])
async def list_competitors(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CompetitorOut]:
    """List all tracked competitors for the authenticated user."""
    result = await db.execute(
        select(Competitor).where(Competitor.user_id == user.id)
    )
    competitors = result.scalars().all()

    out = []
    for comp in competitors:
        snaps_result = await db.execute(
            select(CompetitorSnapshot)
            .where(CompetitorSnapshot.competitor_id == comp.id)
            .order_by(CompetitorSnapshot.analyzed_at.asc())
        )
        snapshots = snaps_result.scalars().all()
        out.append(_build_out(comp, list(snapshots)))
    return out


@router.post("", response_model=CompetitorOut, status_code=status.HTTP_201_CREATED)
async def add_competitor(
    body: AddCompetitorBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorOut:
    """Add a new competitor to track."""
    domain_raw = body.domain.strip()
    url = domain_raw if domain_raw.startswith("http") else f"https://{domain_raw}"
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain",
        )

    existing = await db.execute(
        select(Competitor).where(
            Competitor.user_id == user.id,
            Competitor.domain == domain,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This competitor is already being tracked",
        )

    competitor = Competitor(
        user_id=user.id,
        url=url,
        domain=domain,
        name=domain,
    )
    db.add(competitor)
    await db.flush()
    await db.refresh(competitor)

    logger.info("Competitor added: %s for user %s", domain, user.id)
    return _build_out(competitor, [])


@router.delete("/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a competitor from tracking."""
    result = await db.execute(
        select(Competitor).where(
            Competitor.id == competitor_id,
            Competitor.user_id == user.id,
        )
    )
    competitor = result.scalar_one_or_none()
    if competitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found",
        )
    await db.delete(competitor)
    logger.info("Competitor %s removed", competitor_id)


# ---------------------------------------------------------------------------
# Analysis / comparison routes (unchanged logic, now load from DB)
# ---------------------------------------------------------------------------

@router.post("/{competitor_id}/analyze", response_model=CompetitorOut)
async def analyze_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> CompetitorOut:
    """Trigger an analysis of a tracked competitor."""
    result = await db.execute(
        select(Competitor).where(
            Competitor.id == competitor_id,
            Competitor.user_id == user.id,
        )
    )
    competitor = result.scalar_one_or_none()
    if competitor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found",
        )

    analysis = await analyzer.analyze_competitor(competitor.url)
    if analysis.get("error"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to analyse competitor: {analysis['error']}",
        )

    snapshot = CompetitorSnapshot(
        competitor_id=competitor.id,
        seo_score=analysis.get("seo_score"),
        geo_score=analysis.get("geo_score"),
        combined_score=analysis.get("combined_score") or analysis.get("seo_score"),
        categories=analysis.get("categories"),
        page_data=analysis.get("page_data"),
    )
    db.add(snapshot)
    await db.flush()

    snaps_result = await db.execute(
        select(CompetitorSnapshot)
        .where(CompetitorSnapshot.competitor_id == competitor.id)
        .order_by(CompetitorSnapshot.analyzed_at.asc())
    )
    snapshots = snaps_result.scalars().all()
    return _build_out(competitor, list(snapshots))


@router.get("/{competitor_id}/compare", response_model=CompetitorComparisonResponse)
async def compare_competitor(
    competitor_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> CompetitorComparisonResponse:
    """Compare your latest analysis with a competitor's analysis."""
    result = await db.execute(
        select(Competitor).where(
            Competitor.id == competitor_id,
            Competitor.user_id == user.id,
        )
    )
    competitor = result.scalar_one_or_none()
    if competitor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")

    snap_result = await db.execute(
        select(CompetitorSnapshot)
        .where(CompetitorSnapshot.competitor_id == competitor.id)
        .order_by(CompetitorSnapshot.analyzed_at.desc())
        .limit(1)
    )
    latest_snap = snap_result.scalar_one_or_none()
    if latest_snap is None or latest_snap.page_data is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Competitor has not been analysed yet. Trigger an analysis first.",
        )

    if not _your_latest_analysis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No analysis data available for your site. Run an analysis first.",
        )

    comp_analysis = {
        "seo_score": latest_snap.seo_score,
        "geo_score": latest_snap.geo_score,
        **(latest_snap.page_data or {}),
    }
    result_data = analyzer.compare(_your_latest_analysis, comp_analysis)

    gaps = [
        GapItem(
            category=g["category"],
            your_score=g["your_score"],
            competitor_score=g["competitor_score"],
            difference=g["difference"],
            recommendation=g["recommendation"],
        )
        for g in result_data["gaps"]
    ]

    return CompetitorComparisonResponse(
        your_scores=result_data["your_scores"],
        competitor_scores=result_data["competitor_scores"],
        gaps=gaps,
    )


@router.get("/gaps", response_model=list[GapItem])
async def aggregated_gaps(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    analyzer: CompetitorAnalyzer = Depends(_get_analyzer),
) -> list[GapItem]:
    """Aggregated gap analysis across all analysed competitors."""
    if not _your_latest_analysis:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No analysis data available for your site. Run an analysis first.",
        )

    comps_result = await db.execute(
        select(Competitor).where(Competitor.user_id == user.id)
    )
    competitors = comps_result.scalars().all()

    worst_gaps: dict[str, dict[str, Any]] = {}
    for competitor in competitors:
        snap_result = await db.execute(
            select(CompetitorSnapshot)
            .where(CompetitorSnapshot.competitor_id == competitor.id)
            .order_by(CompetitorSnapshot.analyzed_at.desc())
            .limit(1)
        )
        snap = snap_result.scalar_one_or_none()
        if snap is None or snap.page_data is None:
            continue

        comp_analysis = {"seo_score": snap.seo_score, "geo_score": snap.geo_score, **(snap.page_data or {})}
        result_data = analyzer.compare(_your_latest_analysis, comp_analysis)
        for gap in result_data["gaps"]:
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
