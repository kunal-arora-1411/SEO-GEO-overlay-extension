import logging
import time
import asyncio
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import AnalyzeRequest, AnalyzeResponse, EnrichRequest, EnrichResponse
from auth.dependencies import get_optional_user
from db.models.user import User
from db.models.analysis import Analysis
from db.session import get_db
from middleware.usage_gate import UsageGate
from analysis.intent_classifier import IntentClassifier
from analysis.keyword_extractor import KeywordExtractor
from analysis.faq_generator import FAQGenerator
from analysis.meta_description_generator import MetaDescriptionGenerator
from analysis.answerability_scorer import AnswerabilityScorer
from analysis.summary_generator import SummaryGenerator
from analysis.heading_optimizer import HeadingOptimizer
from services.llm_service import LLMService
from config import Settings

logger = logging.getLogger(__name__)

# GEOScorer and RewriteEngine are no longer imported — scoring is client-side,
# suggestions are deterministic. Files kept for reference but not called.

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


@router.post("/enrich", response_model=EnrichResponse)
async def enrich_page(
    request: EnrichRequest,
    http_request: Request,
    llm: LLMService = Depends(get_llm_service),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight enrichment: intent + keyword extraction only.
    GEO scoring is now fully client-side; this endpoint exists only to
    provide keyword-aware SEO context (density, LSI) when online.
    """
    ip_address = _get_client_ip(http_request)
    await _enforce_usage_gate(user, ip_address, db)

    start_time = time.time()

    # Build a minimal AnalyzeRequest-compatible object for the classifiers
    from api.schemas import AnalyzeRequest as _AR, MetaData, HeadingsData, HeadingItem, ContentData

    _meta = MetaData(title=request.title or "")
    _h1 = [HeadingItem(index=0, text=request.h1)] if request.h1 else []
    _h2 = [HeadingItem(index=i, text=t) for i, t in enumerate(request.h2s)]
    _headings = HeadingsData(h1=_h1, h2=_h2)
    _content = ContentData(
        full_text=request.content_excerpt,
        word_count=request.word_count,
    )
    _req = _AR(url=request.url, meta=_meta, headings=_headings, content=_content)

    intent_classifier = IntentClassifier(llm)
    keyword_extractor = KeywordExtractor(llm)

    # Base tasks always run
    tasks: list = [
        intent_classifier.classify(_req),
        keyword_extractor.extract(_req),
    ]

    # Optional LLM tasks — only launched when the client requests them
    optional_keys: list[str] = []
    if request.include_faq:
        optional_keys.append("faq")
        tasks.append(FAQGenerator(llm).generate(request))
    if request.include_meta_suggestion:
        optional_keys.append("meta")
        tasks.append(MetaDescriptionGenerator(llm).generate(request))
    if request.include_answerability:
        optional_keys.append("answerability")
        tasks.append(AnswerabilityScorer(llm).score(request))
    if request.include_summary:
        optional_keys.append("summary")
        tasks.append(SummaryGenerator(llm).generate(request))
    if request.include_heading_optimization:
        optional_keys.append("headings")
        tasks.append(HeadingOptimizer(llm).optimize(request))

    results = await asyncio.gather(*tasks)
    intent: str = results[0]
    keywords: dict = results[1]

    # Map optional results by key
    optional_results: dict = {}
    for idx, key in enumerate(optional_keys):
        optional_results[key] = results[2 + idx]

    primary_keyword = keywords.get("primary")

    await _record_usage(user, ip_address, db)
    processing_time = int((time.time() - start_time) * 1000)

    # --- Persist to analyses table (non-fatal) ---
    try:
        domain = urlparse(request.url).netloc or request.url
        new_analysis = Analysis(
            user_id=user.id if user else None,
            url=request.url,
            domain=domain,
            intent=intent,
            primary_keyword=primary_keyword,
            status="completed",
            processing_time_ms=processing_time,
        )
        db.add(new_analysis)
        await db.commit()
    except Exception:
        logger.warning("Failed to save analysis to DB — non-fatal", exc_info=True)
        await db.rollback()

    # --- Build response ---
    answerability = optional_results.get("answerability") or {}
    return EnrichResponse(
        intent=intent,
        primary_keyword=primary_keyword,
        lsi_keywords=keywords.get("lsi", []),
        keyword_density=keywords.get("density", 0.0),
        processing_time_ms=processing_time,
        faq_suggestions=optional_results.get("faq") or None,
        meta_description_suggestion=optional_results.get("meta") or None,
        answerability_score=answerability.get("score") if answerability else None,
        answerability_gaps=answerability.get("top_gaps") if answerability else None,
        summary_points=optional_results.get("summary") or None,
        heading_suggestions=optional_results.get("headings") or None,
    )


@router.post("/analyze", response_model=AnalyzeResponse, deprecated=True)
async def analyze_page(
    request: AnalyzeRequest,
    http_request: Request,
    llm: LLMService = Depends(get_llm_service),
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Deprecated: GEO scoring is now client-side. Use /enrich instead.
    Kept for backward compatibility — returns intent + keywords with empty GEO data.
    """
    ip_address = _get_client_ip(http_request)
    await _enforce_usage_gate(user, ip_address, db)

    start_time = time.time()

    intent_classifier = IntentClassifier(llm)
    keyword_extractor = KeywordExtractor(llm)
    intent, keywords = await asyncio.gather(
        intent_classifier.classify(request),
        keyword_extractor.extract(request),
    )

    await _record_usage(user, ip_address, db)
    processing_time = int((time.time() - start_time) * 1000)

    return AnalyzeResponse(
        geo_score=0,
        geo_categories={},
        geo_issues=[],
        suggestions=[],
        intent=intent,
        primary_keyword=keywords.get("primary"),
        processing_time_ms=processing_time,
    )
