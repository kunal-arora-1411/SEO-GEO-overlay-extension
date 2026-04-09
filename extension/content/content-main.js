// ═══════════════════════════════════════════════════════════════
// CONTENT SCRIPT ORCHESTRATOR
// Coordinates extraction, scoring, overlay rendering, and
// communication with the service worker / popup
// ═══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  var domExtractor = new DOMExtractor();
  var adapterRegistry = new SiteAdapterRegistry();
  var extractor = new SmartExtractor(domExtractor, adapterRegistry);
  var readabilityScorer = new ReadabilityScorer();
  var seoScorer = new ClientSEOScorer();
  var geoScorer = new ClientGEOScorer();
  var overlayManager = null;
  var lastAnalysis = null;
  var isAnalyzing = false;

  // SPA route change handler: re-run analysis when the URL changes
  extractor.onRouteChange = function (newUrl) {
    // Clear adapter cache so CMS detection runs fresh for the new page
    adapterRegistry.clearCache();

    // Small delay to allow the new page content to render
    setTimeout(function () {
      if (!isAnalyzing) {
        runAnalysis().catch(function () {
          // Silently handle analysis errors on route change
        });
      }
    }, 300);
  };

  // ─── MESSAGE LISTENER ───────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    switch (message.type) {
      case MSG.ANALYZE_PAGE:
        runAnalysis()
          .then(function (result) {
            sendResponse(result);
          })
          .catch(function (err) {
            sendResponse({
              success: false,
              error: err.message || String(err)
            });
          });
        // Return true to keep the message channel open for async response
        return true;

      case MSG.SHOW_OVERLAYS:
        if (lastAnalysis) {
          showOverlays(lastAnalysis);
        }
        sendResponse({ success: true });
        break;

      case MSG.EXPORT_SUGGESTIONS:
        if (lastAnalysis) {
          sendResponse({
            success: true,
            text: exportSuggestionsAsText(lastAnalysis)
          });
        } else {
          sendResponse({
            success: false,
            error: "No analysis results available. Run an analysis first."
          });
        }
        break;

      default:
        break;
    }
  });

  // ─── ANALYSIS PIPELINE ──────────────────────────────────────

  /**
   * Run the full analysis pipeline:
   *  1. Extract DOM data
   *  2. Calculate readability metrics
   *  3. Score SEO client-side (instant)
   *  4. Score GEO client-side (instant)
   *  5. Show overlays immediately with full SEO + GEO results
   *  6. Broadcast scores to popup (no "pending" state)
   *  7. Request keyword enrichment from backend (optional, fire-and-forget)
   */
  async function runAnalysis() {
    if (isAnalyzing) {
      return {
        success: false,
        error: "Analysis already in progress."
      };
    }

    isAnalyzing = true;

    try {
      // Step 1: Extract DOM data
      var pageData = await extractor.extract();

      // Step 2: Readability analysis
      var readability = readabilityScorer.analyze(
        pageData.content.full_text
      );

      // Step 3: Client-side SEO scoring (instant, no network)
      var seoResult = seoScorer.score(pageData, readability);

      // Step 4: Client-side GEO scoring (instant, no network)
      var geoResult = geoScorer.score(pageData, readability);

      // Build full analysis object immediately — both SEO and GEO are available
      var analysis = {
        url: pageData.url,
        domain: pageData.domain,
        timestamp: pageData.timestamp,
        seo: seoResult,
        geo: {
          normalized_score: geoResult.normalized_score,
          categories: geoResult.categories,
          issues: geoResult.issues
        },
        combined: null,
        readability: readability,
        page_data: pageData,
        suggestions: []
      };

      // Calculate combined score — both SEO and GEO are instantly available
      analysis.combined = calculateCombinedScore(
        seoResult.normalized_score,
        geoResult.normalized_score
      );

      // Store as last analysis
      lastAnalysis = analysis;

      // Step 5: Show overlays immediately with full data — no re-render needed
      showOverlays(analysis);

      // Step 6: Broadcast full scores to service worker for popup access
      var scoresData = {
        seo_score: seoResult.normalized_score,
        geo_score: geoResult.normalized_score,
        combined_score: analysis.combined,
        issues: (seoResult.issues || []).concat(geoResult.issues || []),
        suggestions: geoResult.issues || []   // GEO issues are the optimization suggestions
      };
      try {
        chrome.runtime.sendMessage({
          type: "SCORES_READY",
          data: scoresData
        });
      } catch (e) {
        // Ignore — popup may not be open
      }

      // Step 7: Optional backend enrichment (keyword/intent + LLM features) — fire and forget
      // Sends only minimal data, enriches keyword-aware SEO checks and optional LLM features
      try {
        var h1Text = pageData.headings && pageData.headings.h1 && pageData.headings.h1.length > 0
          ? pageData.headings.h1[0].text : "";
        var h2Texts = (pageData.headings && pageData.headings.h2 || []).map(function (h) { return h.text; });
        var contentExcerpt = ((pageData.content && pageData.content.full_text) || "").substring(0, 1200);

        // Collect GEO issue codes to tell backend which optional LLM features are needed
        var geoIssueCodes = (geoResult.issues || []).map(function (i) { return i.code; });
        var wantsFaq = geoIssueCodes.indexOf("no_faq_section") !== -1;
        var wantsMeta = (seoResult.issues || []).some(function (i) {
          return i.element === "meta_description" || i.code === "meta_missing" || i.code === "meta_too_short";
        });
        var wantsAnswerability = geoResult.normalized_score < 60;
        var wantsSummary = geoIssueCodes.indexOf("no_direct_opening") !== -1 || geoResult.normalized_score < 50;
        var wantsHeadings = geoIssueCodes.indexOf("heading_generic") !== -1 ||
          geoIssueCodes.indexOf("heading_not_question") !== -1;

        chrome.runtime.sendMessage(
          {
            type: MSG.ENRICH_PAGE,
            data: {
              url: pageData.url,
              title: (pageData.meta && pageData.meta.title) || "",
              h1: h1Text,
              h2s: h2Texts.slice(0, 10),
              content_excerpt: contentExcerpt,
              word_count: (pageData.content && pageData.content.word_count) || 0,
              geo_issues: geoIssueCodes,
              include_faq: wantsFaq,
              include_meta_suggestion: wantsMeta,
              include_answerability: wantsAnswerability,
              include_summary: wantsSummary,
              include_heading_optimization: wantsHeadings
            }
          },
          function (response) {
            if (chrome.runtime.lastError || !response || response.error) {
              // Backend unavailable — extension already has full results, ignore
              return;
            }
            // Enrichment adds keyword context and LLM suggestions — store and notify popup
            lastAnalysis.enrichment = {
              intent: response.intent,
              primary_keyword: response.primary_keyword,
              lsi_keywords: response.lsi_keywords || [],
              keyword_density: response.keyword_density || 0,
              faq_suggestions: response.faq_suggestions || null,
              meta_description_suggestion: response.meta_description_suggestion || null,
              answerability_score: response.answerability_score != null ? response.answerability_score : null,
              answerability_gaps: response.answerability_gaps || null,
              summary_points: response.summary_points || null,
              heading_suggestions: response.heading_suggestions || null
            };
            // Notify popup that enrichment is available so it can update display
            try {
              chrome.runtime.sendMessage({
                type: "ENRICHMENT_READY",
                data: lastAnalysis.enrichment
              });
            } catch (e) {
              // Popup not open — ignore
            }
          }
        );
      } catch (e) {
        // Backend unavailable — extension works fully offline
      }

      isAnalyzing = false;

      return scoresData;
    } catch (err) {
      isAnalyzing = false;
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }

  // ─── COMBINED SCORE CALCULATION ─────────────────────────────

  /**
   * Calculate weighted combined score from SEO and GEO scores.
   * @param {number} seoScore — normalized SEO score (0-100)
   * @param {number|null} geoScore — normalized GEO score (0-100) or null
   * @returns {Object} { score, grade, has_geo }
   */
  function calculateCombinedScore(seoScore, geoScore) {
    var config = SCORING_CONFIG.combined;
    var combinedScore;
    var hasGeo = geoScore !== null && geoScore !== undefined;

    if (hasGeo) {
      combinedScore = Math.round(
        seoScore * config.seo_weight + geoScore * config.geo_weight
      );
    } else {
      // GEO not available yet — use SEO score alone
      combinedScore = Math.round(seoScore);
    }

    // Clamp to 0-100
    combinedScore = Math.max(0, Math.min(100, combinedScore));

    return {
      score: combinedScore,
      grade: Utils.getGrade(combinedScore),
      has_geo: hasGeo
    };
  }

  // ─── OVERLAY RENDERING ──────────────────────────────────────

  /**
   * Lazy-initialize the OverlayManager and render the analysis.
   */
  function showOverlays(analysis) {
    if (!overlayManager) {
      overlayManager = new OverlayManager();
    }
    overlayManager.render(analysis);
  }

  // ─── KEYBOARD SHORTCUT ─────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    // Ctrl+Shift+O: Toggle inline overlays
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "O" || e.key === "o")) {
      e.preventDefault();
      if (overlayManager) {
        overlayManager.toggleOverlays();
      }
    }
  });

  // ─── EXPORT ──────────────────────────────────────────────────

  /**
   * Format analysis results as plain text for export / clipboard.
   */
  function exportSuggestionsAsText(analysis) {
    var lines = [];

    lines.push("=== SEO & GEO Optimizer Report ===");
    lines.push("URL: " + analysis.url);
    lines.push("Date: " + analysis.timestamp);
    lines.push("");

    // Scores
    lines.push("--- Scores ---");
    if (analysis.seo) {
      lines.push(
        "SEO Score: " +
          analysis.seo.normalized_score +
          "/100 (Grade: " +
          analysis.seo.grade +
          ")"
      );
    }
    if (analysis.geo) {
      lines.push(
        "GEO Score: " +
          (analysis.geo.normalized_score || "N/A") +
          "/100"
      );
    }
    if (analysis.combined) {
      lines.push(
        "Combined: " +
          analysis.combined.score +
          "/100 (Grade: " +
          analysis.combined.grade +
          ")"
      );
    }
    lines.push("");

    // Readability
    if (analysis.readability) {
      lines.push("--- Readability ---");
      lines.push(
        "Flesch Reading Ease: " + analysis.readability.flesch_reading_ease
      );
      lines.push(
        "Flesch-Kincaid Grade: " +
          analysis.readability.flesch_kincaid_grade
      );
      lines.push("SMOG Index: " + analysis.readability.smog_index);
      lines.push(
        "Word Count: " + analysis.readability.stats.word_count
      );
      lines.push(
        "Sentence Count: " + analysis.readability.stats.sentence_count
      );
      lines.push("");
    }

    // Issues
    if (analysis.seo && analysis.seo.issues.length > 0) {
      lines.push("--- Issues (" + analysis.seo.issues.length + ") ---");
      analysis.seo.issues.forEach(function (issue, idx) {
        var prefix =
          "[" + issue.type.toUpperCase() + "] (Impact: " +
          issue.impact + "/10)";
        lines.push((idx + 1) + ". " + prefix + " " + issue.message);
      });
      lines.push("");
    }

    // GEO Issues as Optimization Suggestions
    var geoIssues = analysis.geo ? (analysis.geo.issues || []) : [];
    if (geoIssues.length > 0) {
      lines.push(
        "--- Optimization Suggestions (" + geoIssues.length + ") ---"
      );
      geoIssues.forEach(function (issue, idx) {
        var prefix = "[" + (issue.type || "info").toUpperCase() + "] (Impact: " + (issue.impact || 0) + "/10)";
        lines.push((idx + 1) + ". " + prefix + " " + (issue.message || ""));
        lines.push("");
      });
    }

    lines.push("=== End of Report ===");

    return lines.join("\n");
  }
})();
