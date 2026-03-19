// ═══════════════════════════════════════════════════════════════
// ANALYTICS COLLECTOR
// Batches client-side events and flushes to the backend
// ═══════════════════════════════════════════════════════════════

class AnalyticsCollector {
  constructor(options) {
    options = options || {};
    this._buffer = [];
    this._maxBufferSize = options.maxBufferSize || 50;
    this._flushIntervalMs = options.flushIntervalMs || 30000;
    this._apiBase = (typeof SCORING_CONFIG !== "undefined" && SCORING_CONFIG.api)
      ? SCORING_CONFIG.api.base_url
      : "http://localhost:8000";
    this._endpoint = this._apiBase + "/api/v1/analytics/events";
    this._flushTimer = null;
    this._sessionId = this._generateSessionId();
    this._startFlushTimer();
  }

  // ─── PUBLIC API ──────────────────────────────────────────

  /**
   * Track an analytics event.
   * @param {string} event — event name (e.g. "page_analyzed", "suggestion_accepted")
   * @param {Object} properties — event-specific data
   */
  track(event, properties) {
    this._buffer.push({
      event: event,
      properties: properties || {},
      session_id: this._sessionId,
      timestamp: new Date().toISOString(),
      url: (typeof window !== "undefined") ? window.location.href : null
    });

    if (this._buffer.length >= this._maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush all buffered events to the backend.
   */
  async flush() {
    if (this._buffer.length === 0) return;

    var events = this._buffer.splice(0);
    var token = null;

    // Try to get auth token
    try {
      var data = await new Promise(function (resolve) {
        chrome.storage.local.get(["auth_token"], resolve);
      });
      token = data.auth_token || null;
    } catch (e) {
      // Not in extension context — no token
    }

    var headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    try {
      var resp = await fetch(this._endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ events: events })
      });
      if (!resp.ok) {
        // Put events back if send failed
        this._buffer = events.concat(this._buffer);
        // Trim to max 2x buffer size to prevent unbounded growth
        if (this._buffer.length > this._maxBufferSize * 2) {
          this._buffer = this._buffer.slice(-this._maxBufferSize);
        }
      }
    } catch (e) {
      // Network error — put events back
      this._buffer = events.concat(this._buffer);
      if (this._buffer.length > this._maxBufferSize * 2) {
        this._buffer = this._buffer.slice(-this._maxBufferSize);
      }
    }
  }

  /**
   * Stop the flush timer and flush remaining events.
   */
  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this.flush();
  }

  // ─── CONVENIENCE METHODS ─────────────────────────────────

  trackPageAnalyzed(data) {
    this.track("page_analyzed", {
      url: data.url,
      domain: data.domain,
      seo_score: data.seo_score,
      geo_score: data.geo_score,
      combined_score: data.combined_score
    });
  }

  trackSuggestionAccepted(suggestion) {
    this.track("suggestion_accepted", {
      type: suggestion.type,
      element: suggestion.element,
      impact: suggestion.impact
    });
  }

  trackSuggestionCopied(suggestion) {
    this.track("suggestion_copied", {
      type: suggestion.type,
      element: suggestion.element
    });
  }

  trackSuggestionRejected(suggestion) {
    this.track("suggestion_rejected", {
      type: suggestion.type,
      element: suggestion.element
    });
  }

  trackOverlaysToggled(visible) {
    this.track("overlays_toggled", { visible: visible });
  }

  trackReportExported(format) {
    this.track("report_exported", { format: format || "text" });
  }

  // ─── INTERNAL ────────────────────────────────────────────

  _startFlushTimer() {
    var self = this;
    this._flushTimer = setInterval(function () {
      self.flush();
    }, this._flushIntervalMs);
  }

  _generateSessionId() {
    var arr = new Uint8Array(8);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 8; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(arr, function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }
}
