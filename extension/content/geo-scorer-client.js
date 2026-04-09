// ═══════════════════════════════════════════════════════════════
// CLIENT-SIDE GEO SCORER
// Implements all 5 GEO scoring dimensions using SCORING_CONFIG.geo
// Runs entirely in the content script (no network required)
// ═══════════════════════════════════════════════════════════════

class ClientGEOScorer {
  constructor() {
    this.config = SCORING_CONFIG.geo;
  }

  /**
   * Score a full page extraction for GEO readiness.
   * @param {Object} data — output of DOMExtractor.extract()
   * @param {Object} readability — output of ReadabilityScorer.analyze()
   * @returns {Object} { score, max_score, normalized_score, grade, categories, issues }
   */
  score(data, readability) {
    var categories = {
      answer_architecture: this._scoreAnswerArchitecture(data),
      citation_worthiness: this._scoreCitationWorthiness(data),
      machine_readability: this._scoreMachineReadability(data),
      content_precision: this._scoreContentPrecision(data),
      multi_engine: this._scoreMultiEngine(data, readability)
    };

    var totalScore = 0;
    var totalMax = 0;
    var allIssues = [];

    var keys = Object.keys(categories);
    for (var i = 0; i < keys.length; i++) {
      var cat = categories[keys[i]];
      totalScore += cat.score;
      totalMax += cat.max_score;
      allIssues = allIssues.concat(cat.issues);
    }

    allIssues.sort(function (a, b) {
      return b.impact - a.impact;
    });

    var normalizedScore =
      totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    // ─── PENALTY LAYER ───────────────────────────────────────────
    // Deduct points for critical missing signals. Awards-only scoring
    // lets broken pages look passable. Capped at -35 to prevent
    // unfair 0-scores when multiple penalties overlap.
    var GEO_PENALTIES = {
      ai_crawlers_blocked: 15,  // AI literally cannot read this page
      thin_html_content:    8,  // Not enough content for extraction
      no_json_ld:          10,  // Primary machine-readability signal absent
      no_citations:        10,  // Unsubstantiated — AI skips uncited content
      no_author:            8,  // E-E-A-T trust failure
      no_publication_date:  7,  // Freshness signal completely missing
      no_direct_opening:    5,  // Answer architecture failed at first paragraph
      stats_without_sources: 4  // Claims made with zero sourcing
    };

    var penaltyTotal = 0;
    for (var pi = 0; pi < allIssues.length; pi++) {
      var p = GEO_PENALTIES[allIssues[pi].code];
      if (p) penaltyTotal += p;
    }
    var penaltyCapped = Math.min(penaltyTotal, 35);
    var finalScore = Math.max(0, normalizedScore - penaltyCapped);

    return {
      score: totalScore,
      max_score: totalMax,
      normalized_score: finalScore,
      base_score: normalizedScore,
      penalty_applied: penaltyCapped,
      grade: Utils.getGrade(finalScore),
      categories: categories,
      issues: allIssues
    };
  }

  // ─── ANSWER ARCHITECTURE (25 pts) ──────────────────────────

  _scoreAnswerArchitecture(data) {
    var rules = this.config.answer_architecture.rules;
    var score = 0;
    var maxScore = this.config.answer_architecture.weight_total;
    var issues = [];
    var content = data.content || {};
    var headings = data.headings || {};
    var paragraphs = content.paragraphs || [];

    // 1. Direct opening answer (6 pts)
    // First paragraph should have ≥20 words and appear before first H2
    var firstPara = paragraphs.length > 0 ? paragraphs[0] : null;
    if (firstPara) {
      var firstParaWords = firstPara.word_count || this._countWords(firstPara.text || "");
      if (firstParaWords >= rules.direct_opening.min_words) {
        score += rules.direct_opening.weight;
      } else {
        var excerpt = this._truncate(firstPara.text || "", 60);
        issues.push(this._issue(
          "warning", 7, "answer_architecture",
          "First paragraph has " + firstParaWords + " words: '" + excerpt +
            "'. Opening should directly answer the core question in ≥" +
            rules.direct_opening.min_words + " words before any H2.",
          "no_direct_opening"
        ));
      }
    } else {
      issues.push(this._issue(
        "error", 8, "answer_architecture",
        "No opening paragraph found. Pages need a direct answer in the first paragraph for AI citation.",
        "no_direct_opening"
      ));
    }

    // 2. FAQ Q&A pairs (5 pts)
    // Question-pattern headings followed by 15-120 word paragraphs
    var allH2H3 = (headings.h2 || []).concat(headings.h3 || []);
    var questionPattern = rules.faq_pairs.question_pattern;
    var faqCount = 0;
    for (var qi = 0; qi < allH2H3.length; qi++) {
      var hText = (allH2H3[qi].text || "").trim();
      if (questionPattern.test(hText) || /\?$/.test(hText)) {
        faqCount++;
      }
    }
    var faqThresholds = rules.faq_pairs.thresholds;
    if (faqCount >= 3) {
      score += faqThresholds[4];
    } else if (faqCount === 2) {
      score += faqThresholds[3];
    } else if (faqCount === 1) {
      score += faqThresholds[2];
    } else {
      issues.push(this._issue(
        "warning", 6, "answer_architecture",
        "Found 0 question-pattern headings. FAQ pages are 3.2x more likely to appear in AI Overviews.",
        "no_faq_section"
      ));
    }

    // 3. Term definitions (4 pts)
    var fullText = (content.full_text || "").toLowerCase();
    var defPatterns = rules.term_definitions.patterns;
    var defCount = 0;
    for (var di = 0; di < defPatterns.length; di++) {
      if (defPatterns[di].test(fullText)) defCount++;
    }
    var defThresholds = rules.term_definitions.thresholds;
    if (defCount >= 3) {
      score += defThresholds[4];
    } else if (defCount === 2) {
      score += defThresholds[3];
    } else if (defCount === 1) {
      score += defThresholds[2];
    } else {
      issues.push(this._issue(
        "info", 4, "answer_architecture",
        "No term definitions found ('is defined as', 'refers to', 'known as'). Definitions help AI systems extract key concepts.",
        "no_definitions"
      ));
    }

    // 4. Comparison tables (5 pts)
    var tables = content.tables || [];
    if (tables.length > 0) {
      // Check if any table has headers (thead/th)
      var hasHeaderTable = false;
      for (var ti = 0; ti < tables.length; ti++) {
        if (tables[ti].has_header || tables[ti].has_thead) {
          hasHeaderTable = true;
          break;
        }
      }
      score += hasHeaderTable ? rules.comparison_tables.full_table_pts : rules.comparison_tables.basic_table_pts;
    } else {
      var hasComparison = /\b(vs\.?|versus|compared? to|difference between|comparison)\b/i.test(content.full_text || "");
      if (hasComparison) {
        issues.push(this._issue(
          "warning", 5, "answer_architecture",
          "Content has comparison language ('vs', 'compared to') but 0 tables. Tables get 2.5x more AI citations.",
          "no_comparison_table"
        ));
      } else {
        issues.push(this._issue(
          "info", 3, "answer_architecture",
          "No data tables found. Structured tables improve AI extraction and citation.",
          "no_tables"
        ));
      }
    }

    // 5. Self-contained H2 sections (5 pts)
    var h2s = headings.h2 || [];
    if (h2s.length > 0) {
      // Check word count between H2 headings by looking at paragraph selectors
      // Simplified: count paragraphs associated with sections
      var wellFormedSections = 0;
      var totalSections = h2s.length;

      // Approximate: check that total content is substantial enough
      var avgWordsPerSection = totalSections > 0 ? (content.word_count || 0) / totalSections : 0;
      if (avgWordsPerSection >= rules.self_contained_h2.min_words_per_section) {
        if (totalSections >= 2) {
          score += rules.self_contained_h2.weight;
        } else {
          score += 3;
        }
      } else if (avgWordsPerSection >= 25) {
        score += 3;
        issues.push(this._issue(
          "info", 3, "answer_architecture",
          "H2 sections average " + Math.round(avgWordsPerSection) + " words. Aim for ≥" +
            rules.self_contained_h2.min_words_per_section + " words per section for self-contained answers.",
          "thin_sections"
        ));
      } else {
        issues.push(this._issue(
          "warning", 5, "answer_architecture",
          "H2 sections average only " + Math.round(avgWordsPerSection) + " words. Each section should be a standalone answer (≥" +
            rules.self_contained_h2.min_words_per_section + " words).",
          "thin_sections"
        ));
      }
    } else {
      issues.push(this._issue(
        "warning", 5, "answer_architecture",
        "No H2 headings found. Structure content with H2 sections for AI-parseable answer blocks.",
        "no_h2_sections"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── CITATION WORTHINESS (25 pts) ─────────────────────────

  _scoreCitationWorthiness(data) {
    var rules = this.config.citation_worthiness.rules;
    var score = 0;
    var maxScore = this.config.citation_worthiness.weight_total;
    var issues = [];
    var content = data.content || {};
    var meta = data.meta || {};
    var fullText = content.full_text || "";
    var paragraphs = content.paragraphs || [];

    // 1. Statistics with sources (7 pts)
    var statsCount = 0;
    for (var pi = 0; pi < paragraphs.length; pi++) {
      var pText = paragraphs[pi].text || "";
      var hasNumber = rules.stats_with_sources.number_pattern.test(pText);
      var hasAttribution = rules.stats_with_sources.attribution_pattern.test(pText);
      if (hasNumber && hasAttribution) statsCount++;
    }
    var statsThresholds = rules.stats_with_sources.thresholds;
    if (statsCount >= 5) {
      score += statsThresholds[4];
    } else if (statsCount >= 3) {
      score += statsThresholds[3];
    } else if (statsCount >= 1) {
      score += statsThresholds[2];
    } else {
      issues.push(this._issue(
        "warning", 7, "citation_worthiness",
        "No statistics with source attribution found. Adding statistics with sources increases citation likelihood ~35%.",
        "stats_without_sources"
      ));
    }

    // 2. Attributed claims (5 pts)
    var attrPattern = rules.attributed_claims.pattern;
    var attrMatches = fullText.match(new RegExp(attrPattern.source, attrPattern.flags + "g")) || [];
    var attrCount = attrMatches.length;
    var attrThresholds = rules.attributed_claims.thresholds;
    if (attrCount >= 2) {
      score += attrThresholds[3];
    } else if (attrCount === 1) {
      score += attrThresholds[2];
    } else {
      issues.push(this._issue(
        "warning", 5, "citation_worthiness",
        "No attributed claims found ('according to [Name]'). Attribution increases AI trust signals.",
        "no_attribution"
      ));
    }

    // 3. Expert quotes (4 pts)
    var structured = data.structured_data || {};
    // Count blockquotes from page data
    var blockquoteCount = 0;
    try {
      blockquoteCount = document.querySelectorAll("blockquote").length;
    } catch (e) { /* not in DOM context */ }

    var quoteAttr = rules.expert_quotes.attribution_pattern;
    var quoteMatches = fullText.match(new RegExp(quoteAttr.source, quoteAttr.flags + "g")) || [];
    var totalQuotes = blockquoteCount + quoteMatches.length;
    var quoteThresholds = rules.expert_quotes.thresholds;
    if (totalQuotes >= 2) {
      score += quoteThresholds[3];
    } else if (totalQuotes === 1) {
      score += quoteThresholds[2];
    } else {
      issues.push(this._issue(
        "info", 4, "citation_worthiness",
        "No expert quotes or blockquotes found. Expert quotes with attribution improve citation by AI engines.",
        "no_expert_quotes"
      ));
    }

    // 4. Publication date (5 pts)
    var dateFound = false;
    var isRecent = false;
    var pubDate, daysDiff;

    // Check JSON-LD for datePublished
    try {
      var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var ldi = 0; ldi < ldScripts.length; ldi++) {
        try {
          var ldData = JSON.parse(ldScripts[ldi].textContent);
          var dateStr = ldData.datePublished || ldData.dateModified;
          if (dateStr) {
            dateFound = true;
            pubDate = new Date(dateStr);
            daysDiff = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= rules.publication_date.recent_days) isRecent = true;
          }
        } catch (e) { /* invalid JSON-LD */ }
      }
    } catch (e) { /* no DOM */ }

    // Check <time> elements and meta tags
    if (!dateFound) {
      try {
        var timeEl = document.querySelector("time[datetime]");
        if (timeEl) {
          dateFound = true;
          pubDate = new Date(timeEl.getAttribute("datetime"));
          daysDiff = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= rules.publication_date.recent_days) isRecent = true;
        }
      } catch (e) { /* no DOM */ }
    }

    if (!dateFound) {
      try {
        var metaDate = document.querySelector('meta[property="article:published_time"]') ||
                       document.querySelector('meta[name="date"]');
        if (metaDate && metaDate.content) {
          dateFound = true;
          pubDate = new Date(metaDate.content);
          daysDiff = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= rules.publication_date.recent_days) isRecent = true;
        }
      } catch (e) { /* no DOM */ }
    }

    if (isRecent) {
      score += rules.publication_date.weight;
    } else if (dateFound) {
      score += 3;
    } else {
      issues.push(this._issue(
        "warning", 6, "citation_worthiness",
        "No publication date detected. 76.4% of ChatGPT's top-cited pages were updated within 30 days.",
        "no_publication_date"
      ));
    }

    // 5. Author attribution (4 pts)
    var authorScore = 0;
    // Check schema for author
    try {
      var authorLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var lai = 0; lai < authorLdScripts.length; lai++) {
        try {
          var ldData = JSON.parse(authorLdScripts[lai].textContent);
          if (ldData.author) {
            authorScore = rules.author_attribution.schema_pts;
            break;
          }
        } catch (e) { /* */ }
      }
    } catch (e) { /* */ }

    if (authorScore === 0) {
      // Check meta or DOM
      if (meta.author) {
        authorScore = rules.author_attribution.meta_pts;
      } else {
        try {
          var authorEl = document.querySelector('.author, [rel="author"], .byline, [itemprop="author"]');
          if (authorEl) authorScore = rules.author_attribution.meta_pts;
        } catch (e) { /* */ }
      }
    }

    if (authorScore > 0) {
      score += authorScore;
    } else {
      issues.push(this._issue(
        "warning", 5, "citation_worthiness",
        "No author attribution found (no schema author, no .byline, no meta author). Author credentials increase citation across all AI engines.",
        "no_author"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── MACHINE READABILITY (20 pts) ─────────────────────────

  _scoreMachineReadability(data) {
    var rules = this.config.machine_readability.rules;
    var score = 0;
    var maxScore = this.config.machine_readability.weight_total;
    var issues = [];
    var content = data.content || {};
    var structured = data.structured_data || {};
    var meta = data.meta || {};
    var wordCount = content.word_count || 0;

    // 1. JSON-LD present (5 pts)
    var hasJsonLd = structured.has_structured_data || false;
    if (!hasJsonLd) {
      try {
        hasJsonLd = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
      } catch (e) { /* */ }
    }

    if (hasJsonLd) {
      score += rules.json_ld_present.weight;
    } else {
      issues.push(this._issue(
        "warning", 7, "machine_readability",
        "No JSON-LD structured data found. Schema markup helps AI systems understand page content.",
        "no_json_ld"
      ));
    }

    // 2. Semantic HTML (4 pts) — 1pt each for: main/article, valid hierarchy, lists, tables
    var semanticScore = 0;
    try {
      if (document.querySelector("main, article")) semanticScore++;
    } catch (e) { /* */ }

    // Valid heading hierarchy (reuse headings data)
    var headings = data.headings || {};
    var hasH1 = (headings.h1 || []).length > 0;
    var hasH2 = (headings.h2 || []).length > 0;
    if (hasH1 && hasH2) semanticScore++;

    // Lists
    if (content.lists && content.lists.length > 0) semanticScore++;

    // Tables
    if (content.tables && content.tables.length > 0) semanticScore++;

    score += semanticScore;
    if (semanticScore < 3) {
      issues.push(this._issue(
        "info", 3, "machine_readability",
        "Semantic HTML score: " + semanticScore + "/4. Use <main>/<article>, heading hierarchy, lists, and tables for better machine parsing.",
        "low_semantic_html"
      ));
    }

    // 3. Text-to-image ratio (3 pts)
    var imageCount = 0;
    try {
      imageCount = document.querySelectorAll("img").length;
    } catch (e) {
      imageCount = (data.images || []).length;
    }
    var ratio = imageCount > 0 ? wordCount / imageCount : wordCount;
    var ratioThresholds = rules.text_to_image_ratio.thresholds;
    if (ratio >= ratioThresholds.high) {
      score += 3;
    } else if (ratio >= ratioThresholds.medium) {
      score += 2;
    } else if (ratio >= ratioThresholds.low) {
      score += 1;
    } else {
      issues.push(this._issue(
        "info", 2, "machine_readability",
        "Low text-to-image ratio (" + Math.round(ratio) + " words/image). Ensure sufficient text content alongside images.",
        "low_text_ratio"
      ));
    }

    // 4. Content in initial HTML (4 pts)
    if (wordCount >= rules.content_in_html.min_words_full) {
      score += rules.content_in_html.weight;
    } else if (wordCount >= rules.content_in_html.min_words_partial) {
      score += 2;
    } else {
      issues.push(this._issue(
        "warning", 5, "machine_readability",
        "Only " + wordCount + " words in HTML. AI crawlers need ≥" + rules.content_in_html.min_words_full + " words in initial HTML for reliable extraction.",
        "thin_html_content"
      ));
    }

    // 5. AI crawlers not blocked (2 pts)
    var aiBlocked = false;
    var robots = (meta.robots || "").toLowerCase();
    var blockedPatterns = rules.ai_crawlers_not_blocked.blocked_patterns;
    for (var bi = 0; bi < blockedPatterns.length; bi++) {
      if (blockedPatterns[bi].test(robots)) {
        aiBlocked = true;
        break;
      }
    }

    // Check for data-nosnippet
    if (!aiBlocked) {
      try {
        aiBlocked = document.querySelectorAll("[data-nosnippet]").length > 0;
      } catch (e) { /* */ }
    }

    if (!aiBlocked) {
      score += rules.ai_crawlers_not_blocked.weight;
    } else {
      issues.push(this._issue(
        "error", 8, "machine_readability",
        "AI crawlers are blocked (noai/noimageai in robots or data-nosnippet detected). Content will not appear in AI responses.",
        "ai_crawlers_blocked"
      ));
    }

    // 6. llms.txt reference (2 pts)
    var hasLlmsTxt = false;
    try {
      hasLlmsTxt = document.querySelector('link[href*="llms.txt"]') !== null;
    } catch (e) { /* */ }

    if (hasLlmsTxt) {
      score += rules.llms_txt.weight;
    } else {
      issues.push(this._issue(
        "info", 2, "machine_readability",
        "No llms.txt reference found. An llms.txt file helps AI systems understand site content and permissions.",
        "no_llms_txt"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── CONTENT PRECISION (15 pts) ───────────────────────────

  _scoreContentPrecision(data) {
    var rules = this.config.content_precision.rules;
    var score = 0;
    var maxScore = this.config.content_precision.weight_total;
    var issues = [];
    var content = data.content || {};
    var fullText = content.full_text || "";
    var wordCount = content.word_count || 0;
    var paragraphs = content.paragraphs || [];

    // 1. Specific entities/numbers (5 pts)
    var entityPattern = rules.specific_entities.entity_pattern;
    var entityMatches = fullText.match(entityPattern) || [];
    var entitiesPer500 = wordCount > 0 ? (entityMatches.length / wordCount) * 500 : 0;
    var entityThresholds = rules.specific_entities.thresholds;
    if (entitiesPer500 >= entityThresholds.high) {
      score += rules.specific_entities.weight;
    } else if (entitiesPer500 >= entityThresholds.medium) {
      score += 3;
    } else if (entitiesPer500 >= entityThresholds.low) {
      score += 1;
    } else {
      issues.push(this._issue(
        "warning", 5, "content_precision",
        "Low entity density (" + Math.round(entitiesPer500 * 10) / 10 + " per 500 words). Add specific names, dates, numbers, and percentages.",
        "low_entity_density"
      ));
    }

    // 2. Verifiable claims per paragraph (5 pts)
    var verifiableCount = 0;
    var substantiveParagraphs = 0;
    var verificationPattern = /\d+%|\$[\d,.]+|\d{4}|according to|study|research|data shows|survey|report/i;
    for (var vi = 0; vi < paragraphs.length; vi++) {
      var pText = paragraphs[vi].text || "";
      var pWords = paragraphs[vi].word_count || this._countWords(pText);
      if (pWords > 30) {
        substantiveParagraphs++;
        if (verificationPattern.test(pText)) verifiableCount++;
      }
    }
    var verifiablePct = substantiveParagraphs > 0 ? verifiableCount / substantiveParagraphs : 0;
    var verThresholds = rules.verifiable_claims.thresholds;
    if (verifiablePct >= verThresholds.high) {
      score += rules.verifiable_claims.weight;
    } else if (verifiablePct >= verThresholds.medium) {
      score += 3;
    } else if (verifiablePct >= verThresholds.low) {
      score += 1;
    } else {
      issues.push(this._issue(
        "warning", 5, "content_precision",
        "Only " + Math.round(verifiablePct * 100) + "% of paragraphs contain verifiable data. Target ≥60% with numbers, dates, or citations.",
        "low_verifiable_claims"
      ));
    }

    // 3. No filler content (5 pts)
    var fillerPhrases = rules.no_filler.filler_phrases;
    var fillerCount = 0;
    var lowerText = fullText.toLowerCase();
    var foundFillers = [];
    for (var fi = 0; fi < fillerPhrases.length; fi++) {
      var phrase = fillerPhrases[fi].toLowerCase();
      var idx = 0;
      while ((idx = lowerText.indexOf(phrase, idx)) !== -1) {
        fillerCount++;
        if (foundFillers.indexOf(fillerPhrases[fi]) === -1) foundFillers.push(fillerPhrases[fi]);
        idx += phrase.length;
      }
    }
    var fillerPer1000 = wordCount > 0 ? (fillerCount / wordCount) * 1000 : 0;
    var fillerThresholds = rules.no_filler.thresholds;
    if (fillerPer1000 <= fillerThresholds.clean) {
      score += rules.no_filler.weight;
    } else if (fillerPer1000 <= fillerThresholds.acceptable) {
      score += 3;
    } else {
      issues.push(this._issue(
        "warning", 5, "content_precision",
        "Found " + fillerCount + " filler phrases per " + (wordCount > 0 ? Math.round(wordCount / 1000) + "K" : "0") +
          " words: '" + foundFillers.slice(0, 3).join("', '") + "'. Target ≤1 per 1000 words.",
        "filler_detected"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── MULTI-ENGINE (15 pts) ────────────────────────────────

  _scoreMultiEngine(data, readability) {
    var rules = this.config.multi_engine.rules;
    var score = 0;
    var maxScore = this.config.multi_engine.weight_total;
    var issues = [];
    var content = data.content || {};
    var fullText = content.full_text || "";
    var wordCount = content.word_count || 0;
    var lowerText = fullText.toLowerCase();

    // 1. Neutral tone (5 pts)
    var superlatives = rules.neutral_tone.superlatives;
    var superCount = 0;
    var foundSuperlatives = [];
    for (var si = 0; si < superlatives.length; si++) {
      var sup = superlatives[si].toLowerCase();
      if (lowerText.indexOf(sup) !== -1) {
        superCount++;
        foundSuperlatives.push(superlatives[si]);
      }
    }
    var superPer1000 = wordCount > 0 ? (superCount / wordCount) * 1000 : 0;
    var toneThresholds = rules.neutral_tone.thresholds;
    if (superPer1000 <= toneThresholds.clean) {
      score += rules.neutral_tone.weight;
    } else if (superPer1000 <= toneThresholds.acceptable) {
      score += 3;
    } else {
      issues.push(this._issue(
        "warning", 5, "multi_engine",
        "Promotional language detected: '" + foundSuperlatives.slice(0, 3).join("', '") +
          "'. AI engines prefer neutral, objective tone.",
        "promotional_tone"
      ));
    }

    // 2. Experience markers (5 pts)
    var expPatterns = rules.experience_markers.patterns;
    var expCount = 0;
    for (var ei = 0; ei < expPatterns.length; ei++) {
      if (expPatterns[ei].test(fullText)) expCount++;
    }
    var expThresholds = rules.experience_markers.thresholds;
    if (expCount >= 3) {
      score += expThresholds[4];
    } else if (expCount === 2) {
      score += expThresholds[3];
    } else if (expCount === 1) {
      score += expThresholds[2];
    } else {
      issues.push(this._issue(
        "info", 4, "multi_engine",
        "No first-hand experience markers found ('we tested', 'in our experience'). Experience signals improve trust across AI engines.",
        "no_experience_markers"
      ));
    }

    // 3. Opening answers question (5 pts)
    // First 50 words contain answer patterns
    var first50Words = fullText.split(/\s+/).slice(0, 50).join(" ");
    var answerPatterns = rules.opening_answers.answer_patterns;
    var hasOpeningAnswer = false;
    for (var ai = 0; ai < answerPatterns.length; ai++) {
      if (answerPatterns[ai].test(first50Words)) {
        hasOpeningAnswer = true;
        break;
      }
    }
    if (hasOpeningAnswer) {
      score += rules.opening_answers.weight;
    } else {
      issues.push(this._issue(
        "warning", 5, "multi_engine",
        "First 50 words don't contain a direct answer pattern ('is a', 'refers to', 'you can'). Opening with a direct answer improves multi-engine citation.",
        "no_opening_answer"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── HELPERS ──────────────────────────────────────────────

  _issue(type, impact, element, message, code) {
    var obj = {
      type: type,
      impact: impact,
      element: element,
      message: message
    };
    if (code) {
      obj.code = code;
    }
    return obj;
  }

  _countWords(text) {
    return text.split(/\s+/).filter(Boolean).length;
  }

  _truncate(text, maxLen) {
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "...";
  }
}
