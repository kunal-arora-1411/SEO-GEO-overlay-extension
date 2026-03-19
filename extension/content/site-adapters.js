// ═══════════════════════════════════════════════════════════════
// SITE ADAPTER REGISTRY
// Detects CMS/framework and provides optimized content selectors
// ═══════════════════════════════════════════════════════════════

class SiteAdapterRegistry {
  constructor() {
    this._adapters = [
      {
        name: "wordpress",
        detect: this._detectWordPress,
        selectors: [
          ".entry-content",
          ".post-content",
          ".article-content"
        ]
      },
      {
        name: "shopify",
        detect: this._detectShopify,
        selectors: [
          ".product-single__description",
          ".product-description",
          ".rte"
        ]
      },
      {
        name: "webflow",
        detect: this._detectWebflow,
        selectors: [
          ".w-richtext",
          ".w-container"
        ]
      },
      {
        name: "nextjs",
        detect: this._detectNextJS,
        selectors: [
          "#__next main",
          "#__next article",
          "#__next [role='main']"
        ]
      },
      {
        name: "react",
        detect: this._detectReact,
        selectors: [
          "#root main",
          "#root article",
          "#root [role='main']"
        ]
      },
      {
        name: "generic",
        detect: function () { return true; },
        selectors: [
          "main",
          "article",
          "[role='main']",
          "#content",
          "#main-content",
          ".content",
          ".post-content",
          ".entry-content",
          ".article-content",
          ".page-content",
          ".main-content"
        ]
      }
    ];

    this._cachedResult = null;
  }

  // ─── PUBLIC API ──────────────────────────────────────────────

  /**
   * Detect which CMS/framework the current page uses.
   * @returns {string} Adapter name (e.g., "wordpress", "shopify", "generic")
   */
  detect() {
    return this.getAdapter().name;
  }

  /**
   * Return CSS selectors for the detected CMS/framework.
   * @returns {string[]} Array of CSS selectors
   */
  getSelectors() {
    return this.getAdapter().selectors;
  }

  /**
   * Return the full adapter object for the detected CMS/framework.
   * Results are cached per page load.
   * @returns {{name: string, selectors: string[]}}
   */
  getAdapter() {
    if (this._cachedResult) {
      return this._cachedResult;
    }

    for (var i = 0; i < this._adapters.length; i++) {
      var adapter = this._adapters[i];
      try {
        if (adapter.detect()) {
          this._cachedResult = {
            name: adapter.name,
            selectors: adapter.selectors.slice()
          };
          return this._cachedResult;
        }
      } catch (e) {
        // Detection failed for this adapter, try next
      }
    }

    // Should never reach here because generic always matches,
    // but return generic as a safety fallback
    var generic = this._adapters[this._adapters.length - 1];
    this._cachedResult = {
      name: generic.name,
      selectors: generic.selectors.slice()
    };
    return this._cachedResult;
  }

  /**
   * Clear the cached detection result.
   * Useful when navigating in SPAs where the framework may serve
   * different page types.
   */
  clearCache() {
    this._cachedResult = null;
  }

  // ─── DETECTION METHODS ──────────────────────────────────────

  /**
   * WordPress: meta generator tag containing "WordPress" or
   * wp-content paths in page resources.
   */
  _detectWordPress() {
    var generatorMeta = document.querySelector('meta[name="generator"]');
    if (generatorMeta) {
      var content = (generatorMeta.getAttribute("content") || "").toLowerCase();
      if (content.indexOf("wordpress") !== -1) {
        return true;
      }
    }

    // Check for wp-content in any link, script, or image source
    var wpContentEls = document.querySelectorAll(
      'link[href*="wp-content"], script[src*="wp-content"], img[src*="wp-content"]'
    );
    return wpContentEls.length > 0;
  }

  /**
   * Shopify: meta generator tag containing "Shopify" or
   * the window.Shopify global object.
   */
  _detectShopify() {
    var generatorMeta = document.querySelector('meta[name="generator"]');
    if (generatorMeta) {
      var content = (generatorMeta.getAttribute("content") || "").toLowerCase();
      if (content.indexOf("shopify") !== -1) {
        return true;
      }
    }

    // Check for the Shopify global
    try {
      if (typeof window.Shopify !== "undefined" && window.Shopify !== null) {
        return true;
      }
    } catch (e) {
      // Access to window.Shopify may be restricted
    }

    return false;
  }

  /**
   * Webflow: html[data-wf-site] attribute or presence of
   * .w-richtext elements.
   */
  _detectWebflow() {
    if (document.documentElement.hasAttribute("data-wf-site")) {
      return true;
    }

    return document.querySelector(".w-richtext") !== null;
  }

  /**
   * Next.js: presence of #__next container element.
   */
  _detectNextJS() {
    return document.getElementById("__next") !== null;
  }

  /**
   * React (non-Next.js): presence of #root or [data-reactroot]
   * without #__next (which would indicate Next.js).
   */
  _detectReact() {
    // If Next.js is already detected, skip plain React detection
    if (document.getElementById("__next") !== null) {
      return false;
    }

    if (document.getElementById("root") !== null) {
      return true;
    }

    return document.querySelector("[data-reactroot]") !== null;
  }
}
