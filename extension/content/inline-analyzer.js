// ═══════════════════════════════════════════════════════════════
// INLINE ANALYZER
// Bridges extraction data (with CSS selectors) to per-element
// annotations for inline overlay rendering.
// ═══════════════════════════════════════════════════════════════

class InlineAnalyzer {
  constructor() {
    this._maxAnnotations = 60;
    this._dismissedIds = {};
    this._domainKey = "";
  }

  /**
   * Load dismissed annotation state from chrome.storage.local.
   * Call this before analyze() to restore prior dismissals for this domain.
   * @param {string} domain — e.g. "example.com"
   * @param {Function} [callback] — called when state is loaded
   */
  loadDismissedState(domain, callback) {
    this._domainKey = "dismissed_" + (domain || "").replace(/[^a-z0-9]/gi, "_");
    try {
      chrome.storage.local.get([this._domainKey], function (data) {
        this._dismissedIds = (data && data[this._domainKey]) || {};
        if (callback) callback();
      }.bind(this));
    } catch (e) {
      // chrome.storage not available (e.g. unit tests)
      if (callback) callback();
    }
  }

  /**
   * Mark an annotation as dismissed and persist to chrome.storage.local.
   * @param {string} annotationId — the annotation's id field
   */
  markDismissed(annotationId) {
    this._dismissedIds[annotationId] = true;
    if (!this._domainKey) return;
    try {
      var obj = {};
      obj[this._domainKey] = this._dismissedIds;
      chrome.storage.local.set(obj);
    } catch (e) { /* ignore */ }
  }

  /**
   * Analyze page data and produce per-element annotations.
   * @param {Object} pageData  — DOMExtractor.extract() output
   * @param {Object} seoResult — ClientSEOScorer.score() output
   * @param {Object} readability — ReadabilityScorer.analyze() output
   * @param {Object} geoResult — ClientGEOScorer.score() output (optional)
   * @returns {Object} { annotations, metaBar, structuralInserts, stats }
   */
  analyze(pageData, seoResult, readability, geoResult) {
    var annotations = [];

    // Per-element analysis
    annotations = annotations.concat(this._analyzeHeadings(pageData.headings));
    annotations = annotations.concat(this._analyzeParagraphs(pageData.content));
    annotations = annotations.concat(this._analyzeLinks(pageData.links));
    annotations = annotations.concat(this._analyzeImages(pageData.images));
    annotations = annotations.concat(this._analyzePerformance(pageData.images));
    annotations = annotations.concat(this._analyzeAccessibility());

    // Generate deterministic GEO suggestions from client-side scoring
    if (geoResult && geoResult.issues && geoResult.issues.length > 0) {
      this._generateGEOSuggestions(annotations, geoResult, pageData);
    }

    // Apply persisted dismissed state — restore dismissals from chrome.storage
    for (var di = 0; di < annotations.length; di++) {
      if (this._dismissedIds[annotations[di].id]) {
        annotations[di].dismissed = true;
      }
    }

    // Frequency map — count how many annotations share the same issue code
    var freqMap = {};
    for (var fi = 0; fi < annotations.length; fi++) {
      var fIssues = annotations[fi].issues || [];
      for (var fj = 0; fj < fIssues.length; fj++) {
        var fc = fIssues[fj].code;
        if (fc) freqMap[fc] = (freqMap[fc] || 0) + 1;
      }
    }

    // Composite priority: severity dominates, then impact, then frequency boost
    // Lower _priority = shown first
    var severityOrder = { error: 0, warning: 1, info: 2, good: 3 };
    for (var pi = 0; pi < annotations.length; pi++) {
      var topIssue = annotations[pi].issues && annotations[pi].issues[0];
      var sev = severityOrder[annotations[pi].severity] !== undefined
                ? severityOrder[annotations[pi].severity] : 3;
      var impact = topIssue ? (topIssue.impact || 0) : 0;
      var freq = (topIssue && topIssue.code) ? Math.min(freqMap[topIssue.code] || 1, 20) : 1;
      annotations[pi]._priority = sev * 1000 - impact * 10 - freq;
    }

    annotations.sort(function (a, b) {
      return a._priority - b._priority;
    });

    // Cap for performance — keep all errors/warnings, trim info/good
    if (annotations.length > this._maxAnnotations) {
      var critical = annotations.filter(function (a) { return a.severity === "error" || a.severity === "warning"; });
      var rest = annotations.filter(function (a) { return a.severity !== "error" && a.severity !== "warning"; });
      annotations = critical.concat(rest.slice(0, this._maxAnnotations - critical.length));
    }

    // Meta bar data
    var metaBar = this._analyzeMeta(pageData.meta);

    // Structural gap detection
    var structuralInserts = this._detectStructuralGaps(pageData);

    // Stats
    var stats = { total: annotations.length, error: 0, warning: 0, info: 0, good: 0 };
    for (var i = 0; i < annotations.length; i++) {
      if (stats[annotations[i].severity] !== undefined) stats[annotations[i].severity]++;
    }

    return {
      annotations: annotations,
      metaBar: metaBar,
      structuralInserts: structuralInserts,
      stats: stats
    };
  }

  // ─── HEADINGS ────────────────────────────────────────────────

  _analyzeHeadings(headings) {
    var annotations = [];
    if (!headings) return annotations;

    var levels = ["h1", "h2", "h3", "h4", "h5", "h6"];
    var h1Count = headings.h1 ? headings.h1.length : 0;
    var genericLabels = SCORING_CONFIG.seo.headings.rules.descriptive.generic_labels;
    var annIndex = 0;

    // Detect hierarchy gaps
    var usedLevels = {};
    for (var li = 0; li < levels.length; li++) {
      if (headings[levels[li]] && headings[levels[li]].length > 0) {
        usedLevels[li + 1] = true;
      }
    }
    var hierarchyGaps = {};
    for (var lv = 2; lv <= 6; lv++) {
      if (usedLevels[lv] && !usedLevels[lv - 1]) {
        hierarchyGaps[lv] = true;
      }
    }

    for (var li = 0; li < levels.length; li++) {
      var level = levels[li];
      var items = headings[level] || [];
      var levelNum = li + 1;

      for (var hi = 0; hi < items.length; hi++) {
        var h = items[hi];
        if (!h.selector) continue;

        var issues = [];
        var text = (h.text || "").trim();
        var charCount = text.length;

        // Too short
        if (charCount > 0 && charCount < 15) {
          issues.push({
            code: "heading_too_short",
            severity: "warning",
            message: "Heading is too short (" + charCount + " chars). Be more descriptive.",
            fix: null,
            impact: 5
          });
        }

        // Too long
        if (charCount > 80) {
          issues.push({
            code: "heading_too_long",
            severity: "info",
            message: "Heading is long (" + charCount + " chars). Consider being more concise.",
            fix: null,
            impact: 3
          });
        }

        // Generic label
        var isGeneric = false;
        for (var gi = 0; gi < genericLabels.length; gi++) {
          if (genericLabels[gi].test(text)) { isGeneric = true; break; }
        }
        if (isGeneric) {
          issues.push({
            code: "heading_generic",
            severity: "warning",
            message: "Generic heading. Use a descriptive, keyword-rich heading.",
            fix: "Example: 'Benefits' \u2192 'What Are the Top 5 Benefits of [Topic]?'",
            impact: 6,
            research_cite: "Princeton GEO 2024"
          });
        }

        // Multiple H1s
        if (level === "h1" && h1Count > 1 && hi > 0) {
          issues.push({
            code: "multiple_h1",
            severity: "error",
            message: "Multiple H1 headings found (" + h1Count + "). Use exactly one H1.",
            fix: "Change this to an H2 or remove it.",
            impact: 8
          });
        }

        // Missing H1
        if (level === "h1" && h1Count === 0) {
          // Won't fire since items would be empty, handled elsewhere
        }

        // Hierarchy gap
        if (hierarchyGaps[levelNum]) {
          issues.push({
            code: "heading_hierarchy_skip",
            severity: "warning",
            message: "H" + levelNum + " used without H" + (levelNum - 1) + ". Don't skip heading levels.",
            fix: "Add an H" + (levelNum - 1) + " parent heading or change this to H" + (levelNum - 1) + ".",
            impact: 5
          });
        }

        // Not a question (GEO opportunity)
        var isQuestion = /\?$/.test(text) ||
          /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will)\s/i.test(text);
        if (!isQuestion && (level === "h2" || level === "h3") && charCount > 10) {
          issues.push({
            code: "heading_not_question",
            severity: "info",
            message: "Statement heading \u2014 question format gets 2.8\u00D7 more AI snippets.",
            fix: null,
            impact: 3,
            research_cite: "Princeton GEO 2024"
          });
        }

        var severity = this._worstSeverity(issues);

        annotations.push({
          id: "ann-heading-" + annIndex++,
          selector: h.selector,
          elementType: "heading",
          tagName: level,
          severity: severity,
          issues: issues,
          elementText: text,
          metrics: {
            chars: charCount,
            words: text.split(/\s+/).filter(Boolean).length,
            level: levelNum
          },
          suggestion: null,
          dismissed: false
        });
      }
    }

    return annotations;
  }

  // ─── PARAGRAPHS ─────────────────────────────────────────────

  _analyzeParagraphs(content) {
    var annotations = [];
    if (!content || !content.paragraphs) return annotations;

    var maxSentences = SCORING_CONFIG.seo.content.rules.paragraph_length.max_sentences;
    var maxWords = SCORING_CONFIG.seo.ux.rules.no_wall_of_text.max_block_words;

    for (var i = 0; i < content.paragraphs.length; i++) {
      var p = content.paragraphs[i];
      if (!p.selector) continue;

      var text = p.text || "";
      var wordCount = p.word_count || text.split(/\s+/).filter(Boolean).length;
      var sentences = text.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; });
      var sentenceCount = sentences.length;

      var issues = [];

      // Wall of text
      if (wordCount > maxWords) {
        issues.push({
          code: "paragraph_wall_of_text",
          severity: "warning",
          message: "Wall of text (" + wordCount + " words). Break into shorter paragraphs.",
          fix: "Split into 2-3 paragraphs of " + Math.round(maxWords / 2) + " words each.",
          impact: 7
        });
      }

      // Too many sentences
      if (sentenceCount > maxSentences) {
        issues.push({
          code: "paragraph_too_long",
          severity: "warning",
          message: sentenceCount + " sentences (max " + maxSentences + "). Break this paragraph up.",
          fix: "Split after " + maxSentences + " sentences for better readability.",
          impact: 5
        });
      }

      // Per-paragraph readability (simple Flesch estimate)
      if (wordCount > 20) {
        var avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : wordCount;
        var syllables = this._estimateSyllables(text);
        var avgSyllablesPerWord = wordCount > 0 ? syllables / wordCount : 0;
        var fre = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
        fre = Math.round(fre * 10) / 10;

        if (fre < 30) {
          issues.push({
            code: "paragraph_very_hard",
            severity: "warning",
            message: "Very hard to read (Flesch: " + fre + "). Simplify language and shorten sentences.",
            fix: "Use simpler words and break long sentences. Target Flesch score of 60+.",
            impact: 6
          });
        } else if (fre < 50) {
          issues.push({
            code: "paragraph_hard_to_read",
            severity: "info",
            message: "Hard to read (Flesch: " + fre + "). Consider simplifying.",
            fix: "Shorten sentences to under 20 words. Replace multi-syllable words with simpler synonyms.",
            impact: 4
          });
        }
      }

      // Claim without verifiable data (GEO precision check)
      if (wordCount >= 50) {
        var claimPattern = /\b(increases?|improves?|reduces?|boosts?|decreases?|shows?|reveals?|demonstrates?|proves?|indicates?|suggests?|leads? to|results? in|causes?|helps?|prevents?|enables?)\b/i;
        var dataPattern = /\d+%|\$[\d,.]+|\d{4}|according to|study|research|survey|report|found that|data shows?/i;
        if (claimPattern.test(text) && !dataPattern.test(text)) {
          issues.push({
            code: "paragraph_claim_without_data",
            severity: "info",
            message: "Makes factual claims without supporting data or citations.",
            fix: "Add a statistic or named source: '[claim], according to [Source] ([Year]).'",
            impact: 6,
            research_cite: "Princeton GEO 2024 \u2014 unsubstantiated claims get skipped by AI"
          });
        }
      }

      // Skip paragraphs with no issues and short length (not interesting)
      if (issues.length === 0 && wordCount < 50) continue;

      var severity = this._worstSeverity(issues);

      annotations.push({
        id: "ann-para-" + i,
        selector: p.selector,
        elementType: "paragraph",
        tagName: "p",
        severity: severity,
        issues: issues,
        elementText: text.substring(0, 60),
        metrics: {
          words: wordCount,
          sentences: sentenceCount
        },
        suggestion: null,
        dismissed: false
      });
    }

    return annotations;
  }

  // ─── LINKS ──────────────────────────────────────────────────

  _analyzeLinks(links) {
    var annotations = [];
    if (!links) return annotations;

    var badAnchors = SCORING_CONFIG.seo.links.rules.descriptive_anchors.bad_anchors;
    var annIndex = 0;

    var allLinks = (links.internal || []).concat(links.external || []);

    for (var i = 0; i < allLinks.length; i++) {
      var link = allLinks[i];
      if (!link.selector) continue;

      var text = (link.text || "").trim();
      var isInternal = i < (links.internal || []).length;
      var issues = [];

      // Empty anchor
      if (text.length === 0) {
        issues.push({
          code: "link_empty_anchor",
          severity: "error",
          message: "Link has no anchor text. Add descriptive text.",
          fix: "Add text that describes where this link leads.",
          impact: 7
        });
      }

      // Generic anchor
      if (text.length > 0) {
        var isGeneric = false;
        for (var bi = 0; bi < badAnchors.length; bi++) {
          if (badAnchors[bi].test(text)) { isGeneric = true; break; }
        }
        if (isGeneric) {
          issues.push({
            code: "link_generic_anchor",
            severity: "warning",
            message: "Generic anchor text: \"" + text + "\". Use descriptive text.",
            fix: "Replace with text describing the link destination.",
            impact: 5
          });
        }
      }

      // Internal nofollow
      if (isInternal && link.has_nofollow) {
        issues.push({
          code: "link_internal_nofollow",
          severity: "warning",
          message: "Internal link has nofollow. Remove nofollow from internal links.",
          fix: "Remove rel=\"nofollow\" to pass PageRank internally.",
          impact: 4
        });
      }

      // Only annotate links with issues (there are usually too many links)
      if (issues.length === 0) continue;

      annotations.push({
        id: "ann-link-" + annIndex++,
        selector: link.selector,
        elementType: "link",
        tagName: "a",
        severity: this._worstSeverity(issues),
        issues: issues,
        elementText: text.length > 0 ? text.substring(0, 60) : (link.href || "").substring(0, 40),
        metrics: {
          href: (link.href || "").substring(0, 60),
          isInternal: isInternal,
          anchorLength: text.length
        },
        suggestion: null,
        dismissed: false
      });
    }

    return annotations;
  }

  // ─── IMAGES ─────────────────────────────────────────────────

  _analyzeImages(images) {
    var annotations = [];
    if (!images) return annotations;

    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img.selector) continue;

      var issues = [];

      if (!img.has_alt && !img.alt) {
        issues.push({
          code: "image_missing_alt",
          severity: "error",
          message: "Image has no alt text. Add descriptive alt text for accessibility and SEO.",
          fix: "Add alt=\"[describe what is shown in the image]\" to this <img>. Be specific: 'alt=\"Red running shoes on white background\"' not 'alt=\"shoe\"'.",
          impact: 8
        });
      } else {
        var alt = (img.alt || "").trim();
        if (alt.length > 0 && alt.length < 5) {
          issues.push({
            code: "image_poor_alt",
            severity: "warning",
            message: "Alt text is too short (\"" + alt + "\"). Be more descriptive.",
            fix: "Write a concise description of what the image shows.",
            impact: 4
          });
        }
        // Check for generic alt like "image", "photo", "img"
        if (/^(image|photo|img|picture|icon|logo|banner|screenshot)\s*\d*$/i.test(alt)) {
          issues.push({
            code: "image_generic_alt",
            severity: "warning",
            message: "Generic alt text: \"" + alt + "\". Describe the image content.",
            fix: "Replace with a description of what the image actually shows.",
            impact: 5
          });
        }
      }

      // Missing width/height (CLS risk)
      if (!img.width && !img.height) {
        issues.push({
          code: "image_missing_dimensions",
          severity: "warning",
          message: "Image missing width and height attributes \u2014 causes layout shift (CLS) as the page loads.",
          fix: "Add width=\"[px]\" height=\"[px]\" matching the image's natural dimensions. This eliminates layout shift and improves LCP.",
          impact: 6,
          research_cite: "Core Web Vitals \u2014 CLS prevention"
        });
      }

      // Only annotate images with issues
      if (issues.length === 0) continue;

      annotations.push({
        id: "ann-img-" + i,
        selector: img.selector,
        elementType: "image",
        tagName: "img",
        severity: this._worstSeverity(issues),
        issues: issues,
        elementText: img.alt || img.src || "",
        metrics: {
          hasAlt: !!(img.alt || img.has_alt),
          altLength: (img.alt || "").length
        },
        suggestion: null,
        dismissed: false
      });
    }

    return annotations;
  }

  // ─── PERFORMANCE ─────────────────────────────────────────────

  _analyzePerformance(images) {
    var annotations = [];
    var perfCfg = SCORING_CONFIG.performance || {};

    // ── no_lazy_loading_images ──
    var allImages = images || [];
    var minImages = perfCfg.lazy_loading_min_images || 3;
    if (allImages.length >= minImages) {
      var domImgs = document.querySelectorAll("img");
      var nonLazy = 0;
      for (var di = 0; di < domImgs.length; di++) {
        if (domImgs[di].getAttribute("loading") !== "lazy") nonLazy++;
      }
      var pct = domImgs.length > 0 ? nonLazy / domImgs.length : 0;
      if (pct >= (perfCfg.lazy_loading_threshold_pct || 0.30)) {
        annotations.push({
          id: "ann-perf-lazy",
          selector: null,
          elementType: "performance",
          tagName: null,
          severity: "info",
          issues: [{
            code: "no_lazy_loading_images",
            severity: "info",
            message: nonLazy + " of " + domImgs.length + " images missing loading=\"lazy\". Below-the-fold images should defer loading to improve LCP.",
            fix: "Add loading=\"lazy\" to all <img> tags not in the initial viewport. The first 1-2 hero images should NOT have lazy loading.",
            impact: 5,
            research_cite: "Core Web Vitals \u2014 LCP optimization"
          }],
          elementText: nonLazy + " images",
          metrics: { nonLazy: nonLazy, total: domImgs.length },
          suggestion: null,
          dismissed: false
        });
      }
    }

    // ── no_preload_critical_assets ──
    var preloads = document.querySelectorAll("link[rel=\"preload\"]");
    if (preloads.length === 0) {
      annotations.push({
        id: "ann-perf-preload",
        selector: null,
        elementType: "performance",
        tagName: null,
        severity: "info",
        issues: [{
          code: "no_preload_critical_assets",
          severity: "info",
          message: "No <link rel=\"preload\"> found. Preloading critical assets (hero image, fonts, CSS) eliminates render-blocking delays.",
          fix: "Add to <head>: <link rel=\"preload\" href=\"/hero.webp\" as=\"image\"> for the LCP image, and <link rel=\"preload\" href=\"/font.woff2\" as=\"font\" crossorigin> for primary fonts.",
          impact: 4,
          research_cite: "Core Web Vitals \u2014 LCP & FCP optimization"
        }],
        elementText: "No preload hints",
        metrics: { preloadCount: 0 },
        suggestion: null,
        dismissed: false
      });
    }

    // ── long_dom_nodes ──
    var domThreshold = perfCfg.dom_nodes_threshold || 1500;
    var nodeCount = document.querySelectorAll("*").length;
    if (nodeCount > domThreshold) {
      annotations.push({
        id: "ann-perf-dom",
        selector: null,
        elementType: "performance",
        tagName: null,
        severity: "warning",
        issues: [{
          code: "long_dom_nodes",
          severity: "warning",
          message: "DOM has " + nodeCount + " nodes (threshold: " + domThreshold + "). Large DOMs slow rendering and degrade AI crawler parsing efficiency.",
          fix: "Flatten deeply nested wrappers, remove unused DOM nodes, paginate large lists. Target < " + domThreshold + " total elements.",
          impact: 6,
          research_cite: "Google PageSpeed Insights \u2014 Avoid an excessive DOM size"
        }],
        elementText: nodeCount + " DOM nodes",
        metrics: { nodeCount: nodeCount, threshold: domThreshold },
        suggestion: null,
        dismissed: false
      });
    }

    // ── too_many_requests ──
    if (window.performance && window.performance.getEntriesByType) {
      var reqThreshold = perfCfg.request_count_threshold || 100;
      var reqCount = window.performance.getEntriesByType("resource").length;
      if (reqCount > reqThreshold) {
        annotations.push({
          id: "ann-perf-requests",
          selector: null,
          elementType: "performance",
          tagName: null,
          severity: "info",
          issues: [{
            code: "too_many_requests",
            severity: "info",
            message: reqCount + " network requests detected (threshold: " + reqThreshold + "). Excess requests increase Time to Interactive and hurt mobile performance.",
            fix: "Bundle JS/CSS files, lazy-load third-party scripts, use a CDN, and defer non-critical analytics. Target < " + reqThreshold + " requests.",
            impact: 5,
            research_cite: "Core Web Vitals \u2014 Time to Interactive"
          }],
          elementText: reqCount + " requests",
          metrics: { requestCount: reqCount, threshold: reqThreshold },
          suggestion: null,
          dismissed: false
        });
      }
    }

    return annotations;
  }

  // ─── ACCESSIBILITY ───────────────────────────────────────────

  _analyzeAccessibility() {
    var annotations = [];

    // ── missing_aria_labels ──
    var interactive = document.querySelectorAll(
      "button, [role=\"button\"], input[type=\"submit\"], input[type=\"button\"], a[role=\"button\"]"
    );
    var unlabeled = [];
    for (var ii = 0; ii < interactive.length; ii++) {
      var el = interactive[ii];
      var hasLabel = el.getAttribute("aria-label") ||
                     el.getAttribute("aria-labelledby") ||
                     (el.textContent || "").trim().length > 0;
      if (!hasLabel) {
        unlabeled.push(el);
      }
    }
    if (unlabeled.length > 0) {
      var sel = this._getSimpleSelector(unlabeled[0]);
      annotations.push({
        id: "ann-a11y-aria",
        selector: sel,
        elementType: "accessibility",
        tagName: unlabeled[0].tagName.toLowerCase(),
        severity: "warning",
        issues: [{
          code: "missing_aria_labels",
          severity: "warning",
          message: unlabeled.length + " interactive element" + (unlabeled.length !== 1 ? "s" : "") + " have no accessible label. Screen readers and AI parsers both rely on ARIA labels for context.",
          fix: "Add aria-label=\"[describe the action]\" to each unlabeled button or interactive element. Example: aria-label=\"Close dialog\" or aria-label=\"Subscribe to newsletter\".",
          impact: 6,
          research_cite: "WCAG 2.1 Success Criterion 4.1.2"
        }],
        elementText: unlabeled.length + " unlabeled elements",
        metrics: { unlabeledCount: unlabeled.length },
        suggestion: null,
        dismissed: false
      });
    }

    // ── missing_form_labels ──
    var inputs = document.querySelectorAll("input:not([type=\"hidden\"]):not([type=\"submit\"]):not([type=\"button\"]), select, textarea");
    var unlabeledInputs = [];
    for (var fi = 0; fi < inputs.length; fi++) {
      var inp = inputs[fi];
      var id = inp.getAttribute("id");
      var hasFormLabel = (id && document.querySelector("label[for=\"" + id + "\"]")) ||
                         inp.getAttribute("aria-label") ||
                         inp.getAttribute("aria-labelledby") ||
                         inp.closest("label");
      if (!hasFormLabel) unlabeledInputs.push(inp);
    }
    if (unlabeledInputs.length > 0) {
      var inpSel = this._getSimpleSelector(unlabeledInputs[0]);
      annotations.push({
        id: "ann-a11y-form",
        selector: inpSel,
        elementType: "accessibility",
        tagName: unlabeledInputs[0].tagName.toLowerCase(),
        severity: "warning",
        issues: [{
          code: "missing_form_labels",
          severity: "warning",
          message: unlabeledInputs.length + " form field" + (unlabeledInputs.length !== 1 ? "s" : "") + " have no associated <label>. Required for accessibility compliance and form parsing.",
          fix: "Wrap each field in <label> or use: <label for=\"fieldId\">Label text</label><input id=\"fieldId\">. Alternatively add aria-label=\"Field description\" directly to the input.",
          impact: 7,
          research_cite: "WCAG 2.1 Success Criterion 1.3.1 \u2014 Info and Relationships"
        }],
        elementText: unlabeledInputs.length + " unlabeled fields",
        metrics: { unlabeledCount: unlabeledInputs.length },
        suggestion: null,
        dismissed: false
      });
    }

    // ── video_without_captions ──
    var videos = document.querySelectorAll("video");
    var uncaptioned = [];
    for (var vi = 0; vi < videos.length; vi++) {
      var tracks = videos[vi].querySelectorAll("track[kind=\"captions\"], track[kind=\"subtitles\"]");
      if (tracks.length === 0) uncaptioned.push(videos[vi]);
    }
    if (uncaptioned.length > 0) {
      var vidSel = this._getSimpleSelector(uncaptioned[0]);
      annotations.push({
        id: "ann-a11y-video",
        selector: vidSel,
        elementType: "accessibility",
        tagName: "video",
        severity: "warning",
        issues: [{
          code: "video_without_captions",
          severity: "warning",
          message: uncaptioned.length + " video element" + (uncaptioned.length !== 1 ? "s" : "") + " have no captions. Required by WCAG 2.1 AA and improves AI content extraction.",
          fix: "Add <track kind=\"captions\" src=\"captions.vtt\" srclang=\"en\" label=\"English\"> inside each <video>. Generate .vtt files using tools like YouTube auto-captions or rev.com.",
          impact: 6,
          research_cite: "WCAG 2.1 Success Criterion 1.2.2 \u2014 Captions (Prerecorded)"
        }],
        elementText: uncaptioned.length + " uncaptioned videos",
        metrics: { uncaptionedCount: uncaptioned.length },
        suggestion: null,
        dismissed: false
      });
    }

    return annotations;
  }

  // Helper: simple selector for accessibility annotations (no extractor involvement)
  _getSimpleSelector(el) {
    if (!el) return null;
    if (el.id) return "#" + el.id;
    var tag = el.tagName.toLowerCase();
    var cls = el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/)[0] : "";
    return tag + cls || tag;
  }

  // ─── META ───────────────────────────────────────────────────

  _analyzeMeta(meta) {
    if (!meta) return { title: { text: "", length: 0, issues: [], severity: "error" },
                        description: { text: "", length: 0, issues: [], severity: "error" } };

    // Title
    var title = (meta.title || "").trim();
    var titleLen = title.length;
    var titleIssues = [];
    var titleRules = SCORING_CONFIG.seo.title.rules;

    if (titleLen === 0) {
      titleIssues.push({ code: "title_missing", severity: "error", message: "Missing title tag.", fix: "Add a descriptive <title> tag.", impact: 10 });
    } else {
      if (titleLen < titleRules.length.min) {
        titleIssues.push({ code: "title_short", severity: "warning", message: "Title is short (" + titleLen + "/" + titleRules.length.min + " chars).", fix: "Expand to " + titleRules.length.min + "-" + titleRules.length.max + " characters.", impact: 7 });
      }
      if (titleLen > titleRules.length.max) {
        titleIssues.push({ code: "title_long", severity: "warning", message: "Title may be truncated (" + titleLen + "/" + titleRules.length.max + " chars).", fix: "Shorten to " + titleRules.length.max + " characters or fewer.", impact: 6 });
      }
    }

    // Description
    var desc = (meta.meta_description || "").trim();
    var descLen = desc.length;
    var descIssues = [];
    var descRules = SCORING_CONFIG.seo.meta_description.rules;

    if (descLen === 0) {
      descIssues.push({ code: "desc_missing", severity: "error", message: "Missing meta description.", fix: "Add a compelling <meta name='description'> tag.", impact: 9 });
    } else {
      if (descLen < descRules.length.min) {
        descIssues.push({ code: "desc_short", severity: "warning", message: "Description is short (" + descLen + "/" + descRules.length.min + " chars).", fix: "Expand to " + descRules.length.min + "-" + descRules.length.max + " characters.", impact: 6 });
      }
      if (descLen > descRules.length.max) {
        descIssues.push({ code: "desc_long", severity: "info", message: "Description may be truncated (" + descLen + "/" + descRules.length.max + " chars).", fix: "Shorten to " + descRules.length.max + " characters or fewer.", impact: 4 });
      }
    }

    return {
      title: { text: title, length: titleLen, issues: titleIssues, severity: this._worstSeverity(titleIssues) },
      description: { text: desc, length: descLen, issues: descIssues, severity: this._worstSeverity(descIssues) }
    };
  }

  // ─── STRUCTURAL GAPS ───────────────────────────────────────

  _detectStructuralGaps(pageData) {
    var inserts = [];
    if (!pageData) return inserts;

    var content = pageData.content || {};
    var headings = pageData.headings || {};
    var fullText = (content.full_text || "").toLowerCase();

    // Find the last H2 selector for insert point
    var h2s = headings.h2 || [];
    var lastH2Selector = h2s.length > 0 ? h2s[h2s.length - 1].selector : null;
    if (!lastH2Selector) {
      var h1s = headings.h1 || [];
      lastH2Selector = h1s.length > 0 ? h1s[h1s.length - 1].selector : null;
    }
    if (!lastH2Selector) return inserts;

    // Suggest FAQ if no question headings exist
    var allHeadings = [];
    ["h1", "h2", "h3", "h4"].forEach(function (tag) {
      (headings[tag] || []).forEach(function (h) { allHeadings.push(h.text); });
    });
    var questionCount = allHeadings.filter(function (t) {
      return /\?$/.test(t) || /^(what|why|how|when|where|who|which)\s/i.test(t);
    }).length;

    if (questionCount === 0 && content.word_count > 300) {
      inserts.push({
        type: "faq",
        afterSelector: lastH2Selector,
        reason: "No question-based headings found. An FAQ section improves AI engine visibility.",
        severity: "info"
      });
    }

    // Suggest table if comparison keywords found but no tables
    var tables = content.tables || [];
    var hasComparison = /\b(vs\.?|versus|compared? to|difference between|comparison)\b/i.test(fullText);
    if (tables.length === 0 && hasComparison) {
      inserts.push({
        type: "table",
        afterSelector: lastH2Selector,
        reason: "Content has comparison language but no data tables. A table improves scannability.",
        severity: "info"
      });
    }

    // Suggest definition if technical terms likely present but no definition lists
    var hasDefinitions = fullText.indexOf("defined as") !== -1 ||
                         fullText.indexOf("refers to") !== -1 ||
                         fullText.indexOf("meaning of") !== -1;
    if (hasDefinitions) {
      inserts.push({
        type: "definition",
        afterSelector: lastH2Selector,
        reason: "Content defines terms inline. A structured definition block aids AI extraction.",
        severity: "info"
      });
    }

    // Suggest TL;DR if no summary/key-takeaways heading
    var hasSummary = allHeadings.some(function(t) {
      return /\b(tl;?dr|key takeaways?|summary|quick answer|in brief|overview|highlights?)\b/i.test(t);
    });
    if (!hasSummary && content.word_count > 400) {
      inserts.push({
        type: "key-takeaways",
        afterSelector: lastH2Selector,
        reason: "No Key Takeaways or TL;DR section found. Summary boxes are extracted by Google AIO as quick-answer blocks. Add before the first H2.",
        severity: "info"
      });
    }

    // Suggest conclusion if no conclusion heading
    var hasConclusion = allHeadings.some(function(t) {
      return /\b(conclusion|final thoughts?|wrap\s*up|summary|closing|next steps?)\b/i.test(t);
    });
    if (!hasConclusion && content.word_count > 500) {
      inserts.push({
        type: "conclusion",
        afterSelector: lastH2Selector,
        reason: "No conclusion section found. Semantic closure signals complete, authoritative content to AI engines \u2014 restate the primary answer and add a next step.",
        severity: "info"
      });
    }

    // ── no_examples ──
    var hasExamples = /\bfor example[:\s]|\be\.g\.[,\s]|\bsuch as[:\s]|\bfor instance[:\s]/i.test(fullText);
    if (!hasExamples && content.word_count > 300) {
      inserts.push({
        type: "no_examples",
        afterSelector: lastH2Selector,
        reason: "No concrete examples found. Pages with real-world examples are cited 1.9\u00D7 more by AI engines than abstract-only content. Add 'For example:' or 'e.g.' to at least 2 key claims.",
        severity: "info"
      });
    }

    // ── no_pros_cons_sections ──
    var hasProscons = allHeadings.some(function(t) {
      return /^(pros?|cons?|advantages?|disadvantages?|drawbacks?|benefits? and drawbacks?|pros? and cons?)\b/i.test(t);
    });
    var hasComparisonLanguage = /\bvs\.?\b|\bversus\b|\bcompared? to\b|\bdifference between\b/i.test(fullText);
    if (!hasProscons && hasComparisonLanguage && content.word_count > 300) {
      inserts.push({
        type: "no_pros_cons",
        afterSelector: lastH2Selector,
        reason: "Comparison language found but no Pros/Cons section. Structured pros/cons match AI query patterns for 'should I use X' and appear in AI comparison cards.",
        severity: "info"
      });
    }

    // ── no_update_date ── (separate from publish date — checks for dateModified)
    var jsonLdBlocks = document.querySelectorAll("script[type=\"application/ld+json\"]");
    var hasDateModified = false;
    for (var ji = 0; ji < jsonLdBlocks.length; ji++) {
      try {
        var ld = JSON.parse(jsonLdBlocks[ji].textContent || "{}");
        if (ld.dateModified || (ld["@graph"] && ld["@graph"].some(function(n) { return n.dateModified; }))) {
          hasDateModified = true; break;
        }
      } catch (e) { /* ignore malformed JSON-LD */ }
    }
    var hasUpdatedText = /\b(last updated|updated on|last modified|updated:)\b/i.test(fullText);
    if (!hasDateModified && !hasUpdatedText) {
      inserts.push({
        type: "no_update_date",
        afterSelector: lastH2Selector,
        reason: "No dateModified signal found. 76.4% of ChatGPT top-cited pages were updated within 30 days. Add dateModified to Article JSON-LD and a visible 'Last updated' date to signal freshness.",
        severity: "info"
      });
    }

    // ── multiple_canonical ── (SEO error — check DOM directly)
    var canonicals = document.querySelectorAll("link[rel=\"canonical\"]");
    if (canonicals.length > 1) {
      inserts.push({
        type: "multiple_canonical",
        afterSelector: null,
        reason: "Multiple canonical tags detected (" + canonicals.length + "). Conflicting canonicals cause Google to ignore both. Keep exactly one <link rel=\"canonical\"> in <head>.",
        severity: "error"
      });
    }

    // ── excessive_external_links ──
    var externalLinks = pageData.links ? (pageData.links.external || []) : [];
    if (externalLinks.length > 50) {
      inserts.push({
        type: "excessive_external_links",
        afterSelector: null,
        reason: externalLinks.length + " external links detected. Excess outbound links dilute PageRank and can trigger spam signals. Keep external links under 50 per page and use rel=\"nofollow\" on low-value links.",
        severity: "warning"
      });
    }

    return inserts;
  }

  // ─── GENERATE DETERMINISTIC GEO SUGGESTIONS ───────────────

  _generateGEOSuggestions(annotations, geoResult, pageData) {
    if (typeof GEO_SUGGESTION_TEMPLATES === "undefined") return;

    var geoIssues = geoResult.issues || [];
    var content = pageData.content || {};
    var paragraphs = content.paragraphs || [];

    for (var gi = 0; gi < geoIssues.length; gi++) {
      var issue = geoIssues[gi];
      var code = issue.code;
      if (!code) continue;

      var templateFn = GEO_SUGGESTION_TEMPLATES[code];
      if (!templateFn) continue;

      // Build context for the template — include real page data for context-aware suggestions
      var ctx = {
        quote: null,
        pageTitle: (pageData.meta && pageData.meta.title) || "",
        h1Text: (pageData.headings && pageData.headings.h1 && pageData.headings.h1[0])
                ? (pageData.headings.h1[0].text || "") : "",
        domain: pageData.domain || "",
        primaryKeyword: (pageData.enrichment && pageData.enrichment.primary_keyword) || ""
      };

      // Add context-specific data
      if (code === "no_direct_opening" && paragraphs.length > 0) {
        var fp = paragraphs[0];
        ctx.quote = (fp.text || "").substring(0, 80);
        ctx.wordCount = fp.word_count || 0;
      }
      if (code === "heading_generic" || code === "heading_not_question") {
        // Find matching annotation to get the heading text
        for (var ai = 0; ai < annotations.length; ai++) {
          if (annotations[ai].elementType === "heading") {
            var annIssues = annotations[ai].issues || [];
            for (var ii = 0; ii < annIssues.length; ii++) {
              if (annIssues[ii].code === code) {
                ctx.quote = (annIssues[ii].message.match(/"([^"]+)"/) || [])[1] || "";
                break;
              }
            }
          }
        }
      }
      if (code === "stats_without_sources" && paragraphs.length > 0) {
        // Find a paragraph making claims without data
        for (var pi = 0; pi < paragraphs.length; pi++) {
          var pText = paragraphs[pi].text || "";
          var pWords = paragraphs[pi].word_count || 0;
          if (pWords > 30 && !/\d+%|\$[\d,.]+|\d{4}|according to/i.test(pText)) {
            ctx.quote = pText.substring(0, 80);
            break;
          }
        }
      }

      if (code === "paragraph_claim_without_data" && paragraphs.length > 0) {
        for (var pi2 = 0; pi2 < paragraphs.length; pi2++) {
          var pText2 = paragraphs[pi2].text || "";
          var claimPat = /\b(increases?|improves?|reduces?|boosts?|decreases?|shows?|demonstrates?|proves?|suggests?|leads? to|results? in|causes?|helps?)\b/i;
          var dataPat = /\d+%|\$[\d,.]+|\d{4}|according to|study|research|survey|report/i;
          if ((paragraphs[pi2].word_count || 0) >= 50 && claimPat.test(pText2) && !dataPat.test(pText2)) {
            ctx.quote = pText2.substring(0, 70);
            break;
          }
        }
      }

      var suggestion = templateFn(issue, ctx);
      if (!suggestion) continue;

      // Enrich the GEO issue itself with the template suggestion for panel display
      geoIssues[gi].suggestion = suggestion;

      // Attach GEO suggestion to the closest relevant annotation or create new
      var attached = false;

      // Try to match by element type
      if (code === "no_direct_opening" && paragraphs.length > 0 && paragraphs[0].selector) {
        for (var ai = 0; ai < annotations.length; ai++) {
          if (annotations[ai].selector === paragraphs[0].selector) {
            annotations[ai].suggestion = suggestion;
            attached = true;
            break;
          }
        }
      }

      // For heading-related codes, attach to relevant heading annotations
      if (!attached && (code === "heading_generic" || code === "heading_not_question")) {
        for (var ai = 0; ai < annotations.length; ai++) {
          if (annotations[ai].elementType === "heading") {
            var annIssues = annotations[ai].issues || [];
            for (var ii = 0; ii < annIssues.length; ii++) {
              if (annIssues[ii].code === code && !annotations[ai].suggestion) {
                annotations[ai].suggestion = suggestion;
                attached = true;
                break;
              }
            }
            if (attached) break;
          }
        }
      }

      // Don't create standalone annotations for page-level GEO suggestions
      // They are shown in the panel's GEO issues list instead
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────

  _worstSeverity(issues) {
    if (!issues || issues.length === 0) return "good";
    var order = { error: 0, warning: 1, info: 2, good: 3 };
    var worst = 3;
    for (var i = 0; i < issues.length; i++) {
      var val = order[issues[i].severity];
      if (val !== undefined && val < worst) worst = val;
    }
    var names = ["error", "warning", "info", "good"];
    return names[worst];
  }

  _estimateSyllables(text) {
    var words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length <= 3) { total += 1; continue; }
      w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
      w = w.replace(/^y/, "");
      var vowelGroups = w.match(/[aeiouy]{1,2}/g);
      total += (vowelGroups ? vowelGroups.length : 1);
    }
    return total;
  }
}
