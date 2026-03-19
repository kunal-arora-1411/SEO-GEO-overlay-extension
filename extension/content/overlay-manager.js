// ═══════════════════════════════════════════════════════════════
// OVERLAY MANAGER
// Renders inline annotations on page elements (headings,
// paragraphs, links, images) + floating panel + meta bar.
// All rendering inside Shadow DOM for style isolation.
// ═══════════════════════════════════════════════════════════════

class OverlayManager {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this._tracked = [];
    this._trackingMap = new WeakMap();
    this._intersectionObserver = null;
    this._rafId = null;
    this._ghostElements = [];
    this._overlaysVisible = true;
    this._inlineAnalyzer = new InlineAnalyzer();
    this._diffEngine = typeof DiffEngine !== "undefined" ? new DiffEngine() : null;
    this._initContainer();
  }

  _initContainer() {
    var existing = document.getElementById("sgo-overlay-root");
    if (existing) existing.remove();
    this.container = document.createElement("div");
    this.container.id = "sgo-overlay-root";
    this.shadowRoot = this.container.attachShadow({ mode: "closed" });
    var style = document.createElement("style");
    style.textContent = this._getCSS();
    this.shadowRoot.appendChild(style);
    document.body.appendChild(this.container);
  }

  // ═══ PUBLIC API ═══════════════════════════════════════════

  render(analysis) {
    this.clear();
    if (!analysis) return;

    // Run InlineAnalyzer
    var result = this._inlineAnalyzer.analyze(
      analysis.page_data,
      analysis.seo,
      analysis.readability,
      analysis.suggestions || []
    );

    // 1. Meta bar at top
    this._renderMetaBar(result.metaBar);

    // 2. Floating summary panel
    this._renderPanel(analysis, result.stats);

    // 3. Inline annotations on page elements
    for (var i = 0; i < result.annotations.length; i++) {
      this._renderAnnotation(result.annotations[i]);
    }

    // 4. Structural insert placeholders
    for (var j = 0; j < result.structuralInserts.length; j++) {
      this._renderStructuralInsert(result.structuralInserts[j]);
    }

    // 5. Start position tracking
    this._startTracking();
  }

  clear() {
    this._stopTracking();
    // Remove ghost elements from real DOM
    for (var g = 0; g < this._ghostElements.length; g++) {
      var ghost = this._ghostElements[g];
      if (ghost.overlay && ghost.overlay.parentNode) ghost.overlay.parentNode.removeChild(ghost.overlay);
      if (ghost.original) { ghost.original.style.opacity = ""; ghost.original.style.textDecoration = ""; }
    }
    this._ghostElements = [];
    this._tracked = [];
    // Clear shadow children except style
    var kids = Array.from(this.shadowRoot.childNodes);
    for (var c = 0; c < kids.length; c++) {
      if (kids[c].tagName !== "STYLE") this.shadowRoot.removeChild(kids[c]);
    }
  }

  toggleOverlays() {
    this._overlaysVisible = !this._overlaysVisible;
    var els = this.shadowRoot.querySelectorAll(".sgo-ann, .sgo-meta-bar, .sgo-struct");
    for (var i = 0; i < els.length; i++) {
      els[i].style.display = this._overlaysVisible ? "" : "none";
    }
  }

  // ═══ META BAR ═════════════════════════════════════════════

  _renderMetaBar(meta) {
    if (!meta) return;
    var bar = document.createElement("div");
    bar.className = "sgo-meta-bar";

    var self = this;
    var collapsed = false;

    // Title section
    var titleItem = document.createElement("div");
    titleItem.className = "sgo-mb-item sgo-mb-item--" + meta.title.severity;
    titleItem.innerHTML =
      '<span class="sgo-mb-label">TITLE</span>' +
      '<span class="sgo-mb-text">' + this._esc(this._trunc(meta.title.text || "(missing)", 55)) + '</span>' +
      '<span class="sgo-mb-len ' + (meta.title.length >= 40 && meta.title.length <= 60 ? 'sgo-mb-len--ok' : 'sgo-mb-len--warn') + '">' +
      meta.title.length + '/60</span>';
    bar.appendChild(titleItem);

    // Separator
    var sep = document.createElement("span");
    sep.className = "sgo-mb-sep";
    sep.textContent = "|";
    bar.appendChild(sep);

    // Description section
    var descItem = document.createElement("div");
    descItem.className = "sgo-mb-item sgo-mb-item--" + meta.description.severity;
    descItem.innerHTML =
      '<span class="sgo-mb-label">DESC</span>' +
      '<span class="sgo-mb-text">' + this._esc(this._trunc(meta.description.text || "(missing)", 55)) + '</span>' +
      '<span class="sgo-mb-len ' + (meta.description.length >= 120 && meta.description.length <= 160 ? 'sgo-mb-len--ok' : 'sgo-mb-len--warn') + '">' +
      meta.description.length + '/160</span>';
    bar.appendChild(descItem);

    // Toggle button
    var toggle = document.createElement("button");
    toggle.className = "sgo-mb-toggle";
    toggle.textContent = "\u25B2";
    toggle.addEventListener("click", function () {
      collapsed = !collapsed;
      bar.classList.toggle("sgo-meta-bar--collapsed", collapsed);
      toggle.textContent = collapsed ? "\u25BC" : "\u25B2";
    });
    bar.appendChild(toggle);

    this.shadowRoot.appendChild(bar);
  }

  // ═══ FLOATING PANEL ═══════════════════════════════════════

  _renderPanel(analysis, stats) {
    var self = this;
    var panel = document.createElement("div");
    panel.className = "sgo-panel";

    // Header
    var header = document.createElement("div");
    header.className = "sgo-panel-hdr";
    header.innerHTML =
      '<span class="sgo-panel-logo">SEO &amp; GEO</span>' +
      '<div class="sgo-panel-btns">' +
      '<button class="sgo-panel-btn sgo-panel-min" title="Collapse">_</button>' +
      '<button class="sgo-panel-btn sgo-panel-cls" title="Close">&times;</button></div>';
    panel.appendChild(header);

    var body = document.createElement("div");
    body.className = "sgo-panel-body";

    // Scores
    var seoScore = analysis.seo ? analysis.seo.normalized_score : 0;
    var geoScore = analysis.geo ? analysis.geo.normalized_score : null;
    var combined = analysis.combined || { score: seoScore, grade: "-" };

    var scores = document.createElement("div");
    scores.className = "sgo-scores";
    scores.innerHTML =
      '<div class="sgo-sc"><div class="sgo-sc-v sgo-sc--' + this._clr(seoScore) + '">' + seoScore + '</div><div class="sgo-sc-l">SEO</div></div>' +
      '<div class="sgo-sc"><div class="sgo-sc-v sgo-sc--' + (geoScore !== null ? this._clr(geoScore) : 'off') + '">' + (geoScore !== null ? geoScore : '--') + '</div><div class="sgo-sc-l">GEO</div></div>' +
      '<div class="sgo-sc"><div class="sgo-sc-v sgo-sc-grade sgo-sc--' + this._clr(combined.score) + '">' + combined.grade + '</div><div class="sgo-sc-l">' + combined.score + '/100</div></div>';
    body.appendChild(scores);

    // Annotation stats
    if (stats.total > 0) {
      var statBar = document.createElement("div");
      statBar.className = "sgo-stat-bar";
      if (stats.error > 0) statBar.innerHTML += '<span class="sgo-stat sgo-stat--error">' + stats.error + ' errors</span>';
      if (stats.warning > 0) statBar.innerHTML += '<span class="sgo-stat sgo-stat--warning">' + stats.warning + ' warnings</span>';
      if (stats.info > 0) statBar.innerHTML += '<span class="sgo-stat sgo-stat--info">' + stats.info + ' info</span>';
      if (stats.good > 0) statBar.innerHTML += '<span class="sgo-stat sgo-stat--good">' + stats.good + ' good</span>';
      body.appendChild(statBar);
    }

    // Issues list
    var issues = analysis.seo ? analysis.seo.issues : [];
    if (issues.length > 0) {
      var sec = document.createElement("div");
      sec.className = "sgo-sec";
      sec.innerHTML = '<div class="sgo-sec-hdr">Issues <span class="sgo-pill">' + issues.length + '</span></div>';
      var list = document.createElement("div");
      list.className = "sgo-issue-list";
      var max = Math.min(issues.length, 6);
      for (var i = 0; i < max; i++) {
        var iss = issues[i];
        var ic = iss.type === "error" ? "E" : (iss.type === "warning" ? "W" : "i");
        var item = document.createElement("div");
        item.className = "sgo-iss";
        item.innerHTML = '<span class="sgo-iss-ic sgo-iss-ic--' + this._esc(iss.type) + '">' + ic + '</span><span class="sgo-iss-msg">' + this._esc(iss.message) + '</span>';
        list.appendChild(item);
      }
      if (issues.length > max) {
        var more = document.createElement("div");
        more.className = "sgo-iss sgo-iss--more";
        more.textContent = "+ " + (issues.length - max) + " more";
        list.appendChild(more);
      }
      sec.appendChild(list);
      body.appendChild(sec);
    }

    // GEO breakdown
    if (analysis.geo && analysis.geo.categories) {
      var geoSec = document.createElement("div");
      geoSec.className = "sgo-sec";
      geoSec.innerHTML = '<div class="sgo-sec-hdr">GEO Breakdown</div>';
      var cats = analysis.geo.categories;
      var catKeys = Object.keys(cats);
      for (var ci = 0; ci < catKeys.length; ci++) {
        var cat = cats[catKeys[ci]];
        var pct = cat.max_score > 0 ? Math.round((cat.score / cat.max_score) * 100) : 0;
        var catEl = document.createElement("div");
        catEl.className = "sgo-cat";
        catEl.innerHTML =
          '<div class="sgo-cat-name">' + this._esc(this._fmtCat(catKeys[ci])) + '</div>' +
          '<div class="sgo-cat-bar-bg"><div class="sgo-cat-bar sgo-cat-bar--' + this._clr(pct) + '" style="width:' + pct + '%"></div></div>' +
          '<div class="sgo-cat-val">' + Math.round(cat.score) + '/' + Math.round(cat.max_score) + '</div>';
        geoSec.appendChild(catEl);
      }
      body.appendChild(geoSec);
    }

    panel.appendChild(body);

    // Event handlers
    var isCollapsed = false;
    header.querySelector(".sgo-panel-min").addEventListener("click", function () {
      isCollapsed = !isCollapsed;
      body.style.display = isCollapsed ? "none" : "";
      header.querySelector(".sgo-panel-min").textContent = isCollapsed ? "+" : "_";
    });
    header.querySelector(".sgo-panel-cls").addEventListener("click", function () {
      panel.style.display = "none";
    });

    // Draggable
    var dragging = false, dx = 0, dy = 0;
    header.addEventListener("mousedown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      var r = panel.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      panel.style.right = "auto"; panel.style.bottom = "auto";
      panel.style.left = (e.clientX - dx) + "px"; panel.style.top = (e.clientY - dy) + "px";
    });
    document.addEventListener("mouseup", function () { dragging = false; });

    this.shadowRoot.appendChild(panel);
  }

  // ═══ ANNOTATION ROUTER ════════════════════════════════════

  _renderAnnotation(ann) {
    if (ann.dismissed) return;
    switch (ann.elementType) {
      case "heading":   this._renderHeading(ann); break;
      case "paragraph": this._renderParagraph(ann); break;
      case "link":      this._renderLink(ann); break;
      case "image":     this._renderImage(ann); break;
    }
  }

  // ═══ HEADING ANNOTATION ═══════════════════════════════════

  _renderHeading(ann) {
    var el = this._findEl(ann.selector);
    if (!el) return;

    var wrap = document.createElement("div");
    wrap.className = "sgo-ann sgo-h-border sgo-h-border--" + ann.severity;

    // Tag label
    var tag = document.createElement("div");
    tag.className = "sgo-tag sgo-tag--" + ann.severity;
    tag.innerHTML = '<span class="sgo-tag-txt">' + ann.tagName.toUpperCase() + '</span>';

    // Dismiss
    var dismiss = document.createElement("button");
    dismiss.className = "sgo-tag-x";
    dismiss.textContent = "\u00D7";
    dismiss.addEventListener("click", function (e) { e.stopPropagation(); wrap.style.display = "none"; });
    tag.appendChild(dismiss);

    // Tooltip
    var tooltip = this._buildTooltip(ann);
    tag.appendChild(tooltip);
    tag.addEventListener("mouseenter", function () { tooltip.style.display = "block"; });
    tag.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });

    wrap.appendChild(tag);
    this.shadowRoot.appendChild(wrap);
    this._track(wrap, el, "border");
  }

  // ═══ PARAGRAPH ANNOTATION ════════════════════════════════

  _renderParagraph(ann) {
    var el = this._findEl(ann.selector);
    if (!el) return;

    // Left stripe
    var stripe = document.createElement("div");
    stripe.className = "sgo-ann sgo-p-stripe sgo-p-stripe--" + ann.severity;

    // Badge with word count
    var badge = document.createElement("div");
    badge.className = "sgo-p-badge sgo-p-badge--" + ann.severity;
    badge.textContent = (ann.metrics ? ann.metrics.words : "?") + "w";

    // Tooltip
    var tooltip = this._buildTooltip(ann);
    badge.appendChild(tooltip);
    badge.addEventListener("mouseenter", function () { tooltip.style.display = "block"; });
    badge.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });

    stripe.appendChild(badge);
    this.shadowRoot.appendChild(stripe);
    this._track(stripe, el, "stripe");
  }

  // ═══ LINK ANNOTATION ═════════════════════════════════════

  _renderLink(ann) {
    var el = this._findEl(ann.selector);
    if (!el) return;

    var line = document.createElement("div");
    line.className = "sgo-ann sgo-l-line sgo-l-line--" + ann.severity;

    // Tooltip
    var tooltip = this._buildTooltip(ann);
    line.appendChild(tooltip);
    line.addEventListener("mouseenter", function () { tooltip.style.display = "block"; });
    line.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });

    this.shadowRoot.appendChild(line);
    this._track(line, el, "underline");
  }

  // ═══ IMAGE ANNOTATION ════════════════════════════════════

  _renderImage(ann) {
    var el = this._findEl(ann.selector);
    if (!el) return;

    var wrap = document.createElement("div");
    wrap.className = "sgo-ann sgo-i-border sgo-i-border--" + ann.severity;

    var badge = document.createElement("div");
    badge.className = "sgo-i-badge sgo-i-badge--" + ann.severity;
    var code = ann.issues.length > 0 ? ann.issues[0].code : "";
    badge.textContent = code === "image_missing_alt" ? "No Alt" : (code === "image_poor_alt" || code === "image_generic_alt" ? "Weak Alt" : "IMG");

    // Tooltip
    var tooltip = this._buildTooltip(ann);
    badge.appendChild(tooltip);
    badge.addEventListener("mouseenter", function () { tooltip.style.display = "block"; });
    badge.addEventListener("mouseleave", function () { tooltip.style.display = "none"; });

    wrap.appendChild(badge);
    this.shadowRoot.appendChild(wrap);
    this._track(wrap, el, "border");
  }

  // ═══ STRUCTURAL INSERT ════════════════════════════════════

  _renderStructuralInsert(insert) {
    var el = this._findEl(insert.afterSelector);
    if (!el) return;

    var block = document.createElement("div");
    block.className = "sgo-struct";
    block.innerHTML =
      '<div class="sgo-struct-icon">+</div>' +
      '<div class="sgo-struct-body">' +
      '<div class="sgo-struct-title">Suggested: Add a ' + this._esc(insert.type.toUpperCase()) + ' section here</div>' +
      '<div class="sgo-struct-reason">' + this._esc(insert.reason) + '</div></div>' +
      '<button class="sgo-struct-dismiss">&times;</button>';

    var self = this;
    block.querySelector(".sgo-struct-dismiss").addEventListener("click", function () {
      if (block.parentNode) block.parentNode.removeChild(block);
      self._ghostElements = self._ghostElements.filter(function (g) { return g.overlay !== block; });
    });

    // Insert into real DOM after target
    if (el.nextSibling) {
      el.parentNode.insertBefore(block, el.nextSibling);
    } else {
      el.parentNode.appendChild(block);
    }
    this._ghostElements.push({ original: el, overlay: block });
  }

  // ═══ TOOLTIP BUILDER ═════════════════════════════════════

  _buildTooltip(ann) {
    var tt = document.createElement("div");
    tt.className = "sgo-tt";
    tt.style.display = "none";

    // Header
    var hdr = document.createElement("div");
    hdr.className = "sgo-tt-hdr sgo-tt-hdr--" + ann.severity;
    hdr.textContent = ann.tagName.toUpperCase() + " Element";
    tt.appendChild(hdr);

    // Issues
    for (var i = 0; i < ann.issues.length; i++) {
      var iss = ann.issues[i];
      var row = document.createElement("div");
      row.className = "sgo-tt-iss";
      row.innerHTML =
        '<span class="sgo-tt-dot sgo-tt-dot--' + iss.severity + '"></span>' +
        '<span class="sgo-tt-msg">' + this._esc(iss.message) + '</span>';
      tt.appendChild(row);

      if (iss.fix) {
        var fix = document.createElement("div");
        fix.className = "sgo-tt-fix";
        fix.textContent = iss.fix;
        tt.appendChild(fix);
      }
    }

    // Metrics
    if (ann.metrics) {
      var met = document.createElement("div");
      met.className = "sgo-tt-met";
      var parts = [];
      if (ann.metrics.words !== undefined) parts.push(ann.metrics.words + " words");
      if (ann.metrics.chars !== undefined) parts.push(ann.metrics.chars + " chars");
      if (ann.metrics.sentences !== undefined) parts.push(ann.metrics.sentences + " sentences");
      if (ann.metrics.level !== undefined) parts.push("Level " + ann.metrics.level);
      met.textContent = parts.join(" \u00B7 ");
      tt.appendChild(met);
    }

    // AI suggestion
    if (ann.suggestion) {
      var ai = document.createElement("div");
      ai.className = "sgo-tt-ai";
      ai.innerHTML =
        '<div class="sgo-tt-ai-hdr">AI Suggestion</div>' +
        (ann.suggestion.reason ? '<div class="sgo-tt-ai-reason">' + this._esc(ann.suggestion.reason) + '</div>' : '') +
        (ann.suggestion.original ? '<div class="sgo-tt-ai-orig">' + this._esc(this._trunc(ann.suggestion.original, 120)) + '</div>' : '') +
        (ann.suggestion.suggested ? '<div class="sgo-tt-ai-new">' + this._esc(this._trunc(ann.suggestion.suggested, 120)) + '</div>' : '');
      tt.appendChild(ai);
    }

    // Good state
    if (ann.issues.length === 0 && !ann.suggestion) {
      var ok = document.createElement("div");
      ok.className = "sgo-tt-ok";
      ok.textContent = "Looks good!";
      tt.appendChild(ok);
    }

    return tt;
  }

  // ═══ POSITION TRACKING ════════════════════════════════════

  _findEl(selector) {
    if (!selector) return null;
    try { return document.querySelector(selector); } catch (e) { return null; }
  }

  _track(overlayEl, targetEl, type) {
    var rect = targetEl.getBoundingClientRect();
    this._applyPos(overlayEl, targetEl, rect, type);
    var data = { targetEl: targetEl, type: type, visible: true };
    this._trackingMap.set(overlayEl, data);
    this._tracked.push(overlayEl);
  }

  _applyPos(el, target, rect, type) {
    // Use fixed positioning with viewport coordinates — immune to body offset issues
    switch (type) {
      case "border":
        el.style.position = "fixed";
        el.style.top = (rect.top - 2) + "px";
        el.style.left = (rect.left - 2) + "px";
        el.style.width = (rect.width + 4) + "px";
        el.style.height = (rect.height + 4) + "px";
        break;
      case "stripe":
        el.style.position = "fixed";
        el.style.top = rect.top + "px";
        el.style.left = (rect.left - 10) + "px";
        el.style.height = rect.height + "px";
        break;
      case "underline":
        el.style.position = "fixed";
        el.style.top = (rect.bottom + 1) + "px";
        el.style.left = rect.left + "px";
        el.style.width = rect.width + "px";
        break;
    }
  }

  _startTracking() {
    var self = this;
    if (this._tracked.length === 0) return;

    // IntersectionObserver for visibility
    try {
      this._intersectionObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var target = entries[i].target;
          for (var j = 0; j < self._tracked.length; j++) {
            var d = self._trackingMap.get(self._tracked[j]);
            if (d && d.targetEl === target) d.visible = entries[i].isIntersecting;
          }
        }
      }, { threshold: 0 });

      var seen = new Set();
      for (var i = 0; i < this._tracked.length; i++) {
        var d = this._trackingMap.get(this._tracked[i]);
        if (d && d.targetEl && !seen.has(d.targetEl)) {
          seen.add(d.targetEl);
          this._intersectionObserver.observe(d.targetEl);
        }
      }
    } catch (e) { /* no IO */ }

    // RAF loop
    function tick() {
      for (var k = 0; k < self._tracked.length; k++) {
        var overlay = self._tracked[k];
        var data = self._trackingMap.get(overlay);
        if (!data || !data.targetEl) continue;

        if (!data.visible) {
          if (overlay.style.display !== "none") overlay.style.display = "none";
          continue;
        }
        if (overlay.style.display === "none" && self._overlaysVisible) overlay.style.display = "";

        var rect = data.targetEl.getBoundingClientRect();
        self._applyPos(overlay, data.targetEl, rect, data.type);
      }
      self._rafId = requestAnimationFrame(tick);
    }
    this._rafId = requestAnimationFrame(tick);
  }

  _stopTracking() {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._intersectionObserver) { this._intersectionObserver.disconnect(); this._intersectionObserver = null; }
    this._tracked = [];
  }

  // ═══ HELPERS ══════════════════════════════════════════════

  _esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  _trunc(s, n) {
    if (!s) return "";
    return s.length > n ? s.substring(0, n) + "..." : s;
  }

  _clr(score) {
    if (score >= 80) return "good";
    if (score >= 50) return "ok";
    return "bad";
  }

  _fmtCat(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ═══ CSS ══════════════════════════════════════════════════

  _getCSS() {
    return '\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0;\
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\
\
/* ── Meta Bar ── */\
.sgo-meta-bar {\
  position: fixed; top: 0; left: 0; right: 0; height: 32px;\
  background: rgba(15,23,42,0.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);\
  display: flex; align-items: center; justify-content: center; gap: 16px;\
  padding: 0 48px 0 16px; font-size: 12px; color: #e2e8f0;\
  z-index: 2147483646; border-bottom: 1px solid rgba(255,255,255,0.06);\
  transition: height 0.2s, opacity 0.2s;\
}\
.sgo-meta-bar--collapsed { height: 3px; overflow: hidden; opacity: 0.6; }\
.sgo-mb-item { display: flex; align-items: center; gap: 6px; padding-left: 10px;\
  border-left: 3px solid transparent; }\
.sgo-mb-item--error { border-left-color: #ef4444; }\
.sgo-mb-item--warning { border-left-color: #f59e0b; }\
.sgo-mb-item--good { border-left-color: #22c55e; }\
.sgo-mb-item--info { border-left-color: #3b82f6; }\
.sgo-mb-label { font-size: 9px; font-weight: 700; color: #64748b;\
  letter-spacing: 0.5px; }\
.sgo-mb-text { color: #cbd5e1; max-width: 260px; overflow: hidden;\
  text-overflow: ellipsis; white-space: nowrap; }\
.sgo-mb-sep { color: #334155; }\
.sgo-mb-len { font-size: 10px; font-weight: 600; }\
.sgo-mb-len--ok { color: #4ade80; }\
.sgo-mb-len--warn { color: #f59e0b; }\
.sgo-mb-toggle { position: absolute; right: 8px; width: 22px; height: 22px;\
  border: none; background: rgba(255,255,255,0.06); color: #94a3b8;\
  border-radius: 4px; font-size: 9px; cursor: pointer;\
  display: flex; align-items: center; justify-content: center; }\
\
/* ── Floating Panel ── */\
.sgo-panel { position: fixed; bottom: 16px; right: 16px; width: 340px;\
  max-height: 75vh; background: #0f172a; border-radius: 12px;\
  box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);\
  color: #e2e8f0; font-size: 12px; z-index: 2147483647;\
  overflow: hidden; display: flex; flex-direction: column; }\
.sgo-panel-hdr { display: flex; justify-content: space-between; align-items: center;\
  padding: 10px 14px; background: #1e293b; border-bottom: 1px solid #334155;\
  cursor: move; user-select: none; }\
.sgo-panel-logo { font-size: 13px; font-weight: 700;\
  background: linear-gradient(135deg, #7c3aed, #3b82f6);\
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }\
.sgo-panel-btns { display: flex; gap: 4px; }\
.sgo-panel-btn { width: 22px; height: 22px; border: none; border-radius: 5px;\
  background: #334155; color: #94a3b8; font-size: 13px; font-weight: 700;\
  cursor: pointer; display: flex; align-items: center; justify-content: center; }\
.sgo-panel-btn:hover { background: #475569; color: #f1f5f9; }\
.sgo-panel-body { padding: 10px 14px; overflow-y: auto; max-height: calc(75vh - 44px); }\
.sgo-panel-body::-webkit-scrollbar { width: 5px; }\
.sgo-panel-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }\
\
/* Scores */\
.sgo-scores { display: flex; justify-content: space-around; padding: 6px 0 12px;\
  border-bottom: 1px solid #1e293b; margin-bottom: 10px; }\
.sgo-sc { text-align: center; }\
.sgo-sc-v { font-size: 26px; font-weight: 800; line-height: 1.2; }\
.sgo-sc-grade { font-size: 30px; }\
.sgo-sc-l { font-size: 10px; color: #94a3b8; text-transform: uppercase;\
  letter-spacing: 1px; margin-top: 1px; }\
.sgo-sc--good { color: #4ade80; }\
.sgo-sc--ok { color: #fbbf24; }\
.sgo-sc--bad { color: #f87171; }\
.sgo-sc--off { color: #475569; }\
\
/* Stats bar */\
.sgo-stat-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;\
  padding-bottom: 10px; border-bottom: 1px solid #1e293b; }\
.sgo-stat { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }\
.sgo-stat--error { background: rgba(239,68,68,0.15); color: #fca5a5; }\
.sgo-stat--warning { background: rgba(245,158,11,0.15); color: #fcd34d; }\
.sgo-stat--info { background: rgba(59,130,246,0.15); color: #93c5fd; }\
.sgo-stat--good { background: rgba(34,197,94,0.15); color: #86efac; }\
\
/* Sections */\
.sgo-sec { margin-bottom: 10px; }\
.sgo-sec-hdr { font-size: 11px; font-weight: 700; color: #94a3b8;\
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;\
  display: flex; align-items: center; gap: 6px; }\
.sgo-pill { min-width: 18px; height: 16px; padding: 0 5px; border-radius: 8px;\
  background: #334155; color: #f1f5f9; font-size: 10px; font-weight: 600;\
  display: inline-flex; align-items: center; justify-content: center; }\
\
/* Issues */\
.sgo-issue-list { display: flex; flex-direction: column; gap: 3px; }\
.sgo-iss { display: flex; align-items: flex-start; gap: 6px;\
  padding: 4px 6px; border-radius: 5px; font-size: 11px; line-height: 1.4; }\
.sgo-iss:hover { background: #1e293b; }\
.sgo-iss-ic { flex-shrink: 0; width: 16px; height: 16px; border-radius: 3px;\
  display: flex; align-items: center; justify-content: center;\
  font-size: 9px; font-weight: 700; color: #fff; }\
.sgo-iss-ic--error { background: #ef4444; }\
.sgo-iss-ic--warning { background: #f59e0b; }\
.sgo-iss-ic--info { background: #3b82f6; }\
.sgo-iss-msg { color: #cbd5e1; flex: 1; }\
.sgo-iss--more { color: #7c3aed; font-weight: 600; cursor: pointer; }\
\
/* GEO categories */\
.sgo-cat { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 11px; }\
.sgo-cat-name { width: 110px; flex-shrink: 0; color: #94a3b8; white-space: nowrap;\
  overflow: hidden; text-overflow: ellipsis; }\
.sgo-cat-bar-bg { flex: 1; height: 5px; background: #1e293b; border-radius: 3px; overflow: hidden; }\
.sgo-cat-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }\
.sgo-cat-bar--good { background: #4ade80; }\
.sgo-cat-bar--ok { background: #fbbf24; }\
.sgo-cat-bar--bad { background: #f87171; }\
.sgo-cat-val { width: 40px; text-align: right; color: #64748b; font-size: 10px; flex-shrink: 0; }\
\
/* ── Heading Annotation ── */\
.sgo-h-border { position: fixed; border: 2px solid transparent; border-radius: 4px;\
  pointer-events: none; z-index: 2147483640;\
  transition: border-color 0.2s, box-shadow 0.2s; }\
.sgo-h-border--error { border-color: #ef4444; box-shadow: 0 0 0 1px rgba(239,68,68,0.12); }\
.sgo-h-border--warning { border-color: #f59e0b; box-shadow: 0 0 0 1px rgba(245,158,11,0.12); }\
.sgo-h-border--info { border-color: #3b82f6; box-shadow: 0 0 0 1px rgba(59,130,246,0.12); }\
.sgo-h-border--good { border-color: #22c55e; box-shadow: 0 0 0 1px rgba(34,197,94,0.12); }\
\
/* Tag label */\
.sgo-tag { position: absolute; top: -1px; left: -1px; padding: 1px 6px;\
  font-size: 10px; font-weight: 700; letter-spacing: 0.5px;\
  border-radius: 3px 0 4px 0; color: #fff; pointer-events: auto;\
  cursor: default; display: flex; align-items: center; gap: 4px;\
  line-height: 16px; z-index: 2147483641; }\
.sgo-tag--error { background: #ef4444; }\
.sgo-tag--warning { background: #f59e0b; color: #1c1917; }\
.sgo-tag--info { background: #3b82f6; }\
.sgo-tag--good { background: #22c55e; color: #1c1917; }\
.sgo-tag-txt { pointer-events: none; }\
.sgo-tag-x { width: 14px; height: 14px; border: none;\
  background: rgba(255,255,255,0.2); color: inherit; font-size: 10px;\
  font-weight: 700; border-radius: 50%; cursor: pointer;\
  display: flex; align-items: center; justify-content: center;\
  opacity: 0; transition: opacity 0.15s; }\
.sgo-tag:hover .sgo-tag-x { opacity: 1; }\
\
/* ── Paragraph Annotation ── */\
.sgo-p-stripe { position: fixed; width: 4px; border-radius: 2px;\
  pointer-events: none; z-index: 2147483640; }\
.sgo-p-stripe--error { background: #ef4444; }\
.sgo-p-stripe--warning { background: #f59e0b; }\
.sgo-p-stripe--info { background: #3b82f6; }\
.sgo-p-stripe--good { background: #22c55e; }\
.sgo-p-badge { position: absolute; top: 0; left: 8px;\
  padding: 1px 6px; font-size: 9px; font-weight: 700;\
  border-radius: 3px; color: #fff; pointer-events: auto; cursor: default;\
  white-space: nowrap; z-index: 2147483641; }\
.sgo-p-badge--error { background: #ef4444; }\
.sgo-p-badge--warning { background: #f59e0b; color: #1c1917; }\
.sgo-p-badge--info { background: #3b82f6; }\
.sgo-p-badge--good { background: #22c55e; color: #1c1917; }\
\
/* ── Link Annotation ── */\
.sgo-l-line { position: fixed; height: 2px; border-radius: 1px;\
  pointer-events: auto; cursor: default; z-index: 2147483640;\
  transition: height 0.15s; }\
.sgo-l-line:hover { height: 3px; }\
.sgo-l-line--error { background: #ef4444; }\
.sgo-l-line--warning { background: #f59e0b; }\
.sgo-l-line--info { background: #3b82f6; }\
.sgo-l-line--good { background: #22c55e; }\
\
/* ── Image Annotation ── */\
.sgo-i-border { position: fixed; border: 2px solid transparent; border-radius: 4px;\
  pointer-events: none; z-index: 2147483640; }\
.sgo-i-border--error { border-color: #ef4444; }\
.sgo-i-border--warning { border-color: #f59e0b; }\
.sgo-i-border--good { border-color: #22c55e; }\
.sgo-i-badge { position: absolute; top: 4px; left: 4px; padding: 2px 8px;\
  font-size: 9px; font-weight: 700; border-radius: 4px; color: #fff;\
  pointer-events: auto; z-index: 2147483641; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }\
.sgo-i-badge--error { background: #ef4444; }\
.sgo-i-badge--warning { background: #f59e0b; color: #1c1917; }\
.sgo-i-badge--good { background: #22c55e; color: #1c1917; }\
\
/* ── Glassmorphism Tooltip ── */\
.sgo-tt { position: absolute; top: 22px; left: 0; width: 300px;\
  background: rgba(15,23,42,0.94); backdrop-filter: blur(12px);\
  -webkit-backdrop-filter: blur(12px);\
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;\
  padding: 12px; font-size: 12px; line-height: 1.5; color: #e2e8f0;\
  box-shadow: 0 12px 40px rgba(0,0,0,0.45); z-index: 2147483647;\
  animation: sgo-tt-in 0.18s ease; pointer-events: auto; }\
@keyframes sgo-tt-in { from { opacity: 0; transform: translateY(-4px); }\
  to { opacity: 1; transform: translateY(0); } }\
.sgo-tt-hdr { font-size: 10px; font-weight: 700; text-transform: uppercase;\
  letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px;\
  border-bottom: 1px solid rgba(255,255,255,0.08); }\
.sgo-tt-hdr--error { color: #fca5a5; }\
.sgo-tt-hdr--warning { color: #fcd34d; }\
.sgo-tt-hdr--info { color: #93c5fd; }\
.sgo-tt-hdr--good { color: #86efac; }\
.sgo-tt-iss { display: flex; align-items: flex-start; gap: 7px; margin-bottom: 5px; }\
.sgo-tt-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }\
.sgo-tt-dot--error { background: #ef4444; }\
.sgo-tt-dot--warning { background: #f59e0b; }\
.sgo-tt-dot--info { background: #3b82f6; }\
.sgo-tt-msg { color: #f1f5f9; font-size: 12px; }\
.sgo-tt-fix { padding: 5px 9px; margin: 3px 0 7px 13px;\
  background: rgba(124,58,237,0.12); border-left: 2px solid #7c3aed;\
  border-radius: 4px; color: #c4b5fd; font-size: 11px; font-style: italic; }\
.sgo-tt-met { font-size: 10px; color: #64748b; padding-top: 6px; margin-top: 6px;\
  border-top: 1px solid rgba(255,255,255,0.05); }\
.sgo-tt-ai { margin-top: 8px; padding-top: 8px;\
  border-top: 1px solid rgba(124,58,237,0.25); }\
.sgo-tt-ai-hdr { font-size: 10px; font-weight: 700; color: #a78bfa; margin-bottom: 5px; }\
.sgo-tt-ai-reason { font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 5px; }\
.sgo-tt-ai-orig { padding: 3px 7px; background: rgba(239,68,68,0.1);\
  border-radius: 4px; color: #fca5a5; font-size: 11px;\
  text-decoration: line-through; margin-bottom: 3px; }\
.sgo-tt-ai-new { padding: 3px 7px; background: rgba(34,197,94,0.1);\
  border-radius: 4px; color: #86efac; font-size: 11px; font-weight: 600; }\
.sgo-tt-ok { color: #86efac; font-size: 12px; font-weight: 600;\
  padding: 4px 0; }\
\
/* ── Structural Insert ── */\
.sgo-struct { margin: 14px 0; padding: 12px 16px;\
  border: 2px dashed #7c3aed; border-radius: 8px;\
  background: rgba(124,58,237,0.04); display: flex; align-items: center;\
  gap: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
  font-size: 13px; color: #7c3aed; position: relative; }\
.sgo-struct-icon { width: 28px; height: 28px; border-radius: 50%;\
  background: rgba(124,58,237,0.1); display: flex; align-items: center;\
  justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }\
.sgo-struct-body { flex: 1; }\
.sgo-struct-title { font-weight: 600; margin-bottom: 2px; }\
.sgo-struct-reason { font-size: 11px; color: #94a3b8; font-style: italic; }\
.sgo-struct-dismiss { position: absolute; top: 6px; right: 8px;\
  width: 20px; height: 20px; border: none; background: rgba(124,58,237,0.1);\
  color: #7c3aed; font-size: 14px; font-weight: 700; border-radius: 50%;\
  cursor: pointer; display: flex; align-items: center; justify-content: center; }\
.sgo-struct-dismiss:hover { background: rgba(124,58,237,0.2); }\
\
/* ── Reduced Motion ── */\
@media (prefers-reduced-motion: reduce) {\
  .sgo-tt { animation: none; }\
  .sgo-h-border, .sgo-p-stripe, .sgo-l-line { transition: none; }\
}\
';
  }
}
