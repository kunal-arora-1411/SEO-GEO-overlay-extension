"""Competitor page analysis and gap detection logic."""

import logging
import re
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 15
_USER_AGENT = "SEO-GEO-Optimizer-Competitor-Analyzer/1.0"


class CompetitorAnalyzer:
    """Fetches competitor pages and produces SEO/GEO scores for comparison."""

    async def analyze_competitor(self, url: str) -> dict[str, Any]:
        """Fetch a competitor page, extract content, and compute SEO/GEO scores.

        Returns a dict with keys: url, domain, title, meta_description,
        word_count, headings_count, has_schema, seo_score, geo_score,
        categories, and any error.
        """
        parsed = urlparse(url)
        domain = parsed.netloc

        result: dict[str, Any] = {
            "url": url,
            "domain": domain,
            "title": None,
            "meta_description": None,
            "word_count": 0,
            "headings_count": 0,
            "has_schema": False,
            "internal_links": 0,
            "external_links": 0,
            "seo_score": 0.0,
            "geo_score": 0.0,
            "categories": {},
            "error": None,
        }

        try:
            async with httpx.AsyncClient(
                timeout=_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": _USER_AGENT},
            ) as client:
                response = await client.get(url)

            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                result["error"] = f"Non-HTML content: {content_type}"
                return result

            html = response.text
            result.update(self._extract_page_data(html, url, domain))
            result["seo_score"] = self._score_seo(result)
            result["geo_score"] = self._score_geo(result, html)
            result["categories"] = self._build_categories(result, html)

        except httpx.TimeoutException:
            result["error"] = "Request timed out"
        except httpx.HTTPError as exc:
            result["error"] = f"HTTP error: {exc}"
        except Exception as exc:
            logger.exception("Unexpected error analysing competitor %s", url)
            result["error"] = str(exc)

        return result

    def compare(
        self,
        your_analysis: dict[str, Any],
        competitor_analysis: dict[str, Any],
    ) -> dict[str, Any]:
        """Compare your analysis against a competitor's to produce a gap report.

        Returns dict with: your_scores, competitor_scores, gaps.
        """
        your_cats = your_analysis.get("categories", {})
        comp_cats = competitor_analysis.get("categories", {})

        your_scores = {
            "seo_score": float(your_analysis.get("seo_score", 0)),
            "geo_score": float(your_analysis.get("geo_score", 0)),
            **{k: float(v) for k, v in your_cats.items()},
        }
        competitor_scores = {
            "seo_score": float(competitor_analysis.get("seo_score", 0)),
            "geo_score": float(competitor_analysis.get("geo_score", 0)),
            **{k: float(v) for k, v in comp_cats.items()},
        }

        all_categories = set(your_scores.keys()) | set(competitor_scores.keys())
        gaps = self.find_gaps(
            {c: your_scores.get(c, 0.0) for c in all_categories},
            {c: competitor_scores.get(c, 0.0) for c in all_categories},
        )

        return {
            "your_scores": your_scores,
            "competitor_scores": competitor_scores,
            "gaps": gaps,
        }

    def find_gaps(
        self,
        your_categories: dict[str, float],
        competitor_categories: dict[str, float],
    ) -> list[dict[str, Any]]:
        """Flag categories where the competitor leads by more than 10 points.

        Returns a list of GapItem-compatible dicts sorted by largest gap first.
        """
        gaps: list[dict[str, Any]] = []

        for category in your_categories:
            your_score = your_categories.get(category, 0.0)
            comp_score = competitor_categories.get(category, 0.0)
            difference = comp_score - your_score

            if difference > 10:
                recommendation = self._gap_recommendation(category, difference)
                gaps.append({
                    "category": category,
                    "your_score": round(your_score, 1),
                    "competitor_score": round(comp_score, 1),
                    "difference": round(difference, 1),
                    "recommendation": recommendation,
                })

        gaps.sort(key=lambda g: g["difference"], reverse=True)
        return gaps

    # --- Internal helpers -----------------------------------------------

    def _extract_page_data(
        self,
        html: str,
        url: str,
        domain: str,
    ) -> dict[str, Any]:
        """Extract structured data from raw HTML without heavy parsing deps.

        Uses regex-based extraction to avoid requiring BeautifulSoup as a hard
        dependency in the competitor module (the audit module already owns that
        dependency).
        """
        data: dict[str, Any] = {}

        # Title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        data["title"] = title_match.group(1).strip() if title_match else None

        # Meta description
        desc_match = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        )
        if not desc_match:
            desc_match = re.search(
                r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']',
                html,
                re.IGNORECASE,
            )
        data["meta_description"] = desc_match.group(1).strip() if desc_match else None

        # Headings count
        h1_count = len(re.findall(r"<h1[\s>]", html, re.IGNORECASE))
        h2_count = len(re.findall(r"<h2[\s>]", html, re.IGNORECASE))
        h3_count = len(re.findall(r"<h3[\s>]", html, re.IGNORECASE))
        data["headings_count"] = h1_count + h2_count + h3_count
        data["h1_count"] = h1_count
        data["h2_count"] = h2_count

        # Strip HTML tags to get body text and word count
        body_match = re.search(r"<body[^>]*>(.*)</body>", html, re.IGNORECASE | re.DOTALL)
        body_html = body_match.group(1) if body_match else html
        # Remove script and style blocks
        body_clean = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", body_html, flags=re.DOTALL | re.IGNORECASE)
        body_text = re.sub(r"<[^>]+>", " ", body_clean)
        body_text = re.sub(r"\s+", " ", body_text).strip()
        words = body_text.split()
        data["word_count"] = len(words)

        # Links
        all_links = re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', html, re.IGNORECASE)
        internal = 0
        external = 0
        for href in all_links:
            if href.startswith("#") or href.startswith("javascript:"):
                continue
            if href.startswith("/") or domain in href:
                internal += 1
            else:
                external += 1
        data["internal_links"] = internal
        data["external_links"] = external

        # Structured data
        data["has_schema"] = bool(re.search(r'type=["\']application/ld\+json["\']', html, re.IGNORECASE))

        # Lists and tables
        data["list_count"] = len(re.findall(r"<(ul|ol)[\s>]", html, re.IGNORECASE))
        data["table_count"] = len(re.findall(r"<table[\s>]", html, re.IGNORECASE))

        return data

    def _score_seo(self, data: dict[str, Any]) -> float:
        """Compute a basic SEO score (0-100) from extracted page data."""
        score = 0.0

        # Title (20 pts)
        title = data.get("title") or ""
        if title:
            tlen = len(title)
            if 30 <= tlen <= 60:
                score += 20
            else:
                score += 10

        # Meta description (15 pts)
        desc = data.get("meta_description") or ""
        if desc:
            dlen = len(desc)
            if 120 <= dlen <= 160:
                score += 15
            else:
                score += 7

        # H1 (15 pts)
        h1_count = data.get("h1_count", 0)
        if h1_count == 1:
            score += 15
        elif h1_count > 1:
            score += 8

        # H2s (10 pts)
        h2_count = data.get("h2_count", 0)
        if 2 <= h2_count <= 8:
            score += 10
        elif h2_count > 0:
            score += 5

        # Content length (15 pts)
        wc = data.get("word_count", 0)
        if wc >= 1000:
            score += 15
        elif wc >= 300:
            score += 8

        # Schema (10 pts)
        if data.get("has_schema"):
            score += 10

        # Internal links (10 pts)
        il = data.get("internal_links", 0)
        if il >= 5:
            score += 10
        elif il >= 1:
            score += 5

        # External links (5 pts)
        el = data.get("external_links", 0)
        if el >= 2:
            score += 5
        elif el >= 1:
            score += 2

        return min(round(score, 1), 100.0)

    def _score_geo(self, data: dict[str, Any], html: str) -> float:
        """Compute a basic GEO (Generative Engine Optimization) score.

        Evaluates content features that help generative AI engines understand
        and cite the page: structured data, concise answers, lists/tables,
        authoritative language, etc.
        """
        score = 0.0

        # Structured data presence (20 pts)
        if data.get("has_schema"):
            score += 20

        # Content depth - enough words for substantive answers (20 pts)
        wc = data.get("word_count", 0)
        if wc >= 1500:
            score += 20
        elif wc >= 800:
            score += 12
        elif wc >= 300:
            score += 6

        # Lists and tables for scannability (15 pts)
        list_count = data.get("list_count", 0)
        table_count = data.get("table_count", 0)
        if list_count >= 2 or table_count >= 1:
            score += 15
        elif list_count >= 1:
            score += 8

        # Clear heading hierarchy (15 pts)
        headings = data.get("headings_count", 0)
        if headings >= 5:
            score += 15
        elif headings >= 3:
            score += 10
        elif headings >= 1:
            score += 5

        # FAQ / Q&A patterns (15 pts)
        faq_patterns = len(re.findall(
            r"(what is|how to|why does|when should|FAQ|frequently asked)",
            html,
            re.IGNORECASE,
        ))
        if faq_patterns >= 3:
            score += 15
        elif faq_patterns >= 1:
            score += 8

        # Authoritative signals - citations, statistics (15 pts)
        stat_patterns = len(re.findall(r"\d+%|\d+\.\d+", html))
        citation_patterns = len(re.findall(
            r"(according to|research shows|study|source:|cited)",
            html,
            re.IGNORECASE,
        ))
        authority_signals = stat_patterns + citation_patterns
        if authority_signals >= 5:
            score += 15
        elif authority_signals >= 2:
            score += 8

        return min(round(score, 1), 100.0)

    def _build_categories(
        self,
        data: dict[str, Any],
        html: str,
    ) -> dict[str, float]:
        """Build per-category score breakdown for comparison."""
        categories: dict[str, float] = {}

        # Content depth
        wc = data.get("word_count", 0)
        if wc >= 1500:
            categories["content_depth"] = 100.0
        elif wc >= 800:
            categories["content_depth"] = 60.0
        elif wc >= 300:
            categories["content_depth"] = 30.0
        else:
            categories["content_depth"] = 0.0

        # Technical SEO
        tech_score = 0.0
        if data.get("title"):
            tech_score += 33.3
        if data.get("meta_description"):
            tech_score += 33.3
        if data.get("has_schema"):
            tech_score += 33.4
        categories["technical_seo"] = round(tech_score, 1)

        # Content structure
        headings = data.get("headings_count", 0)
        lists = data.get("list_count", 0)
        tables = data.get("table_count", 0)
        structure_score = min(headings * 10 + lists * 15 + tables * 20, 100)
        categories["content_structure"] = float(structure_score)

        # Authority signals
        stat_count = len(re.findall(r"\d+%|\d+\.\d+", html))
        cite_count = len(re.findall(
            r"(according to|research|study|source:|cited)",
            html,
            re.IGNORECASE,
        ))
        authority = min((stat_count + cite_count) * 10, 100)
        categories["authority"] = float(authority)

        # Link profile
        il = data.get("internal_links", 0)
        el = data.get("external_links", 0)
        link_score = min(il * 5 + el * 10, 100)
        categories["link_profile"] = float(link_score)

        return categories

    def _gap_recommendation(self, category: str, difference: float) -> str:
        """Generate a human-readable recommendation for a category gap."""
        recommendations = {
            "seo_score": (
                f"Your overall SEO score trails by {difference:.0f} points. "
                "Focus on meta tags, heading structure, and content length."
            ),
            "geo_score": (
                f"Your GEO score is {difference:.0f} points behind. "
                "Add structured data, FAQ sections, and authoritative citations."
            ),
            "content_depth": (
                f"Competitor has deeper content (gap: {difference:.0f} pts). "
                "Expand your content with more comprehensive coverage of the topic."
            ),
            "technical_seo": (
                f"Technical SEO gap of {difference:.0f} points. "
                "Ensure title, meta description, and structured data are all present."
            ),
            "content_structure": (
                f"Content structure gap of {difference:.0f} points. "
                "Add more headings, bulleted lists, and tables to improve scannability."
            ),
            "authority": (
                f"Authority signals gap of {difference:.0f} points. "
                "Include statistics, cite research, and reference authoritative sources."
            ),
            "link_profile": (
                f"Link profile gap of {difference:.0f} points. "
                "Improve internal linking and add relevant outbound references."
            ),
        }
        return recommendations.get(
            category,
            f"Competitor leads by {difference:.0f} points in '{category}'. "
            "Analyse their page to identify specific improvements.",
        )
