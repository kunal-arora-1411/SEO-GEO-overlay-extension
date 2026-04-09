"""CRUD endpoints for the analyses resource.

Provides GET /analyses (paginated), GET /analyses/:id, POST /analyses.
These are the endpoints consumed by the web dashboard.
"""

import asyncio
import math
import time
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from auth.dependencies import get_current_user
from db.models.analysis import Analysis
from db.models.user import User
from db.session import get_db, _session_factory

router = APIRouter(prefix="/analyses", tags=["analyses"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AnalysisCreate(BaseModel):
    url: str
    keyword: str


class AnalysisResponse(BaseModel):
    id: str
    url: str
    keyword: str
    seo_score: int
    geo_score: int
    overall_score: int
    status: str
    created_at: str
    recommendations_count: int

    model_config = {"from_attributes": True}


class PaginatedAnalyses(BaseModel):
    items: list[AnalysisResponse]
    total: int
    page: int
    pages: int


def _to_response(analysis: Analysis) -> AnalysisResponse:
    return AnalysisResponse(
        id=str(analysis.id),
        url=analysis.url,
        keyword=analysis.primary_keyword or "",
        seo_score=analysis.seo_score or 0,
        geo_score=analysis.geo_score or 0,
        overall_score=analysis.combined_score or 0,
        status=analysis.status,
        created_at=analysis.created_at.isoformat(),
        recommendations_count=len(analysis.suggestions or []),
    )


# ---------------------------------------------------------------------------
# Background enrichment task
# ---------------------------------------------------------------------------


async def _run_enrichment(analysis_id: str) -> None:
    """Run intent + keyword extraction and update the Analysis record."""
    if _session_factory is None:
        return

    try:
        from analysis.intent_classifier import IntentClassifier
        from analysis.keyword_extractor import KeywordExtractor
        from api.schemas import AnalyzeRequest, MetaData, HeadingsData, ContentData
        from config import Settings
        from services.llm_service import LLMService

        settings = Settings()
        llm = LLMService(settings)
        classifier = IntentClassifier(llm)
        extractor = KeywordExtractor(llm)

        async with _session_factory() as db:
            result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
            analysis = result.scalar_one_or_none()
            if analysis is None:
                return

            analysis.status = "processing"
            await db.commit()

            # Build a minimal request for the classifiers
            req = AnalyzeRequest(
                url=analysis.url,
                meta=MetaData(title=""),
                headings=HeadingsData(h1=[], h2=[]),
                content=ContentData(full_text="", word_count=0),
            )

            start = time.time()
            intent, keywords = await asyncio.gather(
                classifier.classify(req),
                extractor.extract(req),
            )
            elapsed = int((time.time() - start) * 1000)

            analysis.intent = intent
            analysis.primary_keyword = keywords.get("primary") or analysis.primary_keyword
            analysis.status = "completed"
            analysis.processing_time_ms = elapsed
            await db.commit()
    except Exception:
        # On any error, mark the analysis as failed
        try:
            async with _session_factory() as db:
                result = await db.execute(
                    select(Analysis).where(Analysis.id == analysis_id)
                )
                analysis = result.scalar_one_or_none()
                if analysis is not None:
                    analysis.status = "failed"
                    await db.commit()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    body: AnalysisCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """Create a new analysis and kick off background enrichment."""
    url = body.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"

    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path

    analysis = Analysis(
        user_id=user.id,
        url=url,
        domain=domain,
        primary_keyword=body.keyword,
        status="pending",
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)

    background_tasks.add_task(_run_enrichment, str(analysis.id))

    return _to_response(analysis)


@router.get("", response_model=PaginatedAnalyses)
async def list_analyses(
    page: int = 1,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAnalyses:
    """List analyses for the authenticated user, newest first."""
    page = max(1, page)
    limit = max(1, min(limit, 100))
    offset = (page - 1) * limit

    total_result = await db.execute(
        select(func.count()).select_from(Analysis).where(Analysis.user_id == user.id)
    )
    total = total_result.scalar_one()

    rows = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    analyses = rows.scalars().all()

    pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedAnalyses(
        items=[_to_response(a) for a in analyses],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """Fetch a single analysis by ID."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return _to_response(analysis)
