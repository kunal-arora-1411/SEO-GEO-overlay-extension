// ═══════════════════════════════════════════════════════════════
// CLIENT-SIDE SEO SCORER
// Implements all 7 scoring categories using SCORING_CONFIG.seo
// Runs entirely in the content script (no network required)
// ═══════════════════════════════════════════════════════════════

class ClientSEOScorer {
  constructor() {
    this.config = SCORING_CONFIG.seo;
  }

  /**
   * Score a full page extraction.
   * @param {Object} data — output of DOMExtractor.extract()
   * @param {Object} readability — output of ReadabilityScorer.analyze()
   * @returns {Object} { score, max_score, normalized_score, grade, categories, issues }
   */
  score(data, readability) {
    var categories = {
      title: this._scoreTitle(data.meta),
      meta_description: this._scoreMetaDescription(data.meta),
      headings: this._scoreHeadings(data.headings),
      content: this._scoreContent(data.content, readability),
      technical: this._scoreTechnical(data),
      links: this._scoreLinks(data.links, data.content.word_count),
      ux: this._scoreUX(data)
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

    // Sort all issues by impact descending
    allIssues.sort(function (a, b) {
      return b.impact - a.impact;
    });

    var normalizedScore =
      totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    return {
      score: totalScore,
      max_score: totalMax,
      normalized_score: normalizedScore,
      grade: Utils.getGrade(normalizedScore),
      categories: categories,
      issues: allIssues
    };
  }

  // ─── TITLE (15 pts) ──────────────────────────────────────────

  _scoreTitle(meta) {
    var rules = this.config.title.rules;
    var score = 0;
    var maxScore = this.config.title.weight_total;
    var issues = [];

    // exists (3 pts)
    if (meta.title && meta.title.trim().length > 0) {
      score += rules.exists.weight;
    } else {
      issues.push(this._issue(
        "error", 10, "title",
        "Page is missing a title tag.",
        "add_title"
      ));
      // Nothing else to check
      return { score: score, max_score: maxScore, issues: issues };
    }

    var title = meta.title.trim();
    var titleLen = title.length;

    // length (4 pts) — optimal 40-60
    if (titleLen >= rules.length.min && titleLen <= rules.length.max) {
      score += rules.length.weight;
    } else if (titleLen > 0 && titleLen < rules.length.min) {
      score += Math.round(rules.length.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 7, "title",
        "Title is too short (" + titleLen + " chars). Aim for " +
          rules.length.min + "-" + rules.length.max + " characters.",
        "rewrite_title"
      ));
    } else if (titleLen > rules.length.max) {
      score += Math.round(rules.length.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 7, "title",
        "Title is too long (" + titleLen + " chars). Aim for " +
          rules.length.min + "-" + rules.length.max + " characters.",
        "rewrite_title"
      ));
    }

    // uniqueness (2 pts) — not a generic pattern
    var isGeneric = rules.uniqueness.generic_patterns.some(function (rx) {
      return rx.test(title);
    });
    if (!isGeneric) {
      score += rules.uniqueness.weight;
    } else {
      issues.push(this._issue(
        "error", 8, "title",
        "Title looks generic (\"" + Utils.truncate(title, 40) +
          "\"). Use a unique, descriptive title.",
        "rewrite_title"
      ));
    }

    // modifier (1 pt) — contains a year, "guide", "best", etc.
    var titleLower = title.toLowerCase();
    var hasModifier = rules.modifier.modifiers.some(function (mod) {
      return titleLower.indexOf(mod.toLowerCase()) !== -1;
    });
    if (hasModifier) {
      score += rules.modifier.weight;
    } else {
      issues.push(this._issue(
        "info", 3, "title",
        "Consider adding a modifier word (e.g. \"" +
          rules.modifier.modifiers.slice(0, 3).join("\", \"") +
          "\") to the title for better CTR.",
        "rewrite_title"
      ));
    }

    // brand_position (2 pts)
    var hasSeparator = /\s[|–—-]\s/.test(title);
    if (hasSeparator) {
      // Brand likely at end — full points
      score += rules.brand_position.weight;
    } else {
      // No separator — give partial (1 pt)
      score += 1;
      issues.push(this._issue(
        "info", 2, "title",
        "Consider adding your brand name at the end of the title " +
          "separated by \"|\" or \"-\" (e.g. \"Page Title | Brand\")."
      ));
    }

    // keyword_position (3 pts) — give full points by default (MVP: no keyword context)
    score += rules.keyword_position.weight;

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── META DESCRIPTION (10 pts) ──────────────────────────────

  _scoreMetaDescription(meta) {
    var rules = this.config.meta_description.rules;
    var score = 0;
    var maxScore = this.config.meta_description.weight_total;
    var issues = [];

    var desc = meta.meta_description;

    // exists (3 pts)
    if (desc && desc.trim().length > 0) {
      score += rules.exists.weight;
    } else {
      issues.push(this._issue(
        "error", 9, "meta_description",
        "Page is missing a meta description.",
        "add_meta_description"
      ));
      return { score: score, max_score: maxScore, issues: issues };
    }

    desc = desc.trim();
    var descLen = desc.length;

    // length (3 pts) — optimal 120-160
    if (descLen >= rules.length.min && descLen <= rules.length.max) {
      score += rules.length.weight;
    } else if (descLen > 0 && descLen < rules.length.min) {
      score += Math.round(rules.length.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 6, "meta_description",
        "Meta description is too short (" + descLen +
          " chars). Aim for " + rules.length.min + "-" +
          rules.length.max + " characters.",
        "rewrite_meta_description"
      ));
    } else if (descLen > rules.length.max) {
      score += Math.round(rules.length.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 6, "meta_description",
        "Meta description is too long (" + descLen +
          " chars). It may be truncated in search results. Aim for " +
          rules.length.min + "-" + rules.length.max + " characters.",
        "rewrite_meta_description"
      ));
    }

    // contains_keyword (2 pts) — MVP: give full points (no keyword context yet)
    score += rules.contains_keyword.weight;

    // has_cta (1 pt) — description contains an action word
    var descLower = desc.toLowerCase();
    var hasCTA = rules.has_cta.cta_words.some(function (word) {
      return descLower.indexOf(word) !== -1;
    });
    if (hasCTA) {
      score += rules.has_cta.weight;
    } else {
      issues.push(this._issue(
        "info", 3, "meta_description",
        "Add a call-to-action word (e.g. \"" +
          rules.has_cta.cta_words.slice(0, 3).join("\", \"") +
          "\") to improve click-through rate.",
        "rewrite_meta_description"
      ));
    }

    // not_duplicate_title (1 pt)
    if (
      meta.title &&
      desc.toLowerCase() !== meta.title.toLowerCase()
    ) {
      score += rules.not_duplicate_title.weight;
    } else {
      issues.push(this._issue(
        "warning", 5, "meta_description",
        "Meta description is identical to the page title. " +
          "Write a unique description.",
        "rewrite_meta_description"
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── HEADINGS (15 pts) ──────────────────────────────────────

  _scoreHeadings(headings) {
    var rules = this.config.headings.rules;
    var score = 0;
    var maxScore = this.config.headings.weight_total;
    var issues = [];

    // single_h1 (4 pts)
    var h1Count = headings.h1.length;
    if (h1Count === 1) {
      score += rules.single_h1.weight;
    } else if (h1Count === 0) {
      issues.push(this._issue(
        "error", 9, "headings",
        "Page is missing an H1 heading.",
        "add_h1"
      ));
    } else {
      score += Math.round(rules.single_h1.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 7, "headings",
        "Page has " + h1Count + " H1 headings. Use exactly one H1.",
        "fix_headings"
      ));
    }

    // hierarchy_valid (4 pts) — heading levels should not skip (e.g. h1 → h3)
    var allLevels = [];
    for (var lvl = 1; lvl <= 6; lvl++) {
      var key = "h" + lvl;
      for (var j = 0; j < headings[key].length; j++) {
        allLevels.push(lvl);
      }
    }
    // We need to check by DOM order; the extract preserves per-level order.
    // Rebuild ordered list by walking each level and checking skips.
    var hierarchyValid = true;
    if (allLevels.length > 0) {
      // Collect all headings with their level in DOM order
      var ordered = [];
      var levels = ["h1", "h2", "h3", "h4", "h5", "h6"];
      levels.forEach(function (tag, idx) {
        headings[tag].forEach(function (h) {
          ordered.push({ level: idx + 1, text: h.text, selector: h.selector });
        });
      });
      // Sort by selector to approximate DOM order (selectors with lower indices come first)
      // Since we can't perfectly sort by DOM order from selectors alone,
      // just check that each level used is <= previous + 1
      // A simpler heuristic: check that no level is used without its parent level existing
      var usedLevels = new Set();
      levels.forEach(function (tag, idx) {
        if (headings[tag].length > 0) usedLevels.add(idx + 1);
      });
      for (var l = 2; l <= 6; l++) {
        if (usedLevels.has(l) && !usedLevels.has(l - 1)) {
          hierarchyValid = false;
          break;
        }
      }
    }

    if (hierarchyValid) {
      score += rules.hierarchy_valid.weight;
    } else {
      score += Math.round(rules.hierarchy_valid.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 6, "headings",
        "Heading hierarchy has gaps (e.g. skipping from H1 to H3). " +
          "Use a logical hierarchy.",
        "fix_headings"
      ));
    }

    // h2_count (3 pts) — between 2 and 8
    var h2Count = headings.h2.length;
    if (h2Count >= rules.h2_count.min && h2Count <= rules.h2_count.max) {
      score += rules.h2_count.weight;
    } else if (h2Count > 0) {
      score += Math.round(rules.h2_count.weight * 0.3 * 10) / 10;
      if (h2Count < rules.h2_count.min) {
        issues.push(this._issue(
          "warning", 5, "headings",
          "Only " + h2Count + " H2 heading(s). Aim for " +
            rules.h2_count.min + "-" + rules.h2_count.max +
            " to structure your content.",
          "add_headings"
        ));
      } else {
        issues.push(this._issue(
          "info", 3, "headings",
          "Page has " + h2Count + " H2 headings (recommended max: " +
            rules.h2_count.max +
            "). Consider consolidating sections."
        ));
      }
    } else {
      issues.push(this._issue(
        "warning", 6, "headings",
        "No H2 headings found. Add H2s to structure your content.",
        "add_headings"
      ));
    }

    // descriptive (2 pts) — headings should not be generic labels
    var genericCount = 0;
    var allHeadingTexts = [];
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach(function (tag) {
      headings[tag].forEach(function (h) {
        allHeadingTexts.push(h.text);
      });
    });

    allHeadingTexts.forEach(function (text) {
      var isGeneric = rules.descriptive.generic_labels.some(function (rx) {
        return rx.test(text.trim());
      });
      if (isGeneric) genericCount++;
    });

    if (allHeadingTexts.length > 0 && genericCount === 0) {
      score += rules.descriptive.weight;
    } else if (genericCount > 0) {
      score += Math.round(rules.descriptive.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 4, "headings",
        genericCount + " heading(s) use generic labels " +
          "(e.g. \"Introduction\", \"Section 1\"). " +
          "Use descriptive, keyword-rich headings.",
        "rewrite_headings"
      ));
    }

    // question_headings (2 pts) — at least 15% of headings phrased as questions
    if (allHeadingTexts.length > 0) {
      var questionCount = allHeadingTexts.filter(function (t) {
        return /\?$/.test(t.trim()) ||
               /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will)\s/i.test(t.trim());
      }).length;
      var questionPct = questionCount / allHeadingTexts.length;

      if (questionPct >= rules.question_headings.min_pct) {
        score += rules.question_headings.weight;
      } else if (questionCount > 0) {
        score += Math.round(rules.question_headings.weight * 0.3 * 10) / 10;
        issues.push(this._issue(
          "info", 3, "headings",
          "Only " + Math.round(questionPct * 100) +
            "% of headings are questions. Aim for at least " +
            Math.round(rules.question_headings.min_pct * 100) +
            "% to improve featured snippet eligibility.",
          "rewrite_headings"
        ));
      } else {
        issues.push(this._issue(
          "info", 3, "headings",
          "None of your headings are phrased as questions. " +
            "Question headings improve featured snippet eligibility.",
          "rewrite_headings"
        ));
      }
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── CONTENT (25 pts) ───────────────────────────────────────

  _scoreContent(content, readability) {
    var rules = this.config.content.rules;
    var score = 0;
    var maxScore = this.config.content.weight_total;
    var issues = [];

    var wordCount = content.word_count;
    var thresholds = rules.word_count.thresholds.default;

    // word_count (4 pts)
    if (
      wordCount >= thresholds.optimal_min &&
      wordCount <= thresholds.optimal_max
    ) {
      score += rules.word_count.weight;
    } else if (wordCount >= thresholds.min) {
      score += Math.round(rules.word_count.weight * 0.3 * 10) / 10;
      if (wordCount < thresholds.optimal_min) {
        issues.push(this._issue(
          "warning", 6, "content",
          "Content has " + wordCount + " words. Aim for at least " +
            thresholds.optimal_min + " words for better rankings."
        ));
      } else {
        issues.push(this._issue(
          "info", 3, "content",
          "Content has " + wordCount + " words. Consider being more " +
            "concise (optimal: " + thresholds.optimal_min + "-" +
            thresholds.optimal_max + ")."
        ));
      }
    } else {
      issues.push(this._issue(
        "error", 8, "content",
        "Content is very thin (" + wordCount + " words). " +
          "Minimum recommended: " + thresholds.min + " words."
      ));
    }

    // readability (5 pts) — based on Flesch-Kincaid grade
    if (readability && readability.flesch_kincaid_grade > 0) {
      var fkGrade = readability.flesch_kincaid_grade;
      var fre = readability.flesch_reading_ease;

      if (
        fkGrade >= rules.readability.fk_grade_min &&
        fkGrade <= rules.readability.fk_grade_max
      ) {
        score += rules.readability.weight;
      } else if (fkGrade > 0) {
        score += Math.round(rules.readability.weight * 0.3 * 10) / 10;
        if (fkGrade > rules.readability.fk_grade_max) {
          issues.push(this._issue(
            "warning", 6, "content",
            "Reading level is too advanced (grade " + fkGrade +
              "). Aim for grade " + rules.readability.fk_grade_min +
              "-" + rules.readability.fk_grade_max + "."
          ));
        } else {
          issues.push(this._issue(
            "info", 3, "content",
            "Reading level is very simple (grade " + fkGrade +
              "). Consider if your audience needs more depth."
          ));
        }
      }

      if (fre < rules.readability.fre_min) {
        issues.push(this._issue(
          "info", 4, "content",
          "Flesch Reading Ease is " + fre +
            " (target: " + rules.readability.fre_min + "-" +
            rules.readability.fre_max +
            "). Content may be hard to read."
        ));
      }
    }

    // paragraph_length (3 pts) — paragraphs should be <= max_sentences sentences
    if (content.paragraphs.length > 0) {
      var longParagraphs = 0;
      content.paragraphs.forEach(function (p) {
        var sentCount = p.text
          .split(/[.!?]+/)
          .filter(function (s) { return s.trim().length > 0; }).length;
        if (sentCount > rules.paragraph_length.max_sentences) {
          longParagraphs++;
        }
      });

      if (longParagraphs === 0) {
        score += rules.paragraph_length.weight;
      } else {
        score += Math.round(rules.paragraph_length.weight * 0.3 * 10) / 10;
        issues.push(this._issue(
          "warning", 5, "content",
          longParagraphs + " paragraph(s) exceed " +
            rules.paragraph_length.max_sentences +
            " sentences. Break long paragraphs into shorter ones."
        ));
      }
    }

    // sentence_length (3 pts) — average sentence should be <= max_words words
    if (readability && readability.stats.avg_sentence_length > 0) {
      if (readability.stats.avg_sentence_length <= rules.sentence_length.max_words) {
        score += rules.sentence_length.weight;
      } else {
        score += Math.round(rules.sentence_length.weight * 0.3 * 10) / 10;
        issues.push(this._issue(
          "warning", 5, "content",
          "Average sentence length is " +
            readability.stats.avg_sentence_length +
            " words. Aim for " + rules.sentence_length.max_words +
            " or fewer."
        ));
      }
    }

    // internal_links (3 pts)
    // This references links data — we get it from content indirectly.
    // The caller passes content which doesn't have links, so we check via
    // a rough heuristic: at least per_1000_words * (wordCount/1000) links expected.
    // We'll defer detailed link scoring to _scoreLinks; give partial here
    // based on list/paragraph presence as a proxy.
    // Actually, we don't have link counts here. Give full points and let
    // _scoreLinks handle link-specific scoring to avoid double-counting.
    score += rules.internal_links.weight;

    // external_links (2 pts) — same as above, deferred to _scoreLinks
    score += rules.external_links.weight;

    // image_optimization (3 pts) — deferred to image analysis if needed
    // For now, give full points; _scoreUX covers content quality signals
    score += rules.image_optimization.weight;

    // keyword_density (2 pts) — MVP: no keyword context, give full points
    score += rules.keyword_density.weight;

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── TECHNICAL (15 pts) ─────────────────────────────────────

  _scoreTechnical(data) {
    var rules = this.config.technical.rules;
    var score = 0;
    var maxScore = this.config.technical.weight_total;
    var issues = [];

    // canonical (3 pts)
    if (data.meta.canonical_url) {
      score += rules.canonical.weight;
    } else {
      issues.push(this._issue(
        "warning", 6, "technical",
        "Missing canonical URL. Add a <link rel=\"canonical\"> tag " +
          "to prevent duplicate content issues.",
        "add_canonical"
      ));
    }

    // viewport (2 pts)
    if (data.meta.viewport) {
      score += rules.viewport.weight;
    } else {
      issues.push(this._issue(
        "error", 8, "technical",
        "Missing viewport meta tag. Required for mobile responsiveness."
      ));
    }

    // open_graph (2 pts) — at least title and description
    if (data.meta.og.title && data.meta.og.description) {
      score += rules.open_graph.weight;
    } else if (data.meta.og.title || data.meta.og.description) {
      score += Math.round(rules.open_graph.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 4, "technical",
        "Incomplete Open Graph tags. Add both og:title and og:description.",
        "add_og_tags"
      ));
    } else {
      issues.push(this._issue(
        "warning", 5, "technical",
        "No Open Graph tags found. Add og:title, og:description, " +
          "and og:image for better social sharing.",
        "add_og_tags"
      ));
    }

    // schema_markup (4 pts)
    if (data.structured_data.has_structured_data) {
      score += rules.schema_markup.weight;
    } else {
      issues.push(this._issue(
        "warning", 7, "technical",
        "No structured data (JSON-LD or Microdata) found. " +
          "Add Schema.org markup for rich search results.",
        "add_schema"
      ));
    }

    // robots_meta (2 pts) — if present, should not block indexing
    var robots = data.meta.robots;
    if (robots) {
      var robotsLower = robots.toLowerCase();
      if (
        robotsLower.indexOf("noindex") === -1 &&
        robotsLower.indexOf("none") === -1
      ) {
        score += rules.robots_meta.weight;
      } else {
        issues.push(this._issue(
          "error", 10, "technical",
          "Robots meta tag contains \"noindex\". " +
            "This page will NOT appear in search results."
        ));
      }
    } else {
      // No robots tag — default is index,follow — fine
      score += rules.robots_meta.weight;
    }

    // page_language (1 pt)
    if (data.meta.language) {
      score += rules.page_language.weight;
    } else {
      issues.push(this._issue(
        "info", 3, "technical",
        "No lang attribute on <html>. Add lang=\"en\" " +
          "(or appropriate language code)."
      ));
    }

    // charset (1 pt)
    if (data.meta.charset) {
      score += rules.charset.weight;
    } else {
      issues.push(this._issue(
        "info", 2, "technical",
        "No charset declaration found. Add <meta charset=\"UTF-8\">."
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── LINKS (10 pts) ─────────────────────────────────────────

  _scoreLinks(links, wordCount) {
    var rules = this.config.links.rules;
    var score = 0;
    var maxScore = this.config.links.weight_total;
    var issues = [];

    // internal_count (3 pts) — minimum 3 internal links
    if (links.internal_count >= rules.internal_count.min) {
      score += rules.internal_count.weight;
    } else if (links.internal_count > 0) {
      score += Math.round(rules.internal_count.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 6, "links",
        "Only " + links.internal_count + " internal link(s). " +
          "Add at least " + rules.internal_count.min +
          " internal links to improve site navigation and SEO."
      ));
    } else {
      issues.push(this._issue(
        "error", 7, "links",
        "No internal links found. Internal linking is crucial for SEO."
      ));
    }

    // descriptive_anchors (3 pts) — anchor text should not be generic
    var badAnchors = 0;
    var totalAnchors = links.internal.length + links.external.length;

    var checkAnchor = function (link) {
      var text = link.text.trim();
      if (!text) return;
      var isBad = rules.descriptive_anchors.bad_anchors.some(function (rx) {
        return rx.test(text);
      });
      if (isBad) badAnchors++;
    };

    links.internal.forEach(checkAnchor);
    links.external.forEach(checkAnchor);

    if (totalAnchors > 0 && badAnchors === 0) {
      score += rules.descriptive_anchors.weight;
    } else if (badAnchors > 0) {
      score += Math.round(rules.descriptive_anchors.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "warning", 5, "links",
        badAnchors + " link(s) use generic anchor text " +
          "(e.g. \"click here\", \"read more\"). " +
          "Use descriptive anchor text.",
        "fix_anchors"
      ));
    } else {
      // No links at all — handled by internal_count
      score += rules.descriptive_anchors.weight;
    }

    // no_broken (2 pts) — we can't truly check broken links client-side,
    // so give full points; the backend can verify later.
    score += rules.no_broken.weight;

    // external_quality (2 pts) — has at least some external links
    if (links.external_count > 0) {
      score += rules.external_quality.weight;
    } else {
      score += Math.round(rules.external_quality.weight * 0.3 * 10) / 10;
      issues.push(this._issue(
        "info", 3, "links",
        "No external links found. Linking to authoritative sources " +
          "can boost credibility."
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── UX (10 pts) ────────────────────────────────────────────

  _scoreUX(data) {
    var rules = this.config.ux.rules;
    var score = 0;
    var maxScore = this.config.ux.weight_total;
    var issues = [];

    // cta_presence (3 pts)
    if (data.content.ctas && data.content.ctas.length > 0) {
      score += rules.cta_presence.weight;
    } else {
      issues.push(this._issue(
        "warning", 5, "ux",
        "No clear call-to-action found. Add buttons or CTA links " +
          "to guide user actions."
      ));
    }

    // content_above_fold (2 pts) — check if first paragraph exists
    // (proxy: if there are paragraphs, content likely starts above fold)
    if (data.content.paragraphs.length > 0) {
      score += rules.content_above_fold.weight;
    } else {
      issues.push(this._issue(
        "info", 3, "ux",
        "No substantive paragraph content detected above the fold."
      ));
    }

    // list_usage (2 pts) — lists improve scannability
    if (data.content.lists && data.content.lists.length > 0) {
      score += rules.list_usage.weight;
    } else {
      issues.push(this._issue(
        "info", 3, "ux",
        "No lists found. Bulleted or numbered lists improve readability " +
          "and scannability."
      ));
    }

    // table_usage (1 pt) — tables for data
    if (data.content.tables && data.content.tables.length > 0) {
      score += rules.table_usage.weight;
    } else {
      issues.push(this._issue(
        "info", 1, "ux",
        "No data tables found. Tables can help present " +
          "comparative data clearly."
      ));
    }

    // no_wall_of_text (2 pts) — no single text block > max_block_words words
    var hasWall = false;
    if (data.content.paragraphs) {
      for (var i = 0; i < data.content.paragraphs.length; i++) {
        if (data.content.paragraphs[i].word_count > rules.no_wall_of_text.max_block_words) {
          hasWall = true;
          break;
        }
      }
    }

    if (!hasWall) {
      score += rules.no_wall_of_text.weight;
    } else {
      issues.push(this._issue(
        "warning", 5, "ux",
        "Found a wall of text (paragraph with more than " +
          rules.no_wall_of_text.max_block_words +
          " words). Break up long text blocks for better readability."
      ));
    }

    return { score: score, max_score: maxScore, issues: issues };
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  /**
   * Create a standardized issue object.
   */
  _issue(type, impact, element, message, suggestionType) {
    var obj = {
      type: type,
      impact: impact,
      element: element,
      message: message
    };
    if (suggestionType) {
      obj.suggestion_type = suggestionType;
    }
    return obj;
  }
}
