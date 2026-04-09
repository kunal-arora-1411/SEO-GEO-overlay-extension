# Combined SEO & GEO Detection Research
## Unified Analysis: Research + Skills Library

**Purpose**: Map every detectable SEO/GEO signal to determine what the browser extension should check, how to detect it, and what actionable guidance to surface — all without LLM hallucination.

**Sources Synthesized**:
- `SEO-GEO-Research.md` (our client-side detection research)
- 7 Skills: geo-content-optimizer, technical-seo-checker, entity-optimizer, on-page-seo-auditor, content-quality-auditor, seo-content-writer, keyword-research
- Reference files: ai-citation-patterns.md, geo-optimization-techniques.md, CORE-EEAT item-reference.md

---

## Part 1: The Detection Architecture

### What Each Skill Teaches Us About Detection

| Skill | What It Audits | What's Client-Side Detectable | What Needs External Data |
|-------|---------------|------------------------------|-------------------------|
| **on-page-seo-auditor** | Title, meta, headers, content, keywords, links, images | ~95% — all DOM-based | Keyword search volume, competitor comparison |
| **technical-seo-checker** | CWV, crawlability, indexability, security, URLs, schema | ~60% — DOM + performance APIs | robots.txt, sitemap, crawl budget, server headers |
| **content-quality-auditor** | 80-item CORE-EEAT across 8 dimensions | ~70% — CORE (40 items) mostly detectable; EEAT partially | Backlinks, brand recognition, media mentions (Authority items) |
| **geo-content-optimizer** | AI citation readiness across 5 AI engines | ~90% — structure patterns, not subjective quality | AI citation tracking, competitor citation frequency |
| **entity-optimizer** | Entity presence in Knowledge Graph, Wikidata, AI systems | ~30% — schema on page, sameAs links, NAP consistency | Knowledge Graph API, Wikidata, AI query testing |
| **seo-content-writer** | Content structure, keyword integration, readability | ~85% — all structural/textual analysis | Keyword metrics, SERP features, competitor content |
| **keyword-research** | Keyword opportunity, intent, difficulty | ~20% — can classify intent from page content | Search volume, KD scores, SERP analysis |

### Detection Tier Model

**Tier 1: Pure Client-Side (Extension Core)** — Runs in content script, instant results
**Tier 2: Enhanced Client-Side** — Uses Web APIs (Performance Observer, Canvas measureText, IntersectionObserver)
**Tier 3: Optional Backend** — External data enrichment (not required for core functionality)

---

## Part 2: Unified Detection Checklist

### A. SEO Element Detection (from on-page-seo-auditor + our research)

#### A1. Title Tag (Weight: 15/100 in on-page score)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Title exists | `document.querySelector('title')` | Must exist | Critical | Both |
| Title length (chars) | `title.textContent.length` | 30-60 chars optimal | Warning | Research |
| Title pixel width | `canvas.measureText(title)` with serif/sans-serif fonts | Max ~580px desktop | Warning | Research |
| Multiple titles | `document.querySelectorAll('title').length` | Error if > 1 | Error | Research |
| Title has keyword | Compare title text to H1 and page topic | Should contain primary topic | Info | Skills |
| Title is generic | Regex for "Home", "Untitled", "Page", brand-only | Should be descriptive | Warning | Both |
| Title has modifier | Regex for year, "Guide", "Best", "How to", numbers | Improves CTR | Info | Research |
| Title = meta description | Compare title to meta desc | Should differ | Warning | Research |

#### A2. Meta Description (Weight: 10/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Meta desc exists | `document.querySelector('meta[name="description"]')` | Must exist | Warning | Both |
| Meta desc length | `.content.length` | 70-160 chars (optimal 150-160) | Warning | Both |
| Multiple meta descs | `querySelectorAll('meta[name="description"]').length` | Error if > 1 | Error | Research |
| Has CTA | Regex for "Learn", "Discover", "Find out", "Get", action verbs | Improves CTR | Info | Research |
| Duplicate of title | Compare to title text | Should differ | Warning | Research |

#### A3. Heading Structure (Weight: 12/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Single H1 | `querySelectorAll('h1').length` | Exactly 1 | Error/Warning | Both |
| H1 length | `h1.textContent.length` | 10-70 chars | Warning | Research |
| Valid hierarchy | Walk headings, check no skipped levels (H1→H3) | No level skipping | Warning | Both |
| H2 count | `querySelectorAll('h2').length` | 2-8 for standard content | Warning | Research |
| Descriptive headings | Check for generic ("Section 1", single word) | Should be descriptive | Info | Research |
| Question-pattern headings | Regex `/^(what|how|why|when|where|who)\s/i` or `\?$` | GEO: more = better | Info | Research (GEO) |
| H1 contains topic keyword | Compare H1 to page topic terms | Should contain primary topic | Info | Skills |

#### A4. Content Quality (Weight: 15/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Word count | `textContent` of main/article, split and count | Min 300 (thin), optimal 800-2000+ | Warning | Both |
| Readability (Flesch) | Syllable counting algorithm on paragraphs | 30-70 optimal (audience dependent) | Info | Both |
| Paragraph length | Count words per `<p>` | Flag > 150 words (walls of text) | Warning | Both |
| Sentence length | Split by `.!?`, count words | Average < 25 words, flag > 35 | Info | Research |
| Filler content | Regex for "in today's world", "it is important to note", "without further ado", "let's dive in", "as we all know", "at the end of the day", "stay tuned", "buckle up" | <= 2 per 1000 words | Warning | Research (GEO) |
| Promotional superlatives | Regex for "best", "#1", "revolutionary", "game-changing", "unbeatable", "buy now", "!!!" | <= 3 per 1000 words | Warning | Research (GEO) |
| Lists present | `querySelectorAll('ul, ol').length` | At least 1 for UX | Info | Both |
| Tables present | `querySelectorAll('table').length` | GEO: tables = 2.5x citation rate | Info | Research (GEO) |
| CTAs present | Regex/selector for buttons, "sign up", "get started", "learn more" | At least 1 | Info | Research |

#### A5. Links (Weight: 10/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Internal link count | Count `<a>` with same-domain href | >= 3 | Warning | Both |
| External link count | Count `<a>` with different-domain href | >= 1-3 authoritative | Info | Skills |
| Descriptive anchors | Flag "click here", "read more", "here", single-word anchors | All should be descriptive | Warning | Both |
| Orphan links | `a[href=""], a[href="#"]` | Should not exist | Warning | Research |
| Total links | Count all `<a>` | Warn if > 150 | Info | Research |

#### A6. Images (Weight: 8/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Alt text exists | `img:not([alt]), img[alt=""]` | All images need alt | Warning | Both |
| Alt text is filename | Regex `/\.(jpg|png|gif|webp|svg)/i` on alt | Should not be filename | Warning | Research |
| Alt text too long | `alt.length > 125` | Max 125 chars (screen reader cutoff) | Info | Research |
| Missing width/height | Check `width`/`height` attributes on `<img>` | Causes CLS | Warning | Research |
| Missing lazy loading | Check offscreen images for `loading="lazy"` | Performance | Info | Research |
| Above-fold preload | Check hero/LCP images for `<link rel="preload">` | LCP optimization | Info | Research |

#### A7. Technical On-Page (Weight: 10/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Canonical exists | `link[rel="canonical"]` | Must exist | Warning | Both |
| Canonical self-referencing | Compare canonical href to `window.location` | Should match (usually) | Warning | Research |
| Canonical protocol mismatch | HTTP vs HTTPS in canonical | Must match | Error | Research |
| Viewport meta | `meta[name="viewport"]` | Must exist | Warning | Both |
| Lang attribute | `document.documentElement.lang` | Should be set | Warning | Both |
| Charset | `meta[charset]` or `meta[http-equiv="Content-Type"]` | Must be UTF-8 | Info | Both |
| URL has uppercase | `window.location.href !== window.location.href.toLowerCase()` | Should be lowercase | Info | Research |
| Render-blocking scripts | `<script>` in `<head>` without `async`/`defer` | Performance issue | Warning | Research |
| Font display swap | Check `@font-face` rules for `font-display: swap` | Prevents CLS/LCP | Info | Research |
| Robots meta | `meta[name="robots"]` content check | Watch for accidental noindex | Warning | Both |

#### A8. Open Graph & Social (Weight: 5/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| OG title | `meta[property="og:title"]` | Must exist | Warning | Both |
| OG description | `meta[property="og:description"]` | Must exist, max 65-200 chars | Warning | Both |
| OG image | `meta[property="og:image"]` | Must exist, 1200x630 recommended | Warning | Both |
| OG type | `meta[property="og:type"]` | Should exist | Info | Both |
| OG URL | `meta[property="og:url"]` | Should match canonical | Info | Both |
| Twitter card | `meta[name="twitter:card"]` | Should exist | Info | Research |
| Twitter image | `meta[name="twitter:image"]` | Should exist | Info | Research |

#### A9. Performance / UX (Weight: 5/100)

| Check | Detection Method | Threshold | Severity | Source |
|-------|-----------------|-----------|----------|--------|
| Tap target size | `getBoundingClientRect()` on links/buttons | Min 48x48 CSS px | Warning | Research |
| Font size | `getComputedStyle(document.body).fontSize` | Min 16px recommended | Warning | Research |
| CLS (layout shift) | `PerformanceObserver` for layout-shift entries | < 0.1 good, < 0.25 needs improvement | Warning | Skills |
| LCP | `PerformanceObserver` for largest-contentful-paint | < 2.5s good, < 4.0s needs improvement | Warning | Skills |

---

### B. GEO Detection (from geo-content-optimizer + our research + CORE-EEAT)

**Total: 100 points across 5 categories**

#### B1. Answer Architecture (25 pts)

| Check | Detection | Points | CORE-EEAT ID | AI Engine Priority |
|-------|-----------|--------|-------------|-------------------|
| Direct opening answer | First `<p>` has >= 20 words AND appears before first `<h2>` | 6 | C02 | Google AIO, ChatGPT |
| FAQ-style Q&A pairs | Count headings matching `/^(what|how|why|when|where|who)\s/i` or `\?$` followed by 15-120 word paragraph | 5 | C09 | All engines |
| Term definitions | Regex: "is defined as", "refers to", "known as", "also called", "is a type of" | 4 | C04 | Claude, Perplexity |
| Comparison tables | `<table>` with `<thead>`/`<th>` + bonus for "vs", "compared to", "difference between" | 5 | O03 | Google AIO |
| Self-contained H2 sections | Each `<h2>` followed by >= 50 words before next `<h2>` | 5 | O06 | All engines |

#### B2. Citation Worthiness (25 pts)

| Check | Detection | Points | CORE-EEAT ID | AI Engine Priority |
|-------|-----------|--------|-------------|-------------------|
| Statistics with sources | Paragraphs with number pattern (`\d+%`, `$X million`) AND attribution ("according to", "source:", "(2024)") | 7 | R01, R02 | ChatGPT, Perplexity |
| Attributed claims | Regex: "according to [Name]", "[Name] et al", institution names (Harvard, WHO, CDC) | 5 | R03 | Perplexity, Claude |
| Expert quotes | `<blockquote>` elements OR text in quotes + attribution ("said", "noted", "argues") | 4 | Ept05 | ChatGPT |
| Publication date visible | `datePublished`/`dateModified` in JSON-LD, `<time>`, meta `article:published_time`, OR visible date patterns | 5 | R06 | Google AIO, Perplexity |
| Author attribution | `[itemprop="author"]`, `.author`, `.byline`, meta `author`, or `author` in JSON-LD | 4 | Ept01 | All engines |

#### B3. Machine Readability (20 pts)

| Check | Detection | Points | CORE-EEAT ID | AI Engine Priority |
|-------|-----------|--------|-------------|-------------------|
| JSON-LD schema present | `script[type="application/ld+json"]` count > 0 | 5 | O05 | Google AIO |
| Semantic HTML | Has `<main>` or `<article>`, proper heading hierarchy, `<ul>`/`<ol>`, `<table>` | 4 | R09 | All engines |
| Text not in images | `textContent.length / querySelectorAll('img').length` ratio | 3 | — | All engines |
| Content in initial HTML | Word count >= 100 on `document_idle` | 4 | — | All engines |
| AI crawlers not blocked | Check robots meta for `noai`, `noimageai`, check `data-nosnippet` overuse | 2 | — | All engines |
| llms.txt reference | Check for `<link>` pointing to `/llms.txt` | 2 | — | Claude, ChatGPT |

#### B4. Content Precision (15 pts)

| Check | Detection | Points | CORE-EEAT ID | AI Engine Priority |
|-------|-----------|--------|-------------|-------------------|
| Specific entities/numbers | Count proper nouns, years, dollar amounts, percentages per 500 words | 5 | R07 | Perplexity, Claude |
| Verifiable claims per paragraph | For paras > 30 words, check for number/date/named entity/citation | 5 | R04 | All engines |
| No filler content | Filler regex (see A4 above) | 5 | O09 | All engines |

#### B5. Multi-Engine Optimization (15 pts)

| Check | Detection | Points | CORE-EEAT ID | AI Engine Priority |
|-------|-----------|--------|-------------|-------------------|
| Neutral tone | Count promotional superlatives per 1000 words | 5 | — | All engines |
| Experience-based markers | Regex: "in our experience", "we tested", "when I tried", "based on our testing" | 5 | Exp01, Exp10 | Claude |
| Opening answers question | First 50 words contain answer indicator: "is a", "refers to", "you can", "you should" | 5 | C02 | Google AIO, ChatGPT |

---

### C. CORE-EEAT Items Detectable Client-Side (from content-quality-auditor)

The 80-item CORE-EEAT benchmark maps to our detection capabilities:

#### Fully Detectable Client-Side (52/80 items)

**C — Contextual Clarity (9/10 detectable)**
- C01: Intent Alignment — Compare title/H1 to content
- C02: Direct Answer — First paragraph analysis
- C03: Query Coverage — Synonym/variant detection
- C04: Definition First — Term definition regex
- C05: Topic Scope — Scope declaration detection
- C06: Audience Targeting — "this is for..." patterns
- C07: Semantic Coherence — Heading flow analysis
- C08: Use Case Mapping — Decision matrix / "if...then" patterns
- C09: FAQ Coverage — FAQ section detection + FAQPage schema
- C10: Semantic Closure — Conclusion + callback to intro

**O — Organization (10/10 detectable)**
- O01: Heading Hierarchy — H1→H2→H3 validation
- O02: Summary Box — TL;DR / Key Takeaways detection
- O03: Data Tables — `<table>` with `<th>` or `<thead>`
- O04: List Formatting — `<ul>`, `<ol>` presence and usage
- O05: Schema Markup — JSON-LD presence and type checking
- O06: Section Chunking — Paragraph count per section
- O07: Visual Hierarchy — Bold, callouts, blockquotes
- O08: Anchor Navigation — ToC / jump links detection
- O09: Information Density — Filler ratio calculation
- O10: Multimedia Structure — Image captions, video embeds

**R — Referenceability (9/10 detectable)**
- R01: Data Precision — Number + unit + source patterns
- R02: Citation Density — External citation count per 500 words
- R03: Source Hierarchy — Check citation authority (.gov, .edu, peer-reviewed patterns)
- R04: Evidence-Claim Mapping — Claims with backing data
- R05: Methodology Transparency — "our method", "we measured" patterns
- R06: Timestamp & Versioning — Date metadata detection
- R07: Entity Precision — Full name vs abbreviation usage
- R08: Internal Link Graph — Internal link count and distribution
- R09: HTML Semantics — Semantic element usage audit
- R10: Content Consistency — Cross-check claims within page

**E — Exclusivity (7/10 detectable)**
- E01: Original Data — "our research", "we found", proprietary data markers
- E02: Novel Framework — Custom model/framework naming
- E04: Contrarian View — "contrary to", "unlike popular belief" patterns
- E06: Gap Filling — "no existing guide covers" patterns
- E07: Practical Tools — Downloadable resource links, calculator/tool embeds
- E08: Depth Advantage — Word count + heading depth comparison
- E09: Synthesis Value — Cross-reference patterns

**Exp — Experience (7/10 detectable)**
- Exp01: First-Person Narrative — First-person pronoun detection
- Exp02: Sensory Details — Sensory language patterns
- Exp04: Tangible Proof — Photo/screenshot/video evidence
- Exp06: Problems Encountered — "we ran into", "the challenge was"
- Exp07: Before/After Comparison — Before/after patterns
- Exp08: Quantified Metrics — Numbers tied to personal experience
- Exp10: Limitations Acknowledged — "however", "limitation", "doesn't work for"

**Ept — Expertise (5/10 detectable)**
- Ept01: Author Identity — Author schema/byline detection
- Ept02: Credentials Display — Credential patterns in author bio
- Ept03: Professional Vocabulary — Technical term density
- Ept05: Methodology Rigor — Methodology section detection
- Ept08: Reasoning Transparency — "because", "the reason", explanation patterns

**A — Authority (2/10 detectable — most need external data)**
- A07: Knowledge Graph Presence — Organization schema with sameAs links
- A08: Entity Consistency — NAP consistency on page

**T — Trust (3/10 detectable)**
- T01: Legal Compliance — Privacy policy, terms of service links
- T04: Disclosure Statements — Affiliate/sponsored disclosure detection
- T08: Risk Disclaimers — Disclaimer patterns for YMYL content

#### Needs External Data (28/80 items)
- E03 (Primary Research), E05 (Proprietary Visuals), E10 (Forward Insights)
- Exp03 (Process Documentation), Exp05 (Usage Duration), Exp09 (Repeated Testing)
- Ept04 (Technical Depth), Ept06 (Edge Cases), Ept07 (Historical Context), Ept09 (Cross-domain), Ept10 (Editorial Process)
- A01-A06, A09-A10 (All external authority signals)
- T02 (Contact Transparency), T03 (Security Standards), T05-T07, T09-T10

---

### D. Entity Detection (from entity-optimizer)

What the extension can detect about entity optimization on a page:

| Check | Detection | Severity | Category |
|-------|-----------|----------|----------|
| Organization/Person schema | JSON-LD with `@type: Organization/Person` | Warning if missing | Structured Data |
| sameAs links | `sameAs` array in schema pointing to social profiles, Wikidata | Info | Structured Data |
| @id consistency | `@id` property in JSON-LD matches canonical URL pattern | Info | Structured Data |
| Author schema | `author` object in Article/BlogPosting schema | Warning if missing | Structured Data |
| About page link | `<a>` pointing to `/about` or `/about-us` | Info | Content-Based |
| Consistent entity name | Compare brand name across title, schema, footer, logo alt | Warning if inconsistent | NAP+E |
| Clear entity definition | First-person entity description in about section or schema `description` | Info | AI-Specific |

---

### E. Technical SEO Detection (from technical-seo-checker)

What the extension can detect client-side:

| Check | Detection | Threshold | Category |
|-------|-----------|-----------|----------|
| HTTPS | `window.location.protocol === 'https:'` | Must be HTTPS | Security |
| Mixed content | `document.querySelectorAll('img[src^="http:"], script[src^="http:"]')` on HTTPS page | None allowed | Security |
| Viewport configured | `meta[name="viewport"]` with `width=device-width` | Must exist | Mobile |
| Schema types present | Parse JSON-LD, list all `@type` values | Report what exists | Structured Data |
| Schema validation | Check required properties per schema type | Warn on missing required fields | Structured Data |
| Redirect detection | Compare `document.URL` to `window.location.href` to initial URL | Flag unexpected redirects | URL Structure |
| HTTP/2 | `performance.getEntriesByType('navigation')[0].nextHopProtocol` | Should be h2 | Performance |
| TTFB | `performance.timing.responseStart - performance.timing.requestStart` | < 800ms good | Performance |
| CWV: LCP | PerformanceObserver for `largest-contentful-paint` | < 2.5s good | Performance |
| CWV: CLS | PerformanceObserver for `layout-shift` | < 0.1 good | Performance |
| CWV: INP | PerformanceObserver for `event` entries | < 200ms good | Performance |

---

## Part 3: AI Engine Priority Matrix

### What Each AI Engine Cares About Most

From the geo-content-optimizer's AI engine preferences + ai-citation-patterns.md:

| Signal | Google AIO | ChatGPT | Perplexity | Claude |
|--------|-----------|---------|------------|--------|
| Direct answer in first 150 words (C02) | **Critical** | **Critical** | High | High |
| Comparison tables (O03) | **Critical** | Medium | High | Medium |
| JSON-LD Schema (O05) | **Critical** | Low | Medium | Low |
| FAQ with Schema (C09) | **Critical** | Medium | Medium | Medium |
| Statistics with sources (R01) | High | **Critical** | **Critical** | High |
| Original first-party data (E01) | Medium | **Critical** | **Critical** | High |
| Source citations (R02, R03) | High | High | **Critical** | **Critical** |
| Methodology transparency (R05) | Low | Medium | **Critical** | High |
| Reasoning transparency (Ept08) | Low | Medium | Medium | **Critical** |
| Limitations acknowledged (Exp10) | Low | Medium | Medium | **Critical** |
| Content freshness (R06) | High | Medium | **Very High** | N/A (training) |
| Author credentials (Ept01) | High | High | High | High |
| Domain authority | **Very High** | High | Medium | High |
| Factual density | High | High | **Very High** | **Very High** |

### Citation Statistics (from our research)

- H1-H2-H3 hierarchy: **2.8x more likely** to be cited
- Tables in content: **2.5x more** citations
- FAQ schema: **3.2x more likely** in AI Overviews
- Content updated within 30 days: **76.4% of ChatGPT's top citations**
- Long-form (>2000 words): **3x more citations**
- Quantitative claims: **40% higher citation rates**
- Mentioned on 4+ platforms: **2.8x more likely** in ChatGPT

---

## Part 4: GEO Impact by Strategy

From the Princeton KDD 2024 paper (our research):

| Strategy | Visibility Improvement | Detectable? | How to Detect |
|----------|----------------------|-------------|---------------|
| Quotation Addition | ~40% | Yes | `<blockquote>` count + quoted text patterns |
| Statistics Addition | ~35% | Yes | Number + source attribution pattern count |
| Cite Sources | ~30% | Yes | Citation count per 500 words |
| Fluency Optimization | ~25% | Partial | Readability score + sentence structure |
| Authoritative Tone | ~13% | Yes | Author credentials + expert attribution detection |
| Easy-to-Understand | ~13% | Partial | Flesch score + avg sentence length |
| Technical Terms | ~9% | Yes | Technical vocabulary density |
| Unique Words | ~6% | Yes | Vocabulary diversity ratio |
| **Keyword Stuffing** | **-10%** | Yes | Keyword density > 3% = harmful |

---

## Part 5: The Fix Suggestion Pattern (No Hallucination)

### What Skills Teach Us About Suggestions

The skills generate replacement text because they're LLM-based tools. But our extension must NOT. Here's how to translate each skill's audit output into deterministic suggestions:

#### From on-page-seo-auditor:

| Skill Says | Extension Should Say |
|------------|---------------------|
| "Recommended Title: [AI-generated title]" | "Your title is **73 chars**: '[actual title]' — exceeds the 60-char max. Trim to ~55 chars. Consider removing filler words or moving brand to end." |
| "Recommended H2: [AI-generated heading]" | "H2 #3 is generic: **'Benefits'** (1 word). Make it descriptive — who benefits from what? Add specificity." |
| "Recommended Description: [AI text]" | "Meta description is **187 chars**: truncated at '...word'. Shorten to 155 chars. Current text has no CTA — add an action verb." |

#### From content-quality-auditor:

| CORE-EEAT Item | Deterministic Fix Pattern |
|----------------|--------------------------|
| C02 (Direct Answer) — Fail | "First `<h2>` appears at word **47**, but the opening `<p>` has only **12 words**. Add a direct answer paragraph (20+ words) before the first H2." |
| C09 (FAQ) — Fail | "Found **0 FAQ-pattern headings** and no FAQPage schema. You have 3 question-pattern H3s ('How does...', 'What is...', 'Why should...'). Consider converting to a FAQ section with schema." |
| O03 (Data Tables) — Fail | "Content includes 4 comparison claims ('X is better than Y') but **0 tables**. Comparison tables get **2.5x more AI citations**. Structure these comparisons as a table." |
| R01 (Data Precision) — Partial | "Found **2 statistics** with sources in 2,400 words (target: >= 5). 3 paragraphs make claims without supporting data. Add specific numbers with attribution." |

#### From geo-content-optimizer:

| GEO Factor | Deterministic Suggestion |
|------------|-------------------------|
| Low quotable statements | "Paragraph at **[CSS selector]** (47 words) makes a claim with no data: **'[exact text]'**. Adding a statistic with source would increase citation likelihood ~35%." |
| Missing definitions | "Term **'[exact term]'** appears 8 times but is never defined. Add a definition using: '[Term] is [category] that [function].' (25-50 words)" |
| Missing FAQ schema | "Found **5 Q&A-style headings** but no FAQPage JSON-LD. Adding schema for existing Q&A content = **3.2x more likely** to appear in AI Overviews." |
| Weak opening | "First 50 words don't contain an answer indicator. Current opening: **'[exact first sentence]'**. Start with a direct answer to the page's main question." |

### The Universal Fix Pattern

```
1. DETECT — the issue with a deterministic rule
2. QUOTE  — the exact text/element found on the page
3. MEASURE — the threshold violated with the actual value
4. DESCRIBE — the structural fix (not the content)
5. CITE — the impact data ("2.5x more citations", "~35% visibility increase")
6. NEVER — generate replacement text
```

---

## Part 6: Scoring Architecture

### Combined Score: SEO Score + GEO Score + Overall

```
SEO Score (0-100):
  ├─ Title Tag:           15 pts  (A1 checks)
  ├─ Meta Description:    10 pts  (A2 checks)
  ├─ Heading Structure:   12 pts  (A3 checks)
  ├─ Content Quality:     15 pts  (A4 checks)
  ├─ Links:               10 pts  (A5 checks)
  ├─ Images:               8 pts  (A6 checks)
  ├─ Technical On-Page:   10 pts  (A7 checks)
  ├─ Social/OG:            5 pts  (A8 checks)
  ├─ Performance/UX:       5 pts  (A9 checks)
  └─ Schema/Structured:   10 pts  (from A7 + D)

GEO Score (0-100):
  ├─ Answer Architecture: 25 pts  (B1 checks)
  ├─ Citation Worthiness:  25 pts  (B2 checks)
  ├─ Machine Readability: 20 pts  (B3 checks)
  ├─ Content Precision:   15 pts  (B4 checks)
  └─ Multi-Engine:        15 pts  (B5 checks)

Overall = (SEO Score × 0.5) + (GEO Score × 0.5)
```

### CORE-EEAT Integration (Optional Deep Mode)

For users who want the full audit, map the 52 detectable CORE-EEAT items:

```
CORE Score (Content Body — GEO focused):
  ├─ C — Contextual Clarity:  9 items  → /100
  ├─ O — Organization:       10 items  → /100
  ├─ R — Referenceability:    9 items  → /100
  └─ E — Exclusivity:         7 items  → /100

EEAT Score (Source Credibility — SEO focused):
  ├─ Exp — Experience:  7 items  → /100
  ├─ Ept — Expertise:   5 items  → /100
  ├─ A — Authority:     2 items  → /100 (limited without external data)
  └─ T — Trust:         3 items  → /100 (limited without external data)
```

---

## Part 7: Priority Detection — What Matters Most

### Top 20 Highest-Impact Checks (sorted by combined SEO + GEO value)

| Rank | Check | SEO Impact | GEO Impact | Category |
|------|-------|-----------|-----------|----------|
| 1 | H1-H2-H3 hierarchy exists and is valid | High | 2.8x citation increase | Structure |
| 2 | Direct answer in first 150 words | Medium | Critical for all AI engines | GEO |
| 3 | JSON-LD schema present (Article, FAQ, etc.) | High | 3.2x AI Overview appearance | Technical + GEO |
| 4 | Statistics with source attribution | Low | ~35% visibility increase | GEO |
| 5 | Title tag: exists, 30-60 chars, has keyword | Very High | Medium | SEO |
| 6 | FAQ section with schema | Medium | 3.2x AI Overview appearance | GEO |
| 7 | Comparison tables present | Low | 2.5x citation rate | GEO |
| 8 | Meta description: exists, 150-160 chars | High | Low | SEO |
| 9 | Author attribution (byline + schema) | Medium | High across all engines | Both |
| 10 | Publication/update date visible | Medium | Very High (Perplexity) | Both |
| 11 | Internal links >= 3 | High | Medium | SEO |
| 12 | Content freshness (< 30 days) | Low | 76.4% of ChatGPT top citations | GEO |
| 13 | Word count > 2000 | Medium | 3x more citations | Both |
| 14 | Expert quotes / blockquotes | Low | ~40% visibility (quotation addition) | GEO |
| 15 | No keyword stuffing (density < 3%) | High | -10% visibility if stuffed | Both |
| 16 | Canonical tag correct | Very High | Low | SEO |
| 17 | Image alt text present | High | Low | SEO |
| 18 | CLS < 0.1 | High | Low | Performance |
| 19 | LCP < 2.5s | High | Low | Performance |
| 20 | Neutral tone (not promotional) | Medium | High for all AI engines | GEO |

---

## Part 8: What the Extension Should NOT Do

Based on our research + skill analysis:

1. **Never generate replacement content** — Skills do this because they're LLMs; the extension must describe structural fixes only
2. **Never require an API key for core functionality** — All core detection is DOM-based
3. **Never send page content to external servers for scoring** — All scoring is rule-based
4. **Never guess keyword intent** — Can classify based on page content patterns, but don't claim search volume
5. **Never claim Authority/Trust scores without disclaimers** — 28/80 CORE-EEAT items need external data
6. **Never block on network requests** — Core audit must complete in < 500ms from DOM
7. **Never show scores without showing the evidence** — Every score must link to the specific DOM element

---

## Part 9: Data Flow Architecture

```
Page Load
  │
  ├─► Content Script (Tier 1: Instant)
  │     ├─ DOM Analysis: titles, metas, headings, links, images, schema
  │     ├─ Text Analysis: word count, readability, filler detection
  │     ├─ GEO Scoring: answer architecture, citation worthiness, precision
  │     ├─ CORE-EEAT Quick Scan: 52 detectable items
  │     └─ Result: SEO Score + GEO Score + Issue List
  │
  ├─► Performance Observer (Tier 2: After Load)
  │     ├─ CWV: LCP, CLS, INP
  │     ├─ TTFB, FCP
  │     └─ Resource timing analysis
  │
  └─► Optional Backend (Tier 3: On Demand)
        ├─ Keyword metrics enrichment
        ├─ Competitor comparison
        ├─ AI citation tracking
        └─ Full CORE-EEAT scoring with external data
```

---

## Appendix: Threshold Quick Reference

| Element | Min | Optimal | Max |
|---------|-----|---------|-----|
| Title (chars) | 30 | 50-60 | 60 |
| Title (pixels) | — | — | 580px |
| Meta description (chars) | 70 | 150-160 | 160 |
| Meta description (pixels) | — | — | 920px |
| H1 count | 1 | 1 | 1 |
| H1 length (chars) | 10 | 20-70 | 70 |
| Image alt (chars) | 1 | 10-125 | 125 |
| URL length (chars) | — | — | 75-100 |
| Word count (min for GEO) | 300 | 800-2000+ | — |
| Flesch Reading Ease | 30 | 60-70 | 100 |
| Internal links | 3 | 5-10 | 150 |
| External links | 1 | 2-5 | — |
| CLS | — | < 0.1 | 0.25 |
| LCP | — | < 2.5s | 4.0s |
| INP | — | < 200ms | 500ms |
| TTFB | — | < 800ms | — |
| Tap target (px) | 48x48 | 48x48 | — |
| Font size (px) | 12 | 16 | — |
| Keyword density | — | 1-2% | 3% (harmful above) |
| Filler phrases per 1000w | — | 0 | 2 |
| Promotional terms per 1000w | — | 0 | 3 |
| Stats with sources per 2000w | 5 | 8-10 | — |
| Citations per 500w | 1 | 2-3 | — |
| FAQ Q&A pairs | 3 | 5-7 | — |
| OG image (pixels) | 1200x630 | 1200x630 | 8MB |
| Twitter image (pixels) | 300x157 | 1200x628 | 4096x4096 |

---

## Research Sources

**Academic**:
- GEO Paper: Aggarwal et al., Princeton/IIT Delhi (arxiv.org/abs/2311.09735), ACM KDD 2024
- E-GEO: arxiv.org/abs/2511.20867
- GEO Domination: arxiv.org/abs/2509.08919

**Skills Library**:
- aaron-he-zhu/seo-geo-claude-skills (20 skills)
- CORE-EEAT Content Benchmark (github.com/aaron-he-zhu/core-eeat-content-benchmark)

**Industry Standards**:
- Core Web Vitals: web.dev/articles/defining-core-web-vitals-thresholds
- Open Graph Protocol: ogp.me
- Schema.org: schema.org
- Screaming Frog SEO Spider: screamingfrog.co.uk/seo-spider/
