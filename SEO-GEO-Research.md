# SEO & GEO Detection Without Hallucination — Research Analysis

## The Core Problem in the Current System

The **detection and marking is excellent** — `scorer-client.js` and `inline-analyzer.js` run 100% client-side, rule-based, deterministic. They find real elements, check real thresholds, and point at real DOM nodes. No hallucination possible.

The problem lives in two backend files:

1. **`rewrite_engine.py`** — Sends page data to Gemini and asks it to generate replacement text. The LLM invents new titles, new paragraphs, new headings. These are hallucinated content that doesn't exist on the page.

2. **`geo_scorer.py`** — Sends content to Gemini for GEO scoring. The LLM returns "findings" and "issues" that may reference things inaccurately or vaguely.

Both feed back into `inline-analyzer.js:_mergeBackendSuggestions()` which attaches AI-generated text to real DOM elements — mixing truth (the element exists) with fiction (the suggested replacement).

---

## What Professional Tools Actually Do (No LLM Needed)

Every check below is **deterministic** — based on what's literally in the DOM.

### SEO Checks Already Implemented (Solid)

- Title: exists, length 40-60 chars, not generic, has modifier
- Meta description: exists, length 120-160, has CTA, not duplicate of title
- Headings: single H1, valid hierarchy, H2 count 2-8, descriptive labels
- Content: word count, readability grade, paragraph/sentence length
- Technical: canonical, viewport, OG tags, schema, robots, lang, charset
- Links: internal count >= 3, descriptive anchors, external links present
- UX: CTAs, lists, tables, no walls of text

### SEO Checks Missing (All Rule-Based, No LLM)

| Check | How to Detect | Threshold |
|-------|--------------|-----------|
| Title pixel width | Measure with canvas `measureText()` | Max ~580px desktop |
| Multiple `<title>` tags | `document.querySelectorAll('title').length` | Error if > 1 |
| Multiple meta descriptions | Count meta description tags | Error if > 1 |
| Image missing `width`/`height` | Check attributes on `<img>` | Causes CLS |
| Image missing `loading="lazy"` | Check attribute on offscreen images | Performance |
| Large images without preload | Check above-fold images for `<link rel="preload">` | LCP |
| Render-blocking scripts | `<script>` in `<head>` without `async`/`defer` | Performance |
| Missing `font-display: swap` | Check `@font-face` rules | CLS/LCP |
| Canonical self-referencing | Compare canonical href to `window.location` | Should match |
| Canonical protocol mismatch | HTTP vs HTTPS in canonical | Error |
| Twitter card meta missing | Check `twitter:card`, `twitter:image` | Warning |
| OG image dimensions | Check if `og:image` exists and image is >= 1200x630 | Warning |
| Tap target too small | `getBoundingClientRect()` on links/buttons | Min 48x48px |
| Font size too small | `getComputedStyle().fontSize` on body | Min 16px recommended |
| Missing `<meta name="robots">` awareness | Check for noindex on pages with internal links pointing to them | Error |
| Heading length | H1 too long (>70 chars) or too short (<10) | Warning |
| Alt text is filename | Regex `/\.(jpg\|png\|gif\|webp\|svg)/i` on alt text | Warning |
| Alt text too long | `alt.length > 125` | Screen reader cutoff |
| Orphan links (href="#" or empty) | `a[href=""], a[href="#"]` | Warning |
| URL has uppercase | `window.location.href !== window.location.href.toLowerCase()` | Info |

---

## GEO: What Can Be Scored Without an LLM

This is the key insight from the Princeton KDD 2024 paper. GEO factors are **content structure patterns**, not subjective quality — meaning they're detectable with regex and DOM inspection.

### Answer Architecture (25 pts) — All Rule-Based

| Check | Detection Method | Points |
|-------|-----------------|--------|
| Direct opening answer | First `<p>` has >= 20 words AND appears before first `<h2>` | 6 |
| FAQ-style Q&A pairs | Count headings matching question patterns (`/^(what\|how\|why\|when\|where\|who)\s/i` or ending in `?`) that are followed by a paragraph of 15-120 words | 5 |
| Term definitions present | Regex for "is defined as", "refers to", "known as", "also called", "is a type of" in paragraph text | 4 |
| Comparison tables | `<table>` elements with `<thead>` or `<th>` present. Bonus if page text contains "vs", "compared to", "difference between" | 5 |
| Self-contained H2 sections | Each `<h2>` is followed by >= 50 words of content before the next `<h2>` | 5 |

### Citation Worthiness (25 pts) — All Rule-Based

| Check | Detection Method | Points |
|-------|-----------------|--------|
| Statistics with sources | Count paragraphs containing a number pattern (`\d+%`, `$X million`) AND an attribution pattern ("according to", "source:", "(2024)") | 7 |
| Attributed claims | Regex for "according to [Name]", "[Name] et al", "researchers at [Org]", institution names (Harvard, WHO, CDC, etc.) | 5 |
| Expert quotes | Count `<blockquote>` elements, OR text in quotation marks followed by attribution ("said", "noted", "argues") | 4 |
| Publication date visible | Check for `datePublished`/`dateModified` in JSON-LD schema, `<time>` elements, meta `article:published_time`, OR visible date patterns in text | 5 |
| Author attribution | Check for `[itemprop="author"]`, `.author`, `.byline`, `.post-author`, `[rel="author"]`, `.entry-author`, meta `author`, or `author` in JSON-LD schema | 4 |

### Machine Readability (20 pts) — All Rule-Based

| Check | Detection Method | Points |
|-------|-----------------|--------|
| JSON-LD schema present | `document.querySelectorAll('script[type="application/ld+json"]').length > 0` | 5 |
| Semantic HTML usage | Has `<main>` or `<article>`, proper heading hierarchy, uses `<ul>`/`<ol>`, uses `<table>` | 4 |
| Text not in images | Ratio: `textContent.length / document.querySelectorAll('img').length`. Flag if huge image count with low text | 3 |
| Content in initial HTML | Word count >= 100 on `document_idle` (if smart extractor needs Strategy 2/3, content is JS-dependent) | 4 |
| AI crawlers not blocked | Check robots meta for `noai`, `noimageai`, check if `data-nosnippet` is overused | 2 |
| llms.txt reference | Check for `<link>` pointing to `/llms.txt` or presence of `/.well-known/llms.txt` pattern | 2 |

### Content Precision (15 pts) — All Rule-Based

| Check | Detection Method | Points |
|-------|-----------------|--------|
| Specific entities/numbers | Count proper nouns (consecutive capitalized words), years, dollar amounts, percentages per 500 words. Threshold: >= 3 per 500 words | 5 |
| Verifiable claims per paragraph | For paragraphs > 30 words, check if at least one sentence contains a number, date, named entity, or citation pattern | 5 |
| No filler content | Regex for filler: "in today's world", "it is important to note", "without further ado", "let's dive in", "as we all know", "at the end of the day", "stay tuned", "buckle up". Threshold: <= 2 per 1000 words | 5 |

### Multi-Engine (15 pts) — All Rule-Based

| Check | Detection Method | Points |
|-------|-----------------|--------|
| Neutral tone (not promotional) | Count promotional superlatives: "best", "#1", "revolutionary", "game-changing", "unbeatable", "buy now", "!!!". Threshold: <= 3 per 1000 words | 5 |
| Experience-based markers | Regex for first-person experience: "in our experience", "we tested", "when I tried", "based on our testing", "real-world example" | 5 |
| Opening answers main question | First 50 words contain an answer indicator: "is a", "refers to", "means", "you can", "you should", "the answer", "yes,", "no," | 5 |

---

## The Fix Suggestion Problem

### Current Approach (Hallucination-Prone)

> LLM generates: *"Change your H2 from 'Benefits' to 'What Are the Key Benefits of Cloud Computing in 2026?'"*

The LLM invented that heading. It might not match the page's topic, tone, or context.

### What Professional Tools Do Instead

They describe the problem and reference what's actually there:

| Instead of generating text... | Show this (rule-based) |
|------|------|
| "Rewrite your title to..." | "Your title is 73 chars: **'Your Actual Title Here...'** — exceeds the 60-char recommended max. Consider removing filler words or moving brand name to end." |
| "Add this FAQ section..." | "Found 3 question-pattern headings (H2: 'How does X work?', H3: 'What is Y?'...) but no FAQPage schema. Adding FAQ structured data would make these 3.2x more likely to appear in AI Overviews." |
| "Replace paragraph with..." | "Paragraph at **[selector]** has 287 words and Flesch score 23 (very hard). Contains 8 sentences averaging 35 words each. Break into 2-3 shorter paragraphs and split sentences longer than 20 words." |
| "Add statistics here..." | "This paragraph (47 words) makes a claim but has no supporting data: **'[exact paragraph text]'**. Adding a specific number or source would increase citation likelihood by ~35% (Princeton GEO research)." |

### The Pattern

1. **Detect** the issue with a deterministic rule
2. **Quote** the exact text/element found on the page
3. **State** the threshold violated with the actual value
4. **Describe** the structural fix (not the content) — "shorten", "split", "add schema for existing content", "rephrase as question"
5. **Never generate** replacement text

---

## Key Research Numbers (Threshold Calibration)

From the Princeton GEO paper and industry standards:

### GEO Impact Factors

| Strategy | Visibility Improvement | Best Domains |
|----------|----------------------|--------------|
| Quotation Addition | ~40% | People & Society, Explanation, History |
| Statistics Addition | ~35% | Law & Government, Debate, Opinion |
| Cite Sources | ~30% | Statements, Facts, Law & Government |
| Fluency Optimization | ~25% | Business, Science, Health |
| Authoritative Tone | ~13% | Debate, History, Science |
| Easy-to-Understand | ~13% | General improvement across domains |
| Technical Terms | ~9% | Specialized domains |
| Unique Words | ~6% | Marginal improvement |
| **Keyword Stuffing** | **-10%** | **Harmful across all domains** |

### AI Citation Statistics

- Pages with H1-H2-H3 hierarchy are **2.8x more likely** to be cited by AI
- Content with tables gets cited **2.5x more** than plain text
- FAQ schema pages are **3.2x more likely** to appear in AI Overviews
- **76.4% of ChatGPT's most-cited pages** were updated within 30 days
- Long-form content (>2000 words) earns **3x more citations**
- Quantitative claims get **40% higher citation rates**
- Mention on **4+ platforms** makes brand **2.8x more likely** to appear in ChatGPT

### Standard SEO Thresholds

| Element | Min | Optimal | Max |
|---------|-----|---------|-----|
| Title tag (chars) | 30 | 50-60 | 60 |
| Title tag (pixels) | - | - | 580px |
| Meta description (chars) | 70 | 150-160 | 160 |
| Meta description (pixels) | - | - | 920px |
| H1 count | 1 | 1 | 1 |
| H1 length (chars) | 10 | 20-70 | 70 |
| Image alt text (chars) | 1 | 10-125 | 125 |
| URL length (chars) | - | - | 75-100 |
| Word count (thin content) | 300 | 800-2000+ | - |
| Flesch Reading Ease | 30 | 60-70 | 100 |
| OG title (chars) | - | - | 60 |
| OG description (chars) | - | - | 65-200 |
| OG image (pixels) | 1200x630 | 1200x630 | 8MB max |
| Twitter image (pixels) | 300x157 | 1200x628 | 4096x4096 |
| Tap target (CSS px) | 48x48 | 48x48 | - |
| Font size (px) | 12 | 16 | - |
| Links per page | - | - | 100-150 |
| CLS | - | < 0.1 | 0.25 |
| LCP | - | < 2.5s | 4.0s |
| INP | - | < 200ms | 500ms |

---

## Research Sources

- **Primary GEO Paper**: "GEO: Generative Engine Optimization" — Aggarwal et al., Princeton/IIT Delhi (arxiv.org/abs/2311.09735), ACM KDD 2024
- **E-GEO**: "A Testbed for Generative Engine Optimization in E-Commerce" (arxiv.org/abs/2511.20867)
- **GEO Domination Guide**: arxiv.org/abs/2509.08919
- **Screaming Frog SEO Spider**: screamingfrog.co.uk/seo-spider/
- **Core Web Vitals Thresholds**: web.dev/articles/defining-core-web-vitals-thresholds
- **The Open Graph Protocol**: ogp.me
- **Twitter Card Specs**: developer.x.com/en/docs/x-for-websites/cards
- **First Page Sage GEO Best Practices**: firstpagesage.com/seo-blog/generative-engine-optimization-best-practices/
- **Discovered Labs GEO Content Strategy**: discoveredlabs.com/blog/geo-content-strategy-how-to-write-for-ai-search-and-citations
- **INSIDEA FAQ Schema for GEO**: insidea.com/blog/seo/geo/faq-schema-and-structured-data-for-geo/
- **Meta Title Pixel Width**: contentdecoded.com/meta-title-length/
- **Screaming Frog Pixel Width Guide**: screamingfrog.co.uk/blog/page-title-meta-description-lengths-by-pixel-width/

---

## Bottom Line

The detection/marking system is the right architecture. The only things that need to change:

1. **GEO scoring should move client-side** — every GEO factor is structurally detectable without an LLM
2. **Fix suggestions should describe the problem and quote actual content** — never generate replacement text
3. **The backend LLM becomes optional** — useful for brand voice analysis or deep content review, but not needed for core detection

Everything stays deterministic, fast, and impossible to hallucinate.
