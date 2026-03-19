// ═══════════════════════════════════════════════════════════════
// SMART EXTRACTOR
// 3-strategy content extraction with SPA support and shadow DOM
// traversal. Wraps DOMExtractor for enhanced extraction.
// ═══════════════════════════════════════════════════════════════

class SmartExtractor {
  /**
   * @param {DOMExtractor} domExtractor — underlying extractor instance
   * @param {SiteAdapterRegistry} [adapterRegistry] — optional CMS adapter
   */
  constructor(domExtractor, adapterRegistry) {
    this._domExtractor = domExtractor;
    this._adapterRegistry = adapterRegistry || null;

    // SPA route change callback — set by consumer via onRouteChange setter
    this._onRouteChange = null;

    // Minimum word count to accept an extraction as complete
    this._minWordCount = 100;

    // MutationObserver settings
    this._mutationDebounceMs = 500;
    this._mutationTimeoutMs = 5000;

    // Internal state for SPA monitoring
    this._routeMonitorActive = false;
    this._lastUrl = null;

    // Set up SPA route change interception
    this._initRouteMonitor();
  }

  // ─── PUBLIC API ──────────────────────────────────────────────

  /**
   * Set a callback to be invoked when a SPA route change is detected.
   * @param {Function|null} callback — called with the new URL string
   */
  set onRouteChange(callback) {
    this._onRouteChange = callback;
  }

  /**
   * Get the current route change callback.
   * @returns {Function|null}
   */
  get onRouteChange() {
    return this._onRouteChange;
  }

  /**
   * Extract page content using three sequential strategies:
   *  1. Immediate extraction — accept if word count >= threshold
   *  2. MutationObserver — watch for dynamic content loading
   *  3. Timeout fallback — use whatever we have after 5s
   *
   * @returns {Promise<Object>} Extracted page data
   */
  extract() {
    var self = this;

    // Determine adapter for CMS-aware extraction
    var adapter = null;
    if (this._adapterRegistry) {
      adapter = this._adapterRegistry.getAdapter();
    }

    // Strategy 1: Immediate extraction
    var immediateData = this._extractWithAdapter(adapter);
    var immediateWordCount = this._getWordCount(immediateData);

    if (immediateWordCount >= this._minWordCount) {
      // Augment with shadow DOM content if available
      this._augmentWithShadowContent(immediateData);
      return Promise.resolve(immediateData);
    }

    // Strategy 2 & 3: MutationObserver with timeout fallback
    return new Promise(function (resolve) {
      var lastData = immediateData;
      var lastWordCount = immediateWordCount;
      var stabilityCount = 0;
      var debounceTimer = null;
      var observer = null;
      var timeoutTimer = null;
      var resolved = false;

      function finish(data) {
        if (resolved) return;
        resolved = true;

        // Clean up
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }

        self._augmentWithShadowContent(data);
        resolve(data);
      }

      function reExtract() {
        if (resolved) return;

        var newData = self._extractWithAdapter(adapter);
        var newWordCount = self._getWordCount(newData);

        // Check if word count has stabilized (same count as last extraction)
        if (newWordCount === lastWordCount) {
          stabilityCount++;
        } else {
          stabilityCount = 0;
        }

        lastData = newData;
        lastWordCount = newWordCount;

        // Accept if word count is sufficient and stable (2 consecutive same counts)
        if (newWordCount >= self._minWordCount && stabilityCount >= 1) {
          finish(newData);
          return;
        }

        // Accept if word count hit the threshold even without stability
        if (newWordCount >= self._minWordCount && stabilityCount === 0) {
          // Wait for one more check to confirm stability
          return;
        }
      }

      // Strategy 2: MutationObserver
      try {
        observer = new MutationObserver(function () {
          if (resolved) return;

          // Debounce re-extraction
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(reExtract, self._mutationDebounceMs);
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } catch (e) {
        // MutationObserver not available — fall through to timeout
      }

      // Strategy 3: Timeout fallback — resolve with best data after 5s
      timeoutTimer = setTimeout(function () {
        // Do one final extraction before giving up
        var finalData = self._extractWithAdapter(adapter);
        var finalWordCount = self._getWordCount(finalData);

        // Use the final extraction if it is better, otherwise use last good one
        if (finalWordCount > lastWordCount) {
          finish(finalData);
        } else {
          finish(lastData);
        }
      }, self._mutationTimeoutMs);
    });
  }

  // ─── SHADOW DOM WALKER ──────────────────────────────────────

  /**
   * Recursively walk open shadow roots to collect text content
   * from elements that are hidden behind shadow boundaries.
   *
   * @param {Element} element — root element to start walking from
   * @returns {string} Combined text content from shadow trees
   */
  _walkShadowRoots(element) {
    var textParts = [];

    if (!element) return "";

    // If this element has an open shadow root, walk into it
    if (element.shadowRoot) {
      var shadowChildren = element.shadowRoot.childNodes;
      for (var i = 0; i < shadowChildren.length; i++) {
        var child = shadowChildren[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          // Collect text from shadow child
          var childText = (child.textContent || "").trim();
          if (childText) {
            textParts.push(childText);
          }
          // Recurse into shadow child's shadow roots
          var deepText = this._walkShadowRoots(child);
          if (deepText) {
            textParts.push(deepText);
          }
        }
      }
    }

    // Walk regular children for nested shadow roots
    var children = element.children;
    if (children) {
      for (var j = 0; j < children.length; j++) {
        var shadowText = this._walkShadowRoots(children[j]);
        if (shadowText) {
          textParts.push(shadowText);
        }
      }
    }

    return textParts.join(" ");
  }

  // ─── SPA ROUTE MONITORING ──────────────────────────────────

  /**
   * Set up interception of SPA navigation events:
   *  - history.pushState
   *  - history.replaceState
   *  - popstate event
   */
  _initRouteMonitor() {
    if (this._routeMonitorActive) return;
    this._routeMonitorActive = true;
    this._lastUrl = window.location.href;

    var self = this;

    // Intercept history.pushState
    var originalPushState = history.pushState;
    history.pushState = function () {
      originalPushState.apply(history, arguments);
      self._handleRouteChange();
    };

    // Intercept history.replaceState
    var originalReplaceState = history.replaceState;
    history.replaceState = function () {
      originalReplaceState.apply(history, arguments);
      self._handleRouteChange();
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", function () {
      self._handleRouteChange();
    });
  }

  /**
   * Handle a detected route change. Only fires if the URL actually changed.
   */
  _handleRouteChange() {
    var currentUrl = window.location.href;

    if (currentUrl === this._lastUrl) return;

    this._lastUrl = currentUrl;

    // Clear adapter cache since the page type may have changed
    if (this._adapterRegistry) {
      this._adapterRegistry.clearCache();
    }

    // Notify the consumer
    if (typeof this._onRouteChange === "function") {
      try {
        this._onRouteChange(currentUrl);
      } catch (e) {
        // Consumer callback error should not break the extractor
      }
    }
  }

  // ─── INTERNAL HELPERS ──────────────────────────────────────

  /**
   * Extract using the underlying DOMExtractor, optionally providing
   * an adapter for CMS-aware selector resolution.
   *
   * @param {{name: string, selectors: string[]}|null} adapter
   * @returns {Object} Extracted page data
   */
  _extractWithAdapter(adapter) {
    if (adapter && adapter.name !== "generic") {
      return this._domExtractor.extractFrom(document, adapter);
    }
    return this._domExtractor.extract();
  }

  /**
   * Get the word count from extracted page data.
   * @param {Object} data — result from DOMExtractor.extract()
   * @returns {number}
   */
  _getWordCount(data) {
    if (data && data.content && typeof data.content.word_count === "number") {
      return data.content.word_count;
    }
    return 0;
  }

  /**
   * Augment extraction data with content found inside open shadow roots.
   * Appends shadow content to the full_text and adjusts word count.
   *
   * @param {Object} data — extraction data to augment in place
   */
  _augmentWithShadowContent(data) {
    if (!data || !data.content) return;

    try {
      var shadowText = this._walkShadowRoots(document.body);
      if (!shadowText) return;

      // Avoid duplicating content already in full_text
      var existingText = data.content.full_text || "";
      var newWords = shadowText.split(/\s+/).filter(Boolean);
      var existingWords = new Set(existingText.split(/\s+/).filter(Boolean));

      // Only add words not already present in the extraction
      var uniqueNewWords = [];
      for (var i = 0; i < newWords.length; i++) {
        if (!existingWords.has(newWords[i])) {
          uniqueNewWords.push(newWords[i]);
        }
      }

      if (uniqueNewWords.length > 0) {
        var additionalText = uniqueNewWords.join(" ");
        data.content.full_text = existingText + " " + additionalText;
        data.content.word_count = data.content.full_text
          .split(/\s+/)
          .filter(Boolean).length;
      }
    } catch (e) {
      // Shadow DOM traversal failed — use existing data as-is
    }
  }
}
