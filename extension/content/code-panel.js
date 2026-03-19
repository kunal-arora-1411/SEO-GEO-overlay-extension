// ═══════════════════════════════════════════════════════════════
// CODE PANEL
// Renders copyable, syntax-highlighted code blocks in Shadow DOM
// for JSON-LD schema, meta tags, and llms.txt snippets
// ═══════════════════════════════════════════════════════════════

class CodePanel {
  constructor() {
    this._container = null;
    this._shadowRoot = null;
    this._visible = false;
    this._tabs = [];
    this._activeTab = 0;
  }

  // ─── PUBLIC API ──────────────────────────────────────────

  /**
   * Show a code panel with one or more tabs of content.
   * @param {Array} tabs — [{label: "Schema", language: "json", code: "..."}]
   * @param {Object} position — {top, right} in pixels
   */
  show(tabs, position) {
    this.hide();

    this._tabs = tabs || [];
    this._activeTab = 0;

    if (this._tabs.length === 0) return;

    // Create container
    this._container = document.createElement("div");
    this._container.id = "seo-geo-code-panel";
    this._shadowRoot = this._container.attachShadow({ mode: "closed" });

    // Inject styles
    var styleEl = document.createElement("style");
    styleEl.textContent = this._getCSS();
    this._shadowRoot.appendChild(styleEl);

    // Build panel
    var panel = document.createElement("div");
    panel.className = "code-panel";

    // Header with tabs and close button
    var header = document.createElement("div");
    header.className = "code-panel__header";

    var tabBar = document.createElement("div");
    tabBar.className = "code-panel__tabs";

    var self = this;
    this._tabs.forEach(function (tab, idx) {
      var tabEl = document.createElement("button");
      tabEl.className = "code-panel__tab" + (idx === 0 ? " active" : "");
      tabEl.textContent = tab.label;
      tabEl.addEventListener("click", function () {
        self._switchTab(idx);
      });
      tabBar.appendChild(tabEl);
    });

    var closeBtn = document.createElement("button");
    closeBtn.className = "code-panel__close";
    closeBtn.textContent = "\u00D7"; // ×
    closeBtn.addEventListener("click", function () {
      self.hide();
    });

    header.appendChild(tabBar);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Code content area
    var codeArea = document.createElement("div");
    codeArea.className = "code-panel__content";

    var pre = document.createElement("pre");
    var code = document.createElement("code");
    code.textContent = this._tabs[0].code || "";
    pre.appendChild(code);
    codeArea.appendChild(pre);

    this._codeElement = code;
    panel.appendChild(codeArea);

    // Action buttons
    var actions = document.createElement("div");
    actions.className = "code-panel__actions";

    var copyBtn = document.createElement("button");
    copyBtn.className = "code-panel__btn code-panel__btn--copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", function () {
      var text = self._tabs[self._activeTab].code || "";
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = "Copied!";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
      }).catch(function () {
        copyBtn.textContent = "Failed";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
      });
    });

    var downloadBtn = document.createElement("button");
    downloadBtn.className = "code-panel__btn code-panel__btn--download";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", function () {
      var tab = self._tabs[self._activeTab];
      var ext = tab.language === "json" ? ".json" : ".txt";
      var filename = (tab.label || "code").toLowerCase().replace(/\s+/g, "-") + ext;
      var blob = new Blob([tab.code || ""], { type: "text/plain" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);
    panel.appendChild(actions);

    this._shadowRoot.appendChild(panel);
    this._panelElement = panel;

    // Position
    if (position) {
      this._container.style.position = "fixed";
      this._container.style.top = (position.top || 20) + "px";
      this._container.style.right = (position.right || 20) + "px";
      this._container.style.zIndex = "2147483647";
    }

    document.body.appendChild(this._container);
    this._visible = true;
  }

  /**
   * Hide and remove the code panel.
   */
  hide() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._shadowRoot = null;
    this._visible = false;
  }

  /**
   * Whether the panel is currently visible.
   */
  get isVisible() {
    return this._visible;
  }

  // ─── INTERNAL ────────────────────────────────────────────

  _switchTab(idx) {
    this._activeTab = idx;
    this._codeElement.textContent = this._tabs[idx].code || "";

    // Update tab active states
    var tabs = this._shadowRoot.querySelectorAll(".code-panel__tab");
    tabs.forEach(function (tab, i) {
      if (i === idx) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  _getCSS() {
    return [
      "*, *::before, *::after {",
      "  box-sizing: border-box;",
      "  margin: 0;",
      "  padding: 0;",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      "}",
      "",
      ".code-panel {",
      "  width: 420px;",
      "  max-height: 500px;",
      "  background: #1e293b;",
      "  border-radius: 10px;",
      "  box-shadow: 0 12px 40px rgba(0,0,0,0.3);",
      "  overflow: hidden;",
      "  display: flex;",
      "  flex-direction: column;",
      "}",
      "",
      ".code-panel__header {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  padding: 8px 12px;",
      "  background: #0f172a;",
      "  border-bottom: 1px solid #334155;",
      "}",
      "",
      ".code-panel__tabs {",
      "  display: flex;",
      "  gap: 4px;",
      "}",
      "",
      ".code-panel__tab {",
      "  padding: 4px 10px;",
      "  background: transparent;",
      "  border: none;",
      "  border-radius: 4px;",
      "  color: #94a3b8;",
      "  font-size: 11px;",
      "  font-weight: 600;",
      "  cursor: pointer;",
      "  transition: all 0.15s ease;",
      "}",
      "",
      ".code-panel__tab:hover {",
      "  color: #e2e8f0;",
      "  background: #1e293b;",
      "}",
      "",
      ".code-panel__tab.active {",
      "  color: #a78bfa;",
      "  background: #1e293b;",
      "}",
      "",
      ".code-panel__close {",
      "  width: 24px;",
      "  height: 24px;",
      "  background: transparent;",
      "  border: none;",
      "  color: #64748b;",
      "  font-size: 18px;",
      "  cursor: pointer;",
      "  border-radius: 4px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "}",
      "",
      ".code-panel__close:hover {",
      "  color: #ef4444;",
      "  background: rgba(239,68,68,0.1);",
      "}",
      "",
      ".code-panel__content {",
      "  flex: 1;",
      "  overflow: auto;",
      "  max-height: 380px;",
      "  padding: 12px;",
      "}",
      "",
      ".code-panel__content pre {",
      "  margin: 0;",
      "  white-space: pre-wrap;",
      "  word-break: break-word;",
      "}",
      "",
      ".code-panel__content code {",
      "  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;",
      "  font-size: 12px;",
      "  line-height: 1.6;",
      "  color: #e2e8f0;",
      "}",
      "",
      ".code-panel__actions {",
      "  display: flex;",
      "  gap: 8px;",
      "  padding: 8px 12px;",
      "  background: #0f172a;",
      "  border-top: 1px solid #334155;",
      "}",
      "",
      ".code-panel__btn {",
      "  padding: 5px 12px;",
      "  border: none;",
      "  border-radius: 5px;",
      "  font-size: 11px;",
      "  font-weight: 600;",
      "  cursor: pointer;",
      "  transition: opacity 0.15s ease;",
      "}",
      "",
      ".code-panel__btn:hover {",
      "  opacity: 0.85;",
      "}",
      "",
      ".code-panel__btn--copy {",
      "  background: #7c3aed;",
      "  color: #ffffff;",
      "}",
      "",
      ".code-panel__btn--download {",
      "  background: #334155;",
      "  color: #e2e8f0;",
      "}"
    ].join("\n");
  }
}
