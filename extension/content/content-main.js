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
   *  3. Score SEO client-side
   *  4. Send results to service worker immediately
   *  5. Request backend GEO scoring (async)
   *  6. Merge results when backend responds
   *  7. Show overlays
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
      // Step 1: Extract DOM data (SmartExtractor returns a Promise)
      var pageData = await extractor.extract();

      // Step 2: Readability analysis
      var readability = readabilityScorer.analyze(
        pageData.content.full_text
      );

      // Step 3: Client-side SEO scoring
      var seoResult = seoScorer.score(pageData, readability);

      // Build initial analysis object
      var analysis = {
        url: pageData.url,
        domain: pageData.domain,
        timestamp: pageData.timestamp,
        seo: seoResult,
        geo: null,
        combined: null,
        readability: readability,
        page_data: pageData,
        suggestions: []
      };

      // Calculate initial combined score (SEO only until GEO arrives)
      analysis.combined = calculateCombinedScore(
        seoResult.normalized_score,
        null
      );

      // Store as last analysis
      lastAnalysis = analysis;

      // Step 4: Show overlays immediately with SEO-only results
      showOverlays(analysis);

      // Step 5: Send to service worker for backend GEO scoring (fire and forget)
      try {
        chrome.runtime.sendMessage(
          {
            type: MSG.ANALYZE_PAGE,
            data: {
              url: pageData.url,
              meta: pageData.meta || {},
              headings: pageData.headings || {},
              content: {
                full_text: ((pageData.content && pageData.content.full_text) || "").substring(0, 50000),
                word_count: (pageData.content && pageData.content.word_count) || 0,
                paragraph_count: (pageData.content && pageData.content.paragraph_count) || 0,
                sentence_count: (pageData.content && pageData.content.sentence_count) || 0
              },
              structured_data: pageData.structured_data || {},
              links: {
                internal_count: (pageData.links && pageData.links.internal_count) || 0,
                external_count: (pageData.links && pageData.links.external_count) || 0
              },
              readability: readability || {}
            }
          },
          function (response) {
            if (chrome.runtime.lastError) {
              // Service worker may not be ready — ignore
              return;
            }
            if (response && typeof response.geo_score === "number") {
              // Merge GEO results from backend
              lastAnalysis.geo = {
                normalized_score: response.geo_score,
                categories: response.geo_categories || {},
                issues: response.geo_issues || []
              };
              lastAnalysis.suggestions = response.suggestions || [];
              lastAnalysis.combined = calculateCombinedScore(
                seoResult.normalized_score,
                response.geo_score
              );
              // Re-render overlays with full data
              showOverlays(lastAnalysis);

              // Broadcast updated scores with GEO data to popup
              try {
                chrome.runtime.sendMessage({
                  type: "SCORES_READY",
                  data: {
                    seo_score: seoResult.normalized_score,
                    geo_score: response.geo_score,
                    combined_score: lastAnalysis.combined,
                    issues: (seoResult.issues || []).concat(response.geo_issues || []),
                    suggestions: response.suggestions || []
                  }
                });
              } catch (e) {
                // Ignore
              }
            }
          }
        );
      } catch (e) {
        // Service worker communication failed — continue with SEO-only results
      }

      // Step 6: Broadcast scores to service worker for popup access
      var scoresData = {
        seo_score: seoResult.normalized_score,
        geo_score: null,
        combined_score: analysis.combined,
        issues: seoResult.issues || [],
        suggestions: [],
        page_data: pageData
      };
      try {
        chrome.runtime.sendMessage({
          type: "SCORES_READY",
          data: scoresData
        });
      } catch (e) {
        // Ignore
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

    // AI Suggestions
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      lines.push(
        "--- AI Suggestions (" + analysis.suggestions.length + ") ---"
      );
      analysis.suggestions.forEach(function (s, idx) {
        lines.push((idx + 1) + ". " + (s.reason || "Suggestion"));
        if (s.original) lines.push("   Original: " + s.original);
        if (s.suggested) lines.push("   Suggested: " + s.suggested);
        lines.push("");
      });
    }

    lines.push("=== End of Report ===");

    return lines.join("\n");
  }
})();
