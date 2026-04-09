"""DB-backed /audits REST API for the web dashboard.

Distinct from the legacy /audit/* endpoints (audit/router.py) which use
in-memory storage. This router persists to SiteAudit + AuditPage tables.
"""

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from audit.crawler import SiteCrawler
from db.models.site_audit import AuditPage, SiteAudit
from db.models.user import User
from db.session import get_db, _session_factory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audits", tags=["audits"])


# ---------------------------------------------------------------------------
# Schemas (matching the frontend Audit interface)
# ---------------------------------------------------------------------------

class AuditCreate(BaseModel):
    domain: str


class AuditResponse(BaseModel):
    id: str
    domain: str
    status: str
    pages_crawled: int
    issues_found: int
    score: int
    created_at: str


class PaginatedAudits(BaseModel):
    items: list[AuditResponse]
    total: int
    page: int
    pages: int


def _to_response(audit: SiteAudit, issues_found: int = 0) -> AuditResponse:
    return AuditResponse(
        id=str(audit.id),
        domain=audit.domain,
        status=audit.status,
        pages_crawled=audit.pages_crawled,
        issues_found=issues_found,
        score=audit.avg_seo_score or 0,
        created_at=audit.started_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Basic SEO scoring (copied from audit/router.py)
# ---------------------------------------------------------------------------

def _basic_seo_score(page: dict) -> int:
    if page.get("error"):
        return 0
    score = 0
    title = page.get("title") or ""
    if title:
        tl = len(title)
        score += 20 if 30 <= tl <= 60 else 10
    desc = page.get("meta_description") or ""
    if desc:
        dl = len(desc)
        score += 15 if 120 <= dl <= 160 else 7
    h1s = (page.get("headings") or {}).get("h1", [])
    if len(h1s) == 1:
        score += 15
    elif h1s:
        score += 8
    h2s = (page.get("headings") or {}).get("h2", [])
    if 2 <= len(h2s) <= 8:
        score += 10
    elif h2s:
        score += 5
    wc = page.get("word_count", 0)
    if wc >= 1000:
        score += 15
    elif wc >= 300:
        score += 8
    if page.get("has_schema"):
        score += 10
    if page.get("canonical_url"):
        score += 5
    sc = page.get("status_code", 0)
    if sc == 200:
        score += 10
    elif 300 <= sc < 400:
        score += 5
    return min(score, 100)


def _find_common_issues(pages: list) -> list[str]:
    issues = []
    total = len(pages)
    if total == 0:
        return issues
    no_title = sum(1 for p in pages if not p.get("title"))
    no_desc = sum(1 for p in pages if not p.get("meta_description"))
    no_h1 = sum(1 for p in pages if not (p.get("headings") or {}).get("h1"))
    no_schema = sum(1 for p in pages if not p.get("has_schema"))
    thin = sum(1 for p in pages if (p.get("word_count") or 0) < 300)
    errors = sum(1 for p in pages if p.get("error"))
    if no_title:
        issues.append(f"{no_title}/{total} pages missing title tags")
    if no_desc:
        issues.append(f"{no_desc}/{total} pages missing meta descriptions")
    if no_h1:
        issues.append(f"{no_h1}/{total} pages missing H1 headings")
    if no_schema:
        issues.append(f"{no_schema}/{total} pages missing structured data")
    if thin:
        issues.append(f"{thin}/{total} pages have thin content (<300 words)")
    if errors:
        issues.append(f"{errors}/{total} pages had crawl errors")
    return issues


# ---------------------------------------------------------------------------
# Background crawl task (writes to DB)
# ---------------------------------------------------------------------------

async def _run_audit(audit_id: str) -> None:
    """Crawl the site and persist results to SiteAudit + AuditPage."""
    if _session_factory is None:
        return

    try:
        async with _session_factory() as db:
            result = await db.execute(select(SiteAudit).where(SiteAudit.id == audit_id))
            audit = result.scalar_one_or_none()
            if audit is None:
                return

            start_url = audit.start_url
            max_pages = audit.max_pages
            audit.status = "running"
            await db.commit()

        crawler = SiteCrawler(start_url, max_pages=max_pages)

        async def on_progress(crawled: int, total: int) -> None:
            try:
                async with _session_factory() as db:
                    result = await db.execute(
                        select(SiteAudit).where(SiteAudit.id == audit_id)
                    )
                    a = result.scalar_one_or_none()
                    if a:
                        a.pages_crawled = crawled
                        await db.commit()
            except Exception:
                pass

        raw_pages = await crawler.crawl(progress_callback=on_progress)

        scored_pages = []
        for page in raw_pages:
            page["seo_score"] = _basic_seo_score(page)
            scored_pages.append(page)

        async with _session_factory() as db:
            result = await db.execute(select(SiteAudit).where(SiteAudit.id == audit_id))
            audit = result.scalar_one_or_none()
            if audit is None:
                return

            for page in scored_pages:
                ap = AuditPage(
                    audit_id=audit.id,
                    url=page.get("url", ""),
                    status_code=page.get("status_code", 0),
                    title=page.get("title"),
                    meta_description=page.get("meta_description"),
                    headings=page.get("headings"),
                    word_count=page.get("word_count", 0),
                    has_schema=bool(page.get("has_schema")),
                    seo_score=page.get("seo_score"),
                    error=page.get("error"),
                )
                db.add(ap)

            seo_scores = [p.get("seo_score") for p in scored_pages if p.get("seo_score") is not None]
            avg_seo = round(sum(seo_scores) / len(seo_scores)) if seo_scores else None
            common_issues = _find_common_issues(scored_pages)

            audit.pages_crawled = len(scored_pages)
            audit.avg_seo_score = avg_seo
            audit.common_issues = common_issues
            audit.status = "completed"
            audit.completed_at = datetime.now(timezone.utc)
            await db.commit()

    except Exception as exc:
        logger.exception("Audit %s failed", audit_id)
        try:
            async with _session_factory() as db:
                result = await db.execute(select(SiteAudit).where(SiteAudit.id == audit_id))
                audit = result.scalar_one_or_none()
                if audit:
                    audit.status = "failed"
                    audit.error = str(exc)[:500]
                    await db.commit()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=AuditResponse, status_code=status.HTTP_201_CREATED)
async def create_audit(
    body: AuditCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditResponse:
    """Start a new site audit."""
    domain_raw = body.domain.strip()
    url = domain_raw if domain_raw.startswith("http") else f"https://{domain_raw}"
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain",
        )

    audit = SiteAudit(
        user_id=user.id,
        domain=domain,
        start_url=url,
        status="pending",
        max_pages=50,
        pages_crawled=0,
    )
    db.add(audit)
    await db.flush()
    await db.refresh(audit)

    background_tasks.add_task(_run_audit, str(audit.id))

    return _to_response(audit, issues_found=0)


@router.get("", response_model=PaginatedAudits)
async def list_audits(
    page: int = 1,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAudits:
    """List site audits for the authenticated user."""
    page = max(1, page)
    limit = max(1, min(limit, 100))
    offset = (page - 1) * limit

    total_result = await db.execute(
        select(func.count()).select_from(SiteAudit).where(SiteAudit.user_id == user.id)
    )
    total = total_result.scalar_one()

    rows = await db.execute(
        select(SiteAudit)
        .where(SiteAudit.user_id == user.id)
        .order_by(SiteAudit.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    audits = rows.scalars().all()
    pages_count = math.ceil(total / limit) if total > 0 else 1

    items = []
    for audit in audits:
        issues_result = await db.execute(
            select(func.count())
            .select_from(AuditPage)
            .where(
                AuditPage.audit_id == audit.id,
                AuditPage.seo_score < 60,
            )
        )
        issues_found = issues_result.scalar_one()
        items.append(_to_response(audit, issues_found=issues_found))

    return PaginatedAudits(items=items, total=total, page=page, pages=pages_count)


@router.get("/{audit_id}", response_model=AuditResponse)
async def get_audit(
    audit_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditResponse:
    """Fetch a single audit by ID."""
    result = await db.execute(
        select(SiteAudit).where(
            SiteAudit.id == audit_id,
            SiteAudit.user_id == user.id,
        )
    )
    audit = result.scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")

    issues_result = await db.execute(
        select(func.count())
        .select_from(AuditPage)
        .where(AuditPage.audit_id == audit.id, AuditPage.seo_score < 60)
    )
    issues_found = issues_result.scalar_one()

    return _to_response(audit, issues_found=issues_found)
