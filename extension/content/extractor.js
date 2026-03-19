// ═══════════════════════════════════════════════════════════════
// DOM EXTRACTOR
// Extracts all analyzable SEO/GEO content from the current page
// ═══════════════════════════════════════════════════════════════

class DOMExtractor {
  /**
   * Main entry point — extracts a comprehensive snapshot of the page.
   * @returns {Object} Structured page data for scoring
   */
  extract() {
    return {
      url: window.location.href,
      domain: window.location.hostname,
      timestamp: new Date().toISOString(),
      meta: this._extractMeta(),
      headings: this._extractHeadings(),
      content: this._extractContent(),
      links: this._extractLinks(),
      images: this._extractImages(),
      structured_data: this._extractStructuredData(),
      technical: this._extractTechnical()
    };
  }

  /**
   * Extract from a specific root element instead of the full document.
   * Allows CMS-aware extraction by accepting an adapter with selectors.
   *
   * @param {Document|Element} root — the root element/document to extract from
   * @param {{name: string, selectors: string[]}|null} [adapter] — optional CMS adapter
   * @returns {Object} Structured page data for scoring
   */
  extractFrom(root, adapter) {
    var doc = root.ownerDocument || root;
    var adapterForContent = adapter || null;

    return {
      url: window.location.href,
      domain: window.location.hostname,
      timestamp: new Date().toISOString(),
      meta: this._extractMeta(),
      headings: this._extractHeadings(),
      content: this._extractContent(adapterForContent),
      links: this._extractLinks(),
      images: this._extractImages(),
      structured_data: this._extractStructuredData(),
      technical: this._extractTechnical()
    };
  }

  // ─── META ────────────────────────────────────────────────────

  _extractMeta() {
    const getMeta = (name) => {
      const el = document.querySelector(
        'meta[name="' + name + '"], meta[property="' + name + '"]'
      );
      return el ? el.getAttribute("content") : null;
    };
    const getLink = (rel) => {
      const el = document.querySelector('link[rel="' + rel + '"]');
      return el ? el.getAttribute("href") : null;
    };

    return {
      title: document.title || null,
      title_length: (document.title || "").length,
      meta_description: getMeta("description"),
      meta_description_length: (getMeta("description") || "").length,
      meta_keywords: getMeta("keywords"),
      canonical_url: getLink("canonical"),
      robots: getMeta("robots"),
      viewport: getMeta("viewport"),
      author: getMeta("author"),
      og: {
        title: getMeta("og:title"),
        description: getMeta("og:description"),
        image: getMeta("og:image"),
        url: getMeta("og:url"),
        type: getMeta("og:type"),
        site_name: getMeta("og:site_name")
      },
      twitter: {
        card: getMeta("twitter:card"),
        title: getMeta("twitter:title"),
        description: getMeta("twitter:description"),
        image: getMeta("twitter:image")
      },
      charset: document.characterSet || null,
      language: document.documentElement.lang || null,
      hreflang: Array.from(
        document.querySelectorAll("link[hreflang]")
      ).map((el) => ({
        lang: el.getAttribute("hreflang"),
        href: el.getAttribute("href")
      }))
    };
  }

  // ─── HEADINGS ────────────────────────────────────────────────

  _extractHeadings() {
    var headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    var allHeadings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

    allHeadings.forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      headings[tag].push({
        text: (el.textContent || "").trim(),
        id: el.id || null,
        selector: this._getUniqueSelector(el)
      });
    }.bind(this));

    return headings;
  }

  // ─── CONTENT ─────────────────────────────────────────────────

  _extractContent(adapter) {
    var mainEl = this._getMainContent(adapter);
    var paragraphs = [];
    var pElements = mainEl.querySelectorAll("p");

    pElements.forEach(function (p) {
      var text = (p.textContent || "").trim();
      var wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount > 5) {
        paragraphs.push({
          text: text,
          word_count: wordCount,
          selector: this._getUniqueSelector(p)
        });
      }
    }.bind(this));

    // Lists
    var lists = [];
    mainEl.querySelectorAll("ul, ol").forEach(function (list) {
      var items = Array.from(list.querySelectorAll(":scope > li")).map(
        function (li) { return (li.textContent || "").trim(); }
      );
      lists.push({
        type: list.tagName.toLowerCase(),
        items: items,
        item_count: items.length,
        selector: this._getUniqueSelector(list)
      });
    }.bind(this));

    // Tables
    var tables = [];
    mainEl.querySelectorAll("table").forEach(function (table) {
      var rows = table.querySelectorAll("tr").length;
      var cols = 0;
      var firstRow = table.querySelector("tr");
      if (firstRow) {
        cols = firstRow.querySelectorAll("th, td").length;
      }
      tables.push({
        rows: rows,
        columns: cols,
        has_header: table.querySelector("thead, th") !== null,
        selector: this._getUniqueSelector(table)
      });
    }.bind(this));

    // Blockquotes
    var blockquotes = [];
    mainEl.querySelectorAll("blockquote").forEach(function (bq) {
      blockquotes.push({
        text: (bq.textContent || "").trim(),
        selector: this._getUniqueSelector(bq)
      });
    }.bind(this));

    // Full text for analysis
    var fullText = (mainEl.textContent || "").replace(/\s+/g, " ").trim();
    var words = fullText.split(/\s+/).filter(Boolean);
    var sentences = fullText
      .split(/[.!?]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });

    // CTAs
    var ctas = this._extractCTAs(mainEl);

    return {
      paragraphs: paragraphs,
      lists: lists,
      tables: tables,
      blockquotes: blockquotes,
      full_text: fullText,
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      ctas: ctas
    };
  }

  // ─── LINKS ───────────────────────────────────────────────────

  _extractLinks() {
    var currentHost = window.location.hostname;
    var internal = [];
    var external = [];

    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var text = (a.textContent || "").trim();
      var rel = a.getAttribute("rel") || "";

      // Skip anchors, javascript, mailto, tel
      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      var linkData = {
        href: href,
        text: text,
        rel: rel,
        has_nofollow: rel.indexOf("nofollow") !== -1,
        selector: this._getUniqueSelector(a)
      };

      // Determine internal vs external
      try {
        var url = new URL(href, window.location.origin);
        if (url.hostname === currentHost) {
          internal.push(linkData);
        } else {
          external.push(linkData);
        }
      } catch (e) {
        // Malformed URL — treat as internal relative link
        internal.push(linkData);
      }
    }.bind(this));

    return {
      internal: internal,
      external: external,
      internal_count: internal.length,
      external_count: external.length,
      total_count: internal.length + external.length
    };
  }

  // ─── IMAGES ──────────────────────────────────────────────────

  _extractImages() {
    var images = [];

    document.querySelectorAll("img").forEach(function (img) {
      var alt = img.getAttribute("alt");
      var hasAlt = alt !== null;
      var altText = (alt || "").trim();

      // An alt is "descriptive" if it has 3+ words and is not just the filename
      var altIsDescriptive = false;
      if (hasAlt && altText.length > 0) {
        var altWords = altText.split(/\s+/).filter(Boolean).length;
        var looksLikeFilename = /\.\w{2,4}$/.test(altText);
        altIsDescriptive = altWords >= 3 && !looksLikeFilename;
      }

      images.push({
        src: img.getAttribute("src") || null,
        alt: altText,
        has_alt: hasAlt,
        alt_is_descriptive: altIsDescriptive,
        width: img.naturalWidth || img.width || null,
        height: img.naturalHeight || img.height || null,
        selector: this._getUniqueSelector(img)
      });
    }.bind(this));

    return images;
  }

  // ─── STRUCTURED DATA ────────────────────────────────────────

  _extractStructuredData() {
    // JSON-LD
    var jsonLd = [];
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach(function (script) {
        try {
          var parsed = JSON.parse(script.textContent);
          jsonLd.push(parsed);
        } catch (e) {
          // Invalid JSON-LD — skip
        }
      });

    // Microdata
    var microdata = [];
    document.querySelectorAll("[itemscope]").forEach(function (el) {
      var itemType = el.getAttribute("itemtype") || null;
      var props = [];

      el.querySelectorAll("[itemprop]").forEach(function (propEl) {
        props.push({
          name: propEl.getAttribute("itemprop"),
          value:
            propEl.getAttribute("content") ||
            (propEl.textContent || "").trim().substring(0, 200)
        });
      });

      microdata.push({
        type: itemType,
        properties: props
      });
    });

    return {
      json_ld: jsonLd,
      json_ld_count: jsonLd.length,
      microdata: microdata,
      microdata_count: microdata.length,
      has_structured_data: jsonLd.length > 0 || microdata.length > 0
    };
  }

  // ─── TECHNICAL ───────────────────────────────────────────────

  _extractTechnical() {
    var html = document.documentElement.outerHTML || "";
    var text = (document.body.textContent || "").trim();
    var htmlBytes = new Blob([html]).size;
    var textBytes = new Blob([text]).size;

    return {
      content_to_html_ratio:
        htmlBytes > 0
          ? Math.round((textBytes / htmlBytes) * 10000) / 100
          : 0,
      html_size_bytes: htmlBytes,
      text_size_bytes: textBytes,
      has_viewport:
        document.querySelector('meta[name="viewport"]') !== null,
      has_charset:
        document.querySelector("meta[charset]") !== null ||
        document.querySelector('meta[http-equiv="Content-Type"]') !== null,
      doctype: document.doctype
        ? "<!DOCTYPE " + document.doctype.name + ">"
        : null
    };
  }

  // ─── CTAs ────────────────────────────────────────────────────

  _extractCTAs(container) {
    var ctas = [];
    var seen = new Set();

    // Buttons
    container.querySelectorAll("button").forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        ctas.push({
          text: text,
          type: "button",
          selector: this._getUniqueSelector(el)
        });
      }
    }.bind(this));

    // Elements with role="button"
    container.querySelectorAll('[role="button"]').forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        ctas.push({
          text: text,
          type: "role-button",
          selector: this._getUniqueSelector(el)
        });
      }
    }.bind(this));

    // Submit inputs
    container
      .querySelectorAll('input[type="submit"]')
      .forEach(function (el) {
        var text = el.value || (el.textContent || "").trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          ctas.push({
            text: text,
            type: "submit",
            selector: this._getUniqueSelector(el)
          });
        }
      }.bind(this));

    // CTA-style links: .btn, .button, .cta, or visually styled anchors
    container
      .querySelectorAll("a.btn, a.button, a.cta")
      .forEach(function (el) {
        var text = (el.textContent || "").trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          ctas.push({
            text: text,
            type: "link-cta",
            selector: this._getUniqueSelector(el)
          });
        }
      }.bind(this));

    // Anchors with CTA-like styling (background-color set, short text)
    container.querySelectorAll("a").forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (!text || seen.has(text)) return;
      var words = text.split(/\s+/).length;
      if (words > 6) return; // CTAs are typically short
      try {
        var style = window.getComputedStyle(el);
        var bg = style.backgroundColor;
        // If it has a non-transparent, non-white background it likely looks like a button
        if (
          bg &&
          bg !== "rgba(0, 0, 0, 0)" &&
          bg !== "transparent" &&
          bg !== "rgb(255, 255, 255)"
        ) {
          seen.add(text);
          ctas.push({
            text: text,
            type: "styled-link",
            selector: this._getUniqueSelector(el)
          });
        }
      } catch (e) {
        // getComputedStyle can throw in rare edge cases
      }
    }.bind(this));

    return ctas;
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  /**
   * Locate the main content container on the page.
   * If an adapter is provided, its selectors are tried first.
   * Then falls back to default semantic selectors, then document.body.
   *
   * @param {{name: string, selectors: string[]}|null} [adapter] — optional CMS adapter
   * @returns {Element} The main content container element
   */
  _getMainContent(adapter) {
    var defaultSelectors = [
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
    ];

    var selectors;

    if (adapter && adapter.selectors && adapter.selectors.length > 0) {
      // Prepend adapter selectors, then add defaults (avoiding duplicates)
      selectors = adapter.selectors.slice();
      for (var d = 0; d < defaultSelectors.length; d++) {
        if (selectors.indexOf(defaultSelectors[d]) === -1) {
          selectors.push(defaultSelectors[d]);
        }
      }
    } else {
      selectors = defaultSelectors;
    }

    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {
        // Invalid selector — skip
      }
    }
    return document.body;
  }

  /**
   * Build a unique CSS selector for a given element.
   * Uses the element's id when available; otherwise constructs a path
   * using tag names, class names, and :nth-of-type.
   */
  _getUniqueSelector(el) {
    if (!el || el === document.documentElement) return "html";
    if (el.id) return "#" + CSS.escape(el.id);

    var parts = [];
    var current = el;

    while (current && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();

      // If this ancestor has an id, anchor to it and stop
      if (current.id) {
        parts.unshift("#" + CSS.escape(current.id));
        break;
      }

      // Build segment: tag + significant classes + nth-of-type for uniqueness
      var segment = tag;

      // Add up to 2 classes for specificity (skip utility-class noise)
      var classes = Array.from(current.classList || [])
        .filter(function (c) { return c.length > 1 && c.length < 30; })
        .slice(0, 2);
      if (classes.length > 0) {
        segment += "." + classes.map(CSS.escape).join(".");
      }

      // nth-of-type to disambiguate siblings
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(
          parent.querySelectorAll(":scope > " + tag)
        );
        if (siblings.length > 1) {
          var index = siblings.indexOf(current) + 1;
          segment += ":nth-of-type(" + index + ")";
        }
      }

      parts.unshift(segment);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }
}
