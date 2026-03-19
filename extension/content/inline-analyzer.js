// ═══════════════════════════════════════════════════════════════
// INLINE ANALYZER
// Bridges extraction data (with CSS selectors) to per-element
// annotations for inline overlay rendering.
// ═══════════════════════════════════════════════════════════════

class InlineAnalyzer {
  constructor() {
    this._maxAnnotations = 60;
  }

  /**
   * Analyze page data and produce per-element annotations.
   * @param {Object} pageData  — DOMExtractor.extract() output
   * @param {Object} seoResult — ClientSEOScorer.score() output
   * @param {Object} readability — ReadabilityScorer.analyze() output
   * @param {Array}  suggestions — Backend AI suggestions (optional)
   * @returns {Object} { annotations, metaBar, structuralInserts, stats }
   */
  analyze(pageData, seoResult, readability, suggestions) {
    var annotations = [];

    // Per-element analysis
    annotations = annotations.concat(this._analyzeHeadings(pageData.headings));
    annotations = annotations.concat(this._analyzeParagraphs(pageData.content));
    annotations = annotations.concat(this._analyzeLinks(pageData.links));
    annotations = annotations.concat(this._analyzeImages(pageData.images));

    // Merge backend AI suggestions
    if (suggestions && suggestions.length > 0) {
      this._mergeBackendSuggestions(annotations, suggestions);
    }

    // Sort: errors first, then warnings, then info, then good
    var severityOrder = { error: 0, warning: 1, info: 2, good: 3 };
    annotations.sort(function (a, b) {
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
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
            fix: "Replace with a specific, descriptive heading relevant to the content.",
            impact: 6
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
            message: "Not phrased as a question. Question headings improve AI snippet eligibility.",
            fix: "Try rephrasing as: \"What is " + text.toLowerCase().replace(/[?.]$/, "") + "?\"",
            impact: 3
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
            fix: null,
            impact: 4
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
          fix: "Add alt=\"description of the image\" to this <img> tag.",
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

      // Only annotate images with issues
      if (issues.length === 0) continue;

      annotations.push({
        id: "ann-img-" + i,
        selector: img.selector,
        elementType: "image",
        tagName: "img",
        severity: this._worstSeverity(issues),
        issues: issues,
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

    return inserts;
  }

  // ─── MERGE BACKEND SUGGESTIONS ─────────────────────────────

  _mergeBackendSuggestions(annotations, suggestions) {
    for (var si = 0; si < suggestions.length; si++) {
      var sug = suggestions[si];
      if (!sug.selector) continue;

      var matched = false;
      for (var ai = 0; ai < annotations.length; ai++) {
        if (annotations[ai].selector === sug.selector) {
          annotations[ai].suggestion = {
            original: sug.original || "",
            suggested: sug.suggested || sug.suggestion || "",
            reason: sug.reason || ""
          };
          matched = true;
          break;
        }
      }

      // If no existing annotation matched, create one
      if (!matched) {
        annotations.push({
          id: "ann-ai-" + si,
          selector: sug.selector,
          elementType: sug.type || "paragraph",
          tagName: sug.type === "heading" ? "h2" : "p",
          severity: "info",
          issues: [],
          metrics: null,
          suggestion: {
            original: sug.original || "",
            suggested: sug.suggested || sug.suggestion || "",
            reason: sug.reason || ""
          },
          dismissed: false
        });
      }
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
