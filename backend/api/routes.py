import time
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import AnalyzeRequest, AnalyzeResponse
from auth.dependencies import get_optional_user
from db.models.user import User
from db.session import get_db
from middleware.usage_gate import UsageGate
from scoring.geo_scorer import GEOScorer
from analysis.intent_classifier import IntentClassifier
from analysis.keyword_extractor import KeywordExtractor
from rewriting.rewrite_engine import RewriteEngine
from services.llm_service import LLMService
from config import Settings

router = APIRouter()


def get_settings():
    return Settings()


def get_llm_service(settings: Settings = Depends(get_settings)):
    return LLMService(settings)


def _get_client_ip(request: Request) -> str:
    """Extract client IP from the request, respecting X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


async def _enforce_usage_gate(
    user: Optional[User],
    ip_address: str,
    db: AsyncSession,
) -> None:
    """Check usage limits and raise HTTP 429 if exceeded."""
    gate = UsageGate()
    result = await gate.check(user, ip_address, db)
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Daily scan limit reached",
                "limit": result.limit,
                "remaining": result.remaining,
            },
        )


async def _record_usage(
    user: Optional[User],
    ip_address: str,
    db: AsyncSession,
) -> None:
    """Increment the daily usage counter after a successful scan."""
    gate = UsageGate()
    await gate.record_usage(user, ip_address, db)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_page(
    request: AnalyzeRequest,
    http_request: Request,
    llm: LLMService = Depends(get_llm_service),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce usage limits
    ip_address = _get_client_ip(http_request)
    await _enforce_usage_gate(user, ip_address, db)

    start_time = time.time()

    # Run intent classification and keyword extraction in parallel
    intent_classifier = IntentClassifier(llm)
    keyword_extractor = KeywordExtractor(llm)
    intent, keywords = await asyncio.gather(
        intent_classifier.classify(request),
        keyword_extractor.extract(request),
    )

    # GEO scoring
    geo_scorer = GEOScorer(llm)
    geo_result = await geo_scorer.score(request, intent, keywords)

    # Generate rewrite suggestions
    rewrite_engine = RewriteEngine(llm)
    suggestions = await rewrite_engine.generate(
        request, intent, keywords, geo_result, max_suggestions=5
    )

    # Record usage after successful analysis
    await _record_usage(user, ip_address, db)

    processing_time = int((time.time() - start_time) * 1000)

    return AnalyzeResponse(
        geo_score=geo_result["score"],
        geo_categories=geo_result["categories"],
        geo_issues=geo_result["issues"],
        suggestions=suggestions,
        intent=intent,
        primary_keyword=keywords.get("primary"),
        processing_time_ms=processing_time,
    )


@router.post("/score")
async def quick_score(
    request: AnalyzeRequest,
    http_request: Request,
    llm: LLMService = Depends(get_llm_service),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce usage limits
    ip_address = _get_client_ip(http_request)
    await _enforce_usage_gate(user, ip_address, db)

    geo_scorer = GEOScorer(llm)
    geo_result = await geo_scorer.score(request, "informational", {})

    # Record usage after successful scoring
    await _record_usage(user, ip_address, db)

    return {
        "geo_score": geo_result["score"],
        "geo_categories": geo_result["categories"],
    }
