"""Server-side SEO scorer placeholder.

This mirrors the client-side SEO scoring logic for consistency and
provides a basic score when the backend needs to produce one
independently (e.g. for cached results or API-only consumers).
"""

from api.schemas import AnalyzeRequest


class SEOScorer:
    """Lightweight rule-based SEO scorer."""

    def score(self, request: AnalyzeRequest) -> dict:
        """Return a basic SEO score dict based on simple heuristics."""
        score = 0
        max_score = 100
        findings: list[str] = []

        # Title checks (0-20)
        title = request.meta.title or ""
        title_len = request.meta.title_length or len(title)
        if 30 <= title_len <= 60:
            score += 20
            findings.append("Title length is optimal (30-60 chars)")
        elif title:
            score += 10
            findings.append(f"Title length ({title_len}) is outside optimal range")
        else:
            findings.append("Missing page title")

        # Meta description (0-15)
        desc = request.meta.meta_description or ""
        desc_len = request.meta.meta_description_length or len(desc)
        if 120 <= desc_len <= 160:
            score += 15
            findings.append("Meta description length is optimal")
        elif desc:
            score += 7
            findings.append(f"Meta description length ({desc_len}) is outside optimal range")
        else:
            findings.append("Missing meta description")

        # H1 (0-15)
        if request.headings.h1:
            score += 15
            findings.append("H1 tag present")
        else:
            findings.append("Missing H1 tag")

        # Heading hierarchy (0-10)
        if request.headings.h2:
            score += 10
            findings.append("Content uses H2 sub-headings")
        else:
            findings.append("No H2 headings found")

        # Content length (0-15)
        wc = request.content.word_count
        if wc >= 1000:
            score += 15
            findings.append(f"Good content length ({wc} words)")
        elif wc >= 300:
            score += 8
            findings.append(f"Content could be longer ({wc} words)")
        else:
            findings.append(f"Thin content ({wc} words)")

        # Internal links (0-10)
        if request.links.internal_count >= 3:
            score += 10
            findings.append("Adequate internal linking")
        elif request.links.internal_count >= 1:
            score += 5
            findings.append("Limited internal linking")
        else:
            findings.append("No internal links detected")

        # Structured data (0-10)
        if request.structured_data.has_schema:
            score += 10
            findings.append("Schema markup detected")
        else:
            findings.append("No schema markup found")

        # Canonical (0-5)
        if request.meta.canonical_url:
            score += 5
            findings.append("Canonical URL set")
        else:
            findings.append("No canonical URL")

        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "findings": findings,
        }
