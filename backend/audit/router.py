"""Multi-page audit API endpoints."""

import asyncio
import uuid
import logging
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException

from audit.schemas import (
    StartAuditRequest,
    AuditStatusResponse,
    AuditResultsResponse,
    AuditPageResult,
)
from audit.crawler import SiteCrawler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])

# In-memory audit storage (replaced by DB in Phase 3)
_audits: dict[str, dict[str, Any]] = {}


@router.post("/start", response_model=AuditStatusResponse)
async def start_audit(request: StartAuditRequest):
    """Start a new multi-page site audit."""
    audit_id = str(uuid.uuid4())
    parsed = urlparse(request.url)
    domain = parsed.netloc

    if not domain:
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Enforce free tier max
    max_pages = min(request.max_pages, 50)

    _audits[audit_id] = {
        "status": "running",
        "domain": domain,
        "start_url": request.url,
        "pages_crawled": 0,
        "total_pages": max_pages,
        "pages": [],
        "error": None,
    }

    # Run crawl as background task
    asyncio.create_task(_run_audit(audit_id, request.url, max_pages))

    return AuditStatusResponse(
        audit_id=audit_id,
        status="running",
        pages_crawled=0,
        total_pages=max_pages,
        progress_pct=0,
    )


@router.get("/status/{audit_id}", response_model=AuditStatusResponse)
async def get_audit_status(audit_id: str):
    """Get the current status of an audit."""
    audit = _audits.get(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    pages_crawled = audit["pages_crawled"]
    total = audit["total_pages"]
    progress = int((pages_crawled / total) * 100) if total > 0 else 0

    return AuditStatusResponse(
        audit_id=audit_id,
        status=audit["status"],
        pages_crawled=pages_crawled,
        total_pages=total,
        progress_pct=min(progress, 100),
    )


@router.get("/results/{audit_id}", response_model=AuditResultsResponse)
async def get_audit_results(audit_id: str):
    """Get the results of a completed audit."""
    audit = _audits.get(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    pages = [AuditPageResult(**p) for p in audit["pages"]]

    # Calculate averages
    seo_scores = [p.seo_score for p in pages if p.seo_score is not None]
    avg_seo = round(sum(seo_scores) / len(seo_scores), 1) if seo_scores else None

    # Find common issues
    common_issues = _find_common_issues(pages)

    return AuditResultsResponse(
        audit_id=audit_id,
        status=audit["status"],
        domain=audit["domain"],
        start_url=audit["start_url"],
        pages_crawled=audit["pages_crawled"],
        pages=pages,
        avg_seo_score=avg_seo,
        common_issues=common_issues,
    )


async def _run_audit(audit_id: str, start_url: str, max_pages: int) -> None:
    """Background task that runs the site crawl and basic scoring."""
    audit = _audits.get(audit_id)
    if not audit:
        return

    try:
        crawler = SiteCrawler(start_url, max_pages=max_pages)

        async def on_progress(crawled: int, total: int) -> None:
            if audit_id in _audits:
                _audits[audit_id]["pages_crawled"] = crawled

        results = await crawler.crawl(progress_callback=on_progress)

        # Basic SEO scoring for each page
        scored_pages = []
        for page in results:
            score = _basic_seo_score(page)
            page["seo_score"] = score
            scored_pages.append(page)

        audit["pages"] = scored_pages
        audit["pages_crawled"] = len(scored_pages)
        audit["status"] = "completed"

    except Exception as e:
        logger.exception("Audit %s failed", audit_id)
        audit["status"] = "failed"
        audit["error"] = str(e)


def _basic_seo_score(page: dict[str, Any]) -> int:
    """Calculate a basic SEO score from crawled page data."""
    if page.get("error"):
        return 0

    score = 0

    # Title (20 pts)
    title = page.get("title") or ""
    if title:
        title_len = len(title)
        if 30 <= title_len <= 60:
            score += 20
        elif title:
            score += 10

    # Meta description (15 pts)
    desc = page.get("meta_description") or ""
    if desc:
        desc_len = len(desc)
        if 120 <= desc_len <= 160:
            score += 15
        elif desc:
            score += 7

    # H1 (15 pts)
    h1s = page.get("headings", {}).get("h1", [])
    if len(h1s) == 1:
        score += 15
    elif h1s:
        score += 8

    # H2s (10 pts)
    h2s = page.get("headings", {}).get("h2", [])
    if 2 <= len(h2s) <= 8:
        score += 10
    elif h2s:
        score += 5

    # Content length (15 pts)
    wc = page.get("word_count", 0)
    if wc >= 1000:
        score += 15
    elif wc >= 300:
        score += 8

    # Schema (10 pts)
    if page.get("has_schema"):
        score += 10

    # Canonical (5 pts)
    if page.get("canonical_url"):
        score += 5

    # Status code (10 pts)
    status = page.get("status_code", 0)
    if status == 200:
        score += 10
    elif 300 <= status < 400:
        score += 5

    return min(score, 100)


def _find_common_issues(pages: list[AuditPageResult]) -> list[str]:
    """Identify common issues across all crawled pages."""
    issues = []
    total = len(pages)
    if total == 0:
        return issues

    no_title = sum(1 for p in pages if not p.title)
    no_desc = sum(1 for p in pages if not p.meta_description)
    no_h1 = sum(1 for p in pages if not p.headings.get("h1"))
    no_schema = sum(1 for p in pages if not p.has_schema)
    thin = sum(1 for p in pages if p.word_count < 300)
    errors = sum(1 for p in pages if p.error)

    if no_title > 0:
        issues.append(f"{no_title}/{total} pages missing title tags")
    if no_desc > 0:
        issues.append(f"{no_desc}/{total} pages missing meta descriptions")
    if no_h1 > 0:
        issues.append(f"{no_h1}/{total} pages missing H1 headings")
    if no_schema > 0:
        issues.append(f"{no_schema}/{total} pages missing structured data")
    if thin > 0:
        issues.append(f"{thin}/{total} pages have thin content (<300 words)")
    if errors > 0:
        issues.append(f"{errors}/{total} pages had crawl errors")

    return issues
