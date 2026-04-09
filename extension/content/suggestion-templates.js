// ═══════════════════════════════════════════════════════════════
// GEO SUGGESTION TEMPLATES
// Maps GEO issue codes to deterministic suggestion functions.
// Every suggestion quotes real content, states thresholds,
// and describes structural fixes with research citations.
// ═══════════════════════════════════════════════════════════════

var GEO_SUGGESTION_TEMPLATES = {

  // ─── ANSWER ARCHITECTURE ──────────────────────────────────

  no_direct_opening: function(issue, ctx) {
    var words = ctx.wordCount || 0;
    var excerpt = ctx.quote || "";
    var topic = ctx.primaryKeyword || ctx.h1Text.split(/\s+/).slice(0, 4).join(" ") || ctx.pageTitle.split(/\s+/).slice(0, 4).join(" ") || "your topic";
    var problem = words === 0
      ? "No opening paragraph detected before the first subheading."
      : "Opening paragraph is only " + words + " word" + (words !== 1 ? "s" : "") + (excerpt ? ": \u201C" + excerpt + "\u201D" : "") + ".";
    return {
      fix_type: "structural",
      quote: excerpt || null,
      message: problem + " Google AIO and ChatGPT extract the first paragraph as the primary answer snippet \u2014 it must be a standalone, direct answer to the page\u2019s core question before any subheading.",
      fix: "Open with 20\u201350 words that directly answer the question. Example: \u201C" + topic.charAt(0).toUpperCase() + topic.slice(1) + " is [definition]. It works by [mechanism], which means [outcome for reader].\u201D Place this before any H2.",
      impact: 7,
      research_cite: "Princeton GEO 2024 \u2014 direct opening increases AI citation rate by 41%"
    };
  },

  no_faq_section: function(issue, ctx) {
    var topic = ctx.primaryKeyword || ctx.h1Text.split(/\s+/).slice(0, 3).join(" ") || "this topic";
    return {
      fix_type: "missing",
      quote: null,
      message: "No FAQ section detected (0 question-pattern headings, no FAQPage schema). Pages with 3+ question-format headings are 3.2\u00D7 more likely to appear in Google AI Overviews.",
      fix: "Add an FAQ section with 4\u20136 question headings. Examples for this page: \u201CWhat is " + topic + "?\u201D, \u201CHow does " + topic + " work?\u201D, \u201CWhy does " + topic + " matter?\u201D Add FAQPage JSON-LD schema to each Q&A pair for maximum AI visibility.",
      impact: 6,
      research_cite: "Zyppy AI Overview Study 2024"
    };
  },

  no_definitions: function(issue, ctx) {
    var topic = ctx.primaryKeyword || ctx.h1Text || ctx.pageTitle || "the primary topic";
    return {
      fix_type: "missing",
      quote: null,
      message: "No term definitions found. AI engines like Perplexity and Claude extract definitional patterns ('X is defined as\u2026', 'X refers to\u2026') to build knowledge cards and inline citations.",
      fix: "Add a definition near the top of the page: \u201C" + topic + " is defined as [concise explanation in 1\u20132 sentences].\u201D Use 'refers to', 'known as', or 'is a type of' for secondary terms throughout.",
      impact: 4,
      research_cite: "CORE-EEAT Item C04 \u2014 Definitional clarity"
    };
  },

  no_comparison_table: function(issue, ctx) {
    var quote = ctx.quote || null;
    return {
      fix_type: "structural",
      quote: quote,
      message: "Content has comparison language (\u2018vs\u2019, \u2018compared to\u2019, \u2018difference between\u2019) but no comparison table. Structured tables receive 2.5\u00D7 more AI citations than inline prose comparisons.",
      fix: "Convert the comparison text into a <table> with a <thead> row (Feature | Option A | Option B). AI engines extract table cells directly into answer cards.",
      impact: 5,
      research_cite: "HubSpot Content Study 2024 \u2014 tables get 2.5\u00D7 AI citation rate"
    };
  },

  no_tables: function(issue, ctx) {
    return {
      fix_type: "optimization",
      quote: null,
      message: "No data tables found. Structured <table> elements with column headers signal machine-readable, citable data to all major AI engines and improve scannability.",
      fix: "Add at least one comparison or summary table with <thead> and labeled columns. Even a 2-column table (Feature | Value) dramatically improves machine readability.",
      impact: 3,
      research_cite: "CORE-EEAT Item O03 \u2014 Data Tables"
    };
  },

  thin_sections: function(issue, ctx) {
    var avg = ctx.avgWords || 0;
    return {
      fix_type: "threshold",
      quote: null,
      message: "H2 sections average " + Math.round(avg) + " words \u2014 below the 50-word minimum for standalone AI answers. AI engines skip thin sections when extracting topic-specific responses.",
      fix: "Expand each H2 section to at least 50 words. Add 1\u20132 supporting paragraphs, a concrete example, or a relevant statistic with source citation.",
      impact: 5,
      research_cite: "CORE-EEAT Item O06 \u2014 Section Chunking"
    };
  },

  no_h2_sections: function(issue, ctx) {
    return {
      fix_type: "structural",
      quote: null,
      message: "No H2 headings found. AI engines parse heading-delimited blocks to extract topic-specific answers. A flat wall of text without structure is nearly impossible to cite.",
      fix: "Break content into 3\u20138 H2 sections, each representing a distinct subtopic or question. Use specific, descriptive labels \u2014 not 'Section 1' or 'Overview'.",
      impact: 5,
      research_cite: "CORE-EEAT Item O01 \u2014 Heading Hierarchy"
    };
  },

  // ─── CITATION WORTHINESS ──────────────────────────────────

  stats_without_sources: function(issue, ctx) {
    var quote = ctx.quote || "";
    var domain = ctx.domain ? ctx.domain.replace(/^www\./, "") : "";
    var domainHint = domain ? " for " + domain : "";
    return {
      fix_type: "threshold",
      quote: quote || null,
      message: quote
        ? "Paragraph makes claims without supporting data: \u201C" + quote + "\u2026\u201D Adding a sourced statistic here increases citation likelihood by ~35%."
        : "No statistics with source attribution found. Cited statistics are the single highest-impact GEO signal \u2014 e.g. '67% of users, according to HubSpot 2024'.",
      fix: "Add at least one statistic per 200 words" + domainHint + ": '[X]%, according to [Source Name] ([Year])'. Target .gov, .edu, or established research publications for highest AI trust signal.",
      impact: 7,
      research_cite: "Princeton GEO 2024 \u2014 sourced statistics increase AI citation by 35%"
    };
  },

  no_attribution: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No attributed claims found ('according to [Name]', '[Name] et al'). Perplexity and Claude specifically prioritize content with named-source attribution for answer generation.",
      fix: "Add 2\u20133 attributed claims: 'According to [Name/Org],' or '[Source] found that\u2026' Prefer authoritative institutions (Harvard, WHO, CDC, named industry experts).",
      impact: 5,
      research_cite: "CORE-EEAT Item R03 \u2014 Source Hierarchy"
    };
  },

  no_expert_quotes: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No expert quotes or blockquotes detected. Quoted expert opinion signals credibility \u2014 ChatGPT specifically prefers pages with attributed expert statements over bare claims.",
      fix: "Add 1\u20132 expert quotes using <blockquote> with attribution: \u201C[Quote],\u201D said [Name], [Title] at [Org]. Match the quote topic to the page\u2019s primary subject.",
      impact: 4,
      research_cite: "CORE-EEAT Item Ept05 \u2014 Expert attribution"
    };
  },

  no_publication_date: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No publication date detected. 76.4% of ChatGPT\u2019s top-cited pages were updated within 30 days. Undated content is deprioritized by freshness-sensitive AI engines.",
      fix: "Add a visible date using <time datetime='YYYY-MM-DD'>Month DD, YYYY</time>. Also add datePublished and dateModified to your Article JSON-LD schema.",
      impact: 6,
      research_cite: "Zyppy Citation Frequency Study 2024"
    };
  },

  no_author: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No author attribution found (no schema author, no .byline, no meta author). All major AI engines use author attribution as a trust and credibility signal.",
      fix: "Add: (1) a visible by-line element with the author name, (2) meta name='author', and (3) an 'author' object in your Article JSON-LD with name and relevant credentials.",
      impact: 5,
      research_cite: "Google E-E-A-T Guidelines \u2014 Expertise Item Ept01"
    };
  },

  // ─── MACHINE READABILITY ──────────────────────────────────

  no_json_ld: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No JSON-LD structured data found. Schema.org markup is the primary signal Google AIO uses to understand page type, author, and content. Pages without it score lower for machine readability.",
      fix: "Add at minimum an Article or BlogPosting schema with: name, author, datePublished, dateModified, description. For FAQ pages, add FAQPage schema. Use <script type='application/ld+json'>.",
      impact: 7,
      research_cite: "CORE-EEAT Item O05 \u2014 Schema Markup"
    };
  },

  low_semantic_html: function(issue, ctx) {
    var score = ctx.semanticScore || 0;
    return {
      fix_type: "structural",
      quote: null,
      message: "Semantic HTML score: " + score + "/4. AI crawlers use HTML element roles to parse content structure. Low semantic score means limited machine-readable structure.",
      fix: "Add missing semantic elements: wrap content in <article>, use <ul>/<ol> for lists of 3+ items, add heading hierarchy (H1\u2192H2\u2192H3), structure data in <table> elements.",
      impact: 3,
      research_cite: "CORE-EEAT Item R09 \u2014 HTML Semantics"
    };
  },

  thin_html_content: function(issue, ctx) {
    var wc = ctx.wordCount || 0;
    return {
      fix_type: "threshold",
      quote: null,
      message: "Only " + wc + " words in initial HTML. AI crawlers need \u2265300 words in the initial HTML for reliable extraction. Content below this threshold is often skipped entirely.",
      fix: "Ensure at least 300 words of text are in the server-rendered HTML (not loaded via JavaScript). If JS-rendered, consider SSR, static generation, or prerendering.",
      impact: 5,
      research_cite: "Google AIO \u2014 Content in initial HTML requirement"
    };
  },

  ai_crawlers_blocked: function(issue, ctx) {
    return {
      fix_type: "critical",
      quote: null,
      message: "AI crawlers are blocked. A noai/noimageai directive or data-nosnippet is preventing AI engines from reading and citing this page. It will not appear in any AI-generated responses.",
      fix: "Remove 'noai' and 'noimageai' from the robots meta tag. Remove data-nosnippet attributes. Check robots.txt for GPTBot, ClaudeBot, or PerplexityBot blocks.",
      impact: 9,
      research_cite: "All AI engines \u2014 crawler permission is required for citation"
    };
  },

  no_llms_txt: function(issue, ctx) {
    return {
      fix_type: "optimization",
      quote: null,
      message: "No llms.txt file referenced. An llms.txt at /.well-known/llms.txt tells AI systems which pages are authoritative, what the site covers, and what content can be cited.",
      fix: "Create /llms.txt following the llms.txt spec. Add <link rel='llms.txt' href='/llms.txt'> in your <head> for AI system discovery.",
      impact: 2,
      research_cite: "llms.txt spec \u2014 Claude & ChatGPT content discovery"
    };
  },

  // ─── CONTENT PRECISION ────────────────────────────────────

  low_entity_density: function(issue, ctx) {
    var density = Math.round((ctx.entitiesPer500 || 0) * 10) / 10;
    return {
      fix_type: "threshold",
      quote: null,
      message: "Entity density is " + density + " specific entities per 500 words. Low entity density reads as generic prose \u2014 AI engines prefer specific, verifiable facts over vague generalities.",
      fix: "Add proper nouns (companies, tools, people), specific years, dollar amounts, percentages, and measurements throughout. Target 8+ specific entities per 500 words.",
      impact: 5,
      research_cite: "CORE-EEAT Item R07 \u2014 Entity Precision"
    };
  },

  low_verifiable_claims: function(issue, ctx) {
    var pct = Math.round((ctx.verifiablePct || 0) * 100);
    return {
      fix_type: "threshold",
      quote: null,
      message: "Only " + pct + "% of substantive paragraphs contain verifiable data. Target \u226560%. Unverifiable prose is what AI engines are least likely to cite as a source.",
      fix: "Go through each paragraph and add one verifiable element: a percentage, a year, a specific number, or a citation ('according to [source]'). Prioritize your key claim paragraphs.",
      impact: 5,
      research_cite: "CORE-EEAT Item R04 \u2014 Evidence-Claim Mapping"
    };
  },

  filler_detected: function(issue, ctx) {
    var fillers = ctx.foundFillers || [];
    var count = ctx.fillerCount || 0;
    return {
      fix_type: "threshold",
      quote: fillers.length > 0 ? fillers.slice(0, 3).join("', '") : null,
      message: "Found " + count + " filler phrase" + (count !== 1 ? "s" : "") + (fillers.length > 0 ? ": '" + fillers.slice(0, 3).join("', '") + "'" : "") + ". Filler signals low information density to AI engines, reducing citation probability.",
      fix: "Delete filler and replace with specific information: instead of 'it is important to note that X', write 'X \u2014 because [specific reason with data]'. Target \u22641 filler per 1000 words.",
      impact: 5,
      research_cite: "CORE-EEAT Item O09 \u2014 Information Density"
    };
  },

  // ─── MULTI-ENGINE ─────────────────────────────────────────

  promotional_tone: function(issue, ctx) {
    var sups = ctx.foundSuperlatives || [];
    return {
      fix_type: "threshold",
      quote: sups.length > 0 ? sups.slice(0, 3).join("', '") : null,
      message: "Promotional language detected" + (sups.length > 0 ? ": '" + sups.slice(0, 3).join("', '") + "'" : "") + ". AI engines are trained to identify and discount promotional bias \u2014 objective tone signals trustworthiness.",
      fix: "Replace superlatives with specific evidence: instead of 'best solution' write 'rated 4.8/5 by 2,400 users (Trustpilot 2024)'. Remove '!!!', 'revolutionary', 'game-changing', 'unbeatable'.",
      impact: 5,
      research_cite: "Google E-E-A-T \u2014 Trust dimension; neutral tone preference"
    };
  },

  no_experience_markers: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No first-hand experience markers found ('we tested', 'in our experience', 'when I tried'). Claude and Gemini specifically weight experience-based content higher for EEAT trust.",
      fix: "Add 1\u20132 concrete experience statements: 'We tested X for 30 days and found\u2026', 'In our experience with 200+ clients\u2026', 'When we tried X, the result was [specific outcome].'",
      impact: 4,
      research_cite: "Google E-E-A-T \u2014 Experience dimension (Exp01, Exp10)"
    };
  },

  no_opening_answer: function(issue, ctx) {
    return {
      fix_type: "structural",
      quote: null,
      message: "First 50 words don\u2019t contain a direct answer pattern ('is a', 'refers to', 'you can', 'you should'). Google AIO and ChatGPT score opening directness as a primary answer-snippet trigger.",
      fix: "Rewrite the first sentence as a direct definition or answer: '[Topic] is [definition].' or 'To [achieve goal], you [action].' The answer pattern must appear within the first 3 sentences.",
      impact: 5,
      research_cite: "Princeton GEO 2024 \u2014 opening answer pattern"
    };
  },

  // ─── HEADING ──────────────────────────────────────────────

  heading_generic: function(issue, ctx) {
    var text = ctx.quote || "";
    var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    var keyword = ctx.primaryKeyword || ctx.h1Text.split(/\s+/).slice(0, 4).join(" ") || ctx.pageTitle.split(/\s+/).slice(0, 4).join(" ") || "your topic";
    return {
      fix_type: "structural",
      quote: text || null,
      message: (text ? "Heading \u2018" + text + "\u2019 is generic (" + words + " word" + (words !== 1 ? "s" : "") + ")." : "Generic heading detected.") + " Generic labels don\u2019t match user search queries and fail to trigger AI question-answer matching.",
      fix: "Convert to a specific question: e.g. \u201CWhat Are the Top Benefits of " + keyword + "?\u201D or \u201CHow Does " + keyword + " Work?\u201D Question headings improve AI snippet eligibility by 2.8\u00D7.",
      impact: 6,
      research_cite: "Princeton GEO 2024 \u2014 question-pattern headings"
    };
  },

  heading_not_question: function(issue, ctx) {
    var text = ctx.quote || "";
    var suggestion = text
      ? "How " + text.charAt(0).toUpperCase() + text.slice(1) + "?"
      : "How Does " + (ctx.primaryKeyword || ctx.h1Text || "This") + " Work?";
    return {
      fix_type: "optimization",
      quote: text || null,
      message: (text ? "H2/H3 \u2018" + text + "\u2019 is" : "This heading is") + " a statement, not a question. Question-format headings match natural language search queries and are 2.8\u00D7 more likely to become AI answer snippets.",
      fix: "Rephrase as a question. Example: \u201C" + suggestion + "\u201D \u2014 prepend 'What is\u2026', 'How do I\u2026', 'Why does\u2026' and end with '?'. Keep the core keyword in the question.",
      impact: 3,
      research_cite: "Princeton GEO 2024"
    };
  },

  // ─── NEW: PER-PARAGRAPH ────────────────────────────────────

  paragraph_claim_without_data: function(issue, ctx) {
    var quote = ctx.quote || "";
    return {
      fix_type: "threshold",
      quote: quote || null,
      message: (quote ? "Paragraph \u201C" + quote + "\u2026\u201D makes" : "This paragraph makes") + " factual claims without supporting data. Unsubstantiated claims are the #1 reason AI engines skip a paragraph when generating answers.",
      fix: "Add a specific statistic, named study, or date-stamped figure: '[Claim], according to [Source] ([Year]).' Even a single cited number raises citation probability by ~35%.",
      impact: 6,
      research_cite: "Princeton GEO 2024 \u2014 R01/R04 Evidence-Claim Mapping"
    };
  },

  // ─── NEW: PAGE-LEVEL ──────────────────────────────────────

  no_tl_dr: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No TL;DR or Key Takeaways section detected. Summary boxes are extracted by Google AIO as 'quick answer' blocks and significantly improve dwell time and featured snippet eligibility.",
      fix: "Add a 'Key Takeaways' or 'TL;DR' H2 section near the top (after the intro). Use a <ul> list of 3\u20135 bullet points. Place before the first main H2 section.",
      impact: 5,
      research_cite: "CORE-EEAT Item O02 \u2014 Summary Box"
    };
  },

  no_conclusion: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No conclusion section detected. Semantic closure (a conclusion that callbacks to the intro topic) signals complete, authoritative content to AI engines.",
      fix: "Add a 'Conclusion' or 'Final Thoughts' H2 section that: restates the primary answer, summarizes 2\u20133 key points, and includes a clear next step or CTA.",
      impact: 3,
      research_cite: "CORE-EEAT Item C10 \u2014 Semantic Closure"
    };
  },

  no_internal_links: function(issue, ctx) {
    var count = ctx.count || 0;
    return {
      fix_type: "threshold",
      quote: null,
      message: "Only " + count + " internal link" + (count !== 1 ? "s" : "") + " found. Sparse internal linking reduces PageRank distribution and signals an isolated, low-authority page to crawlers.",
      fix: "Add 3\u20137 internal links to relevant related pages using descriptive anchor text that includes the target page\u2019s primary keyword. Avoid 'click here' or 'read more'.",
      impact: 6,
      research_cite: "CORE-EEAT Item R08 \u2014 Internal Link Graph"
    };
  },

  no_og_tags: function(issue, ctx) {
    var missing = ctx.missingTags || [];
    return {
      fix_type: "missing",
      quote: null,
      message: "Missing Open Graph tags: " + (missing.length > 0 ? missing.join(", ") : "og:title, og:description, og:image") + ". OG tags are used by AI systems indexing social content and affect CTR when AI responses link back.",
      fix: "Add to <head>: og:title, og:description (150\u2013300 chars), og:image (1200\u00D7630px), and og:type. These also control how your page appears when shared in AI chat interfaces.",
      impact: 4,
      research_cite: "Open Graph Protocol \u2014 social and AI metadata"
    };
  },

  // ─── PERFORMANCE ──────────────────────────────────────────

  no_lazy_loading_images: function(issue, ctx) {
    var count = (ctx && ctx.nonLazy) || 0;
    var total = (ctx && ctx.total) || 0;
    return {
      fix_type: "performance",
      quote: null,
      message: count + " of " + total + " images are missing loading=\"lazy\". Below-the-fold images block LCP by competing for bandwidth with the primary content.",
      fix: "Add loading=\"lazy\" to every <img> that is not in the initial viewport. The first 1\u20132 hero images should keep eager loading. Example: <img src=\"photo.jpg\" loading=\"lazy\" alt=\"...\">.",
      impact: 5,
      research_cite: "Core Web Vitals \u2014 LCP optimization"
    };
  },

  no_preload_critical_assets: function(issue, ctx) {
    return {
      fix_type: "performance",
      quote: null,
      message: "No <link rel=\"preload\"> hints found. Without preloading, the browser discovers critical resources (LCP image, fonts, CSS) late in the waterfall, increasing perceived load time.",
      fix: "Add to <head>: <link rel=\"preload\" href=\"/hero.webp\" as=\"image\"> for the LCP image, and <link rel=\"preload\" href=\"/font.woff2\" as=\"font\" crossorigin> for the primary display font.",
      impact: 4,
      research_cite: "Core Web Vitals \u2014 LCP & FCP optimization"
    };
  },

  long_dom_nodes: function(issue, ctx) {
    var count = (ctx && ctx.nodeCount) || 0;
    var threshold = (ctx && ctx.threshold) || 1500;
    return {
      fix_type: "performance",
      quote: null,
      message: "DOM has " + count + " nodes (threshold: " + threshold + "). Oversized DOMs slow browser rendering and make it harder for AI crawlers to parse the page structure.",
      fix: "Flatten deeply nested wrapper divs, remove hidden or off-screen elements, and paginate long lists. Virtualize long feeds (React Virtual, TanStack Virtual). Target < " + threshold + " total DOM nodes.",
      impact: 6,
      research_cite: "Google PageSpeed Insights \u2014 Avoid an excessive DOM size"
    };
  },

  too_many_requests: function(issue, ctx) {
    var count = (ctx && ctx.requestCount) || 0;
    var threshold = (ctx && ctx.threshold) || 100;
    return {
      fix_type: "performance",
      quote: null,
      message: count + " network requests detected (threshold: " + threshold + "). High request counts increase Time to Interactive and hurt mobile users on slower connections.",
      fix: "Bundle JS and CSS files. Defer non-critical analytics and chat widgets. Use a CDN for static assets. Lazy-load third-party scripts with async/defer. Target < " + threshold + " requests per page.",
      impact: 5,
      research_cite: "Core Web Vitals \u2014 Time to Interactive"
    };
  },

  // ─── ACCESSIBILITY ────────────────────────────────────────

  missing_aria_labels: function(issue, ctx) {
    var count = (ctx && ctx.unlabeledCount) || 0;
    return {
      fix_type: "accessibility",
      quote: null,
      message: count + " interactive element" + (count !== 1 ? "s" : "") + " have no accessible label. Screen readers announce these as unlabeled, and AI parsers use ARIA labels as semantic cues.",
      fix: "Add aria-label=\"[describe the action]\" to each element. Examples: aria-label=\"Close dialog\", aria-label=\"Subscribe to newsletter\", aria-label=\"Search\". Prefer descriptive over generic labels.",
      impact: 6,
      research_cite: "WCAG 2.1 Success Criterion 4.1.2 \u2014 Name, Role, Value"
    };
  },

  missing_form_labels: function(issue, ctx) {
    var count = (ctx && ctx.unlabeledCount) || 0;
    return {
      fix_type: "accessibility",
      quote: null,
      message: count + " form field" + (count !== 1 ? "s" : "") + " have no associated <label>. This breaks screen reader navigation and fails WCAG 2.1 AA compliance.",
      fix: "Add a visible label to each input: <label for=\"emailId\">Email address</label><input id=\"emailId\" type=\"email\">. Or add aria-label=\"Email address\" directly to the input element.",
      impact: 7,
      research_cite: "WCAG 2.1 Success Criterion 1.3.1 \u2014 Info and Relationships"
    };
  },

  video_without_captions: function(issue, ctx) {
    var count = (ctx && ctx.uncaptionedCount) || 0;
    return {
      fix_type: "accessibility",
      quote: null,
      message: count + " video element" + (count !== 1 ? "s" : "") + " have no captions. Required by WCAG 2.1 AA for prerecorded audio content. Also improves AI content extraction.",
      fix: "Add <track kind=\"captions\" src=\"captions.vtt\" srclang=\"en\" label=\"English\" default> inside each <video>. Generate .vtt files with YouTube auto-captions, Whisper AI, or rev.com.",
      impact: 6,
      research_cite: "WCAG 2.1 Success Criterion 1.2.2 \u2014 Captions (Prerecorded)"
    };
  },

  // ─── ADVANCED GEO ─────────────────────────────────────────

  no_examples: function(issue, ctx) {
    var topic = (ctx && (ctx.primaryKeyword || ctx.h1Text || ctx.pageTitle)) || "this topic";
    return {
      fix_type: "missing",
      quote: null,
      message: "No concrete examples found ('For example:', 'e.g.', 'such as'). Abstract claims without examples are 1.9\u00D7 less likely to be cited by AI engines than claims with real-world illustration.",
      fix: "Add at least 2 concrete examples in the content. Pattern: '[claim]. For example, [specific real-world case related to " + topic + "].' Examples that include numbers or named entities perform best.",
      impact: 4,
      research_cite: "Princeton GEO 2024 \u2014 concrete illustration increases AI citation"
    };
  },

  no_pros_cons: function(issue, ctx) {
    var topic = (ctx && (ctx.primaryKeyword || ctx.h1Text || ctx.pageTitle)) || "this subject";
    return {
      fix_type: "structural",
      quote: null,
      message: "Comparison language detected but no Pros/Cons section. Structured pros/cons match AI query patterns for 'should I use X', 'X advantages', and appear in AI comparison cards.",
      fix: "Add a dedicated H2 section: 'Pros and Cons of " + topic + "'. Use a <ul> list for each side. Keep each point to 1 sentence max for AI extraction. Optionally add a summary verdict.",
      impact: 4,
      research_cite: "GEO Research \u2014 structured comparison sections improve AI snippet eligibility"
    };
  },

  no_update_date: function(issue, ctx) {
    return {
      fix_type: "missing",
      quote: null,
      message: "No dateModified signal found in JSON-LD or visible text. 76.4% of ChatGPT top-cited pages were updated within 30 days. Undated content is deprioritized by freshness-sensitive AI engines.",
      fix: "Add dateModified to your Article JSON-LD: \"dateModified\": \"" + new Date().toISOString().split("T")[0] + "\". Also add a visible 'Last updated: [Date]' line near the top of the page using <time datetime='YYYY-MM-DD'>.",
      impact: 5,
      research_cite: "Zyppy Citation Frequency Study 2024 \u2014 freshness signals"
    };
  },

  multiple_canonical: function(issue, ctx) {
    return {
      fix_type: "critical",
      quote: null,
      message: "Multiple <link rel=\"canonical\"> tags found in <head>. Conflicting canonicals are a critical SEO error \u2014 Google ignores both and may choose an incorrect canonical, causing duplicate content issues.",
      fix: "Keep exactly one canonical tag pointing to the definitive URL. Remove all duplicates. If using a CMS, check theme templates and SEO plugins (Yoast, Rank Math) for double-injection.",
      impact: 9,
      research_cite: "Google Search Central \u2014 Consolidate duplicate URLs"
    };
  },

  excessive_external_links: function(issue, ctx) {
    var count = (ctx && ctx.count) || 0;
    return {
      fix_type: "threshold",
      quote: null,
      message: count + " external links detected. Excessive outbound links dilute PageRank flow and can trigger spam signals on thin or link-farm-style pages.",
      fix: "Review all external links and remove or nofollow low-value ones. Keep under 50 external links. Use rel=\"nofollow\" for affiliate, sponsored, or untrusted links.",
      impact: 5,
      research_cite: "Google Search Quality Guidelines \u2014 link quality signals"
    };
  }

};
