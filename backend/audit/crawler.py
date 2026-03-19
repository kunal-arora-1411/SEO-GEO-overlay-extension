"""BFS web crawler for multi-page site audits."""

import asyncio
import logging
from urllib.parse import urljoin, urlparse
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

DEFAULT_MAX_PAGES = 50
DEFAULT_CONCURRENCY = 5
DEFAULT_TIMEOUT = 15


class SiteCrawler:
    """Breadth-first crawler that discovers internal pages from a starting URL."""

    def __init__(
        self,
        start_url: str,
        max_pages: int = DEFAULT_MAX_PAGES,
        concurrency: int = DEFAULT_CONCURRENCY,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self._start_url = start_url
        self._max_pages = max_pages
        self._concurrency = concurrency
        self._timeout = timeout
        parsed = urlparse(start_url)
        self._domain = parsed.netloc
        self._scheme = parsed.scheme or "https"
        self._visited: set[str] = set()
        self._results: list[dict[str, Any]] = []
        self._semaphore = asyncio.Semaphore(concurrency)

    async def crawl(
        self,
        progress_callback=None,
    ) -> list[dict[str, Any]]:
        """Run BFS crawl and return list of page results.

        Each result contains: url, status_code, title, meta_description,
        headings, word_count, links_found, error (if any).
        """
        queue = asyncio.Queue()
        queue.put_nowait(self._start_url)

        async with httpx.AsyncClient(
            timeout=self._timeout,
            follow_redirects=True,
            headers={"User-Agent": "SEO-GEO-Optimizer-Crawler/1.0"},
        ) as client:
            while not queue.empty() and len(self._visited) < self._max_pages:
                # Process batch from queue
                batch: list[str] = []
                while not queue.empty() and len(batch) < self._concurrency:
                    url = queue.get_nowait()
                    normalized = self._normalize_url(url)
                    if normalized and normalized not in self._visited:
                        self._visited.add(normalized)
                        batch.append(normalized)

                if not batch:
                    break

                tasks = [self._fetch_page(client, url, queue) for url in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, dict):
                        self._results.append(result)
                    elif isinstance(result, Exception):
                        logger.warning("Crawl error: %s", result)

                if progress_callback:
                    await progress_callback(len(self._results), self._max_pages)

        return self._results

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        url: str,
        queue: asyncio.Queue,
    ) -> dict[str, Any]:
        """Fetch a single page and extract basic SEO data."""
        async with self._semaphore:
            try:
                response = await client.get(url)
                content_type = response.headers.get("content-type", "")

                if "text/html" not in content_type:
                    return {
                        "url": url,
                        "status_code": response.status_code,
                        "error": f"Non-HTML content: {content_type}",
                    }

                html = response.text
                soup = BeautifulSoup(html, "lxml")

                # Extract basic data
                title_tag = soup.find("title")
                title = title_tag.get_text(strip=True) if title_tag else None

                meta_desc_tag = soup.find("meta", attrs={"name": "description"})
                meta_description = (
                    meta_desc_tag.get("content", "").strip()
                    if meta_desc_tag else None
                )

                # Headings
                headings = {
                    "h1": [h.get_text(strip=True) for h in soup.find_all("h1")],
                    "h2": [h.get_text(strip=True) for h in soup.find_all("h2")],
                }

                # Word count from body text
                body = soup.find("body")
                body_text = body.get_text(separator=" ", strip=True) if body else ""
                word_count = len(body_text.split()) if body_text else 0

                # Find internal links
                links_found = 0
                for a_tag in soup.find_all("a", href=True):
                    href = a_tag["href"]
                    abs_url = urljoin(url, href)
                    parsed = urlparse(abs_url)

                    if parsed.netloc == self._domain and self._is_crawlable(abs_url):
                        normalized = self._normalize_url(abs_url)
                        if normalized and normalized not in self._visited:
                            if len(self._visited) + queue.qsize() < self._max_pages:
                                queue.put_nowait(normalized)
                        links_found += 1

                # Check for structured data
                json_ld_scripts = soup.find_all("script", type="application/ld+json")
                has_schema = len(json_ld_scripts) > 0

                # Check canonical
                canonical_tag = soup.find("link", rel="canonical")
                canonical_url = (
                    canonical_tag.get("href") if canonical_tag else None
                )

                return {
                    "url": url,
                    "status_code": response.status_code,
                    "title": title,
                    "meta_description": meta_description,
                    "headings": headings,
                    "word_count": word_count,
                    "links_found": links_found,
                    "has_schema": has_schema,
                    "canonical_url": canonical_url,
                    "error": None,
                }

            except httpx.TimeoutException:
                return {"url": url, "status_code": 0, "error": "Request timed out"}
            except httpx.HTTPError as e:
                return {"url": url, "status_code": 0, "error": str(e)}
            except Exception as e:
                logger.exception("Unexpected error crawling %s", url)
                return {"url": url, "status_code": 0, "error": str(e)}

    def _normalize_url(self, url: str) -> str | None:
        """Normalize a URL by removing fragment and trailing slash."""
        try:
            parsed = urlparse(url)
            if parsed.netloc != self._domain:
                return None
            # Remove fragment
            path = parsed.path.rstrip("/") or "/"
            normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
            if parsed.query:
                normalized += f"?{parsed.query}"
            return normalized
        except Exception:
            return None

    def _is_crawlable(self, url: str) -> bool:
        """Check if a URL should be crawled."""
        parsed = urlparse(url)
        path = parsed.path.lower()

        # Skip non-page resources
        skip_extensions = {
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg",
            ".css", ".js", ".xml", ".zip", ".gz", ".mp4",
            ".mp3", ".webp", ".ico", ".woff", ".woff2", ".ttf",
        }
        for ext in skip_extensions:
            if path.endswith(ext):
                return False

        # Skip common non-content paths
        skip_prefixes = ["/wp-admin", "/wp-login", "/admin", "/api/", "/feed"]
        for prefix in skip_prefixes:
            if path.startswith(prefix):
                return False

        return True
