// ═══════════════════════════════════════════════════════════════
// POPUP LOGIC — SEO & GEO Optimizer
// Manages the popup dashboard UI, communicates with the service
// worker and content script to display scores and issues.
// ═══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // Circumference for the SVG gauge circles (2 * PI * r, where r = 54)
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 54; // 339.292...

  // ─── DOM REFERENCES ──────────────────────────────────────

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const panels = {
    initial:  $("#initial-state"),
    loading:  $("#loading-state"),
    error:    $("#error-state"),
    results:  $("#results-state")
  };

  const els = {
    analyzeBtn:     $("#analyze-btn"),
    retryBtn:       $("#retry-btn"),
    reanalyzeBtn:   $("#reanalyze-btn"),
    exportBtn:      $("#export-btn"),
    toggleOverlays: $("#toggle-overlays-btn"),
    loadingText:    $("#loading-text"),
    errorText:      $("#error-text"),
    seoCircle:      $("#seo-circle"),
    geoCircle:      $("#geo-circle"),
    seoValue:       $("#seo-value"),
    geoValue:       $("#geo-value"),
    combinedGrade:  $("#combined-grade"),
    combinedValue:  $("#combined-value"),
    geoStatus:      $("#geo-status"),
    geoStatusDot:   $(".geo-status-dot"),
    geoStatusText:  $("#geo-status-text"),
    issueCount:     $("#issue-count"),
    issuesList:     $("#issues-list"),
    suggestionCount:  $("#suggestion-count"),
    suggestionsList:  $("#suggestions-list")
  };

  // Auth elements
  const authEls = {
    authState:      $("#auth-state"),
    loginForm:      $("#auth-login-form"),
    registerForm:   $("#auth-register-form"),
    loginEmail:     $("#login-email"),
    loginPassword:  $("#login-password"),
    loginBtn:       $("#login-btn"),
    authError:      $("#auth-error"),
    registerName:   $("#register-name"),
    registerEmail:  $("#register-email"),
    registerPassword: $("#register-password"),
    registerBtn:    $("#register-btn"),
    registerError:  $("#register-error"),
    showRegister:   $("#show-register"),
    showLogin:      $("#show-login"),
    skipAuthBtn:    $("#skip-auth-btn"),
    userBar:        $("#user-bar"),
    userEmail:      $("#user-email"),
    userTier:       $("#user-tier"),
    logoutBtn:      $("#logout-btn")
  };

  // Track overlay visibility state
  let overlaysVisible = false;

  // ─── INIT ────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindEvents();
    checkAuth();
  }

  function bindEvents() {
    els.analyzeBtn.addEventListener("click", startAnalysis);
    els.retryBtn.addEventListener("click", startAnalysis);
    els.reanalyzeBtn.addEventListener("click", startAnalysis);
    els.exportBtn.addEventListener("click", handleExport);
    els.toggleOverlays.addEventListener("click", handleToggleOverlays);

    // Auth bindings
    authEls.loginBtn.addEventListener("click", handleLogin);
    authEls.registerBtn.addEventListener("click", handleRegister);
    authEls.showRegister.addEventListener("click", (e) => {
      e.preventDefault();
      authEls.loginForm.classList.add("hidden");
      authEls.registerForm.classList.remove("hidden");
    });
    authEls.showLogin.addEventListener("click", (e) => {
      e.preventDefault();
      authEls.registerForm.classList.add("hidden");
      authEls.loginForm.classList.remove("hidden");
    });
    authEls.skipAuthBtn.addEventListener("click", () => {
      chrome.storage.local.set({ auth_skipped: true });
      showState("initial");
      loadExistingResults();
    });
    authEls.logoutBtn.addEventListener("click", handleLogout);

    // Enter key in auth forms
    authEls.loginPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleLogin();
    });
    authEls.registerPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleRegister();
    });
  }

  // ─── AUTH ──────────────────────────────────────────────────

  function checkAuth() {
    chrome.storage.local.get(["auth_token", "auth_user", "auth_skipped"], (data) => {
      if (data.auth_token && data.auth_user) {
        showUserBar(data.auth_user);
        loadExistingResults();
      } else if (data.auth_skipped) {
        showState("initial");
        loadExistingResults();
      } else {
        showState("auth");
      }
    });
  }

  function showUserBar(user) {
    authEls.userBar.classList.remove("hidden");
    authEls.userEmail.textContent = user.email || "";
    const tier = (user.tier || "free").toLowerCase();
    authEls.userTier.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
    authEls.userTier.className = "user-tier " + tier;
    showState("initial");
  }

  async function handleLogin() {
    const email = authEls.loginEmail.value.trim();
    const password = authEls.loginPassword.value;
    if (!email || !password) {
      showAuthError(authEls.authError, "Please enter email and password.");
      return;
    }
    authEls.loginBtn.disabled = true;
    authEls.loginBtn.textContent = "Signing in...";
    try {
      const apiBase = SCORING_CONFIG.api.base_url;
      const resp = await fetch(apiBase + "/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) {
        showAuthError(authEls.authError, data.detail || "Login failed.");
        return;
      }
      // Fetch user info
      const meResp = await fetch(apiBase + "/api/v1/auth/me", {
        headers: { "Authorization": "Bearer " + data.access_token }
      });
      const user = await meResp.json();
      chrome.storage.local.set({
        auth_token: data.access_token,
        auth_user: user,
        auth_skipped: false
      });
      showUserBar(user);
      loadExistingResults();
    } catch (err) {
      showAuthError(authEls.authError, "Network error. Is the backend running?");
    } finally {
      authEls.loginBtn.disabled = false;
      authEls.loginBtn.textContent = "Sign In";
    }
  }

  async function handleRegister() {
    const display_name = authEls.registerName.value.trim();
    const email = authEls.registerEmail.value.trim();
    const password = authEls.registerPassword.value;
    if (!email || !password) {
      showAuthError(authEls.registerError, "Please enter email and password.");
      return;
    }
    if (password.length < 8) {
      showAuthError(authEls.registerError, "Password must be at least 8 characters.");
      return;
    }
    authEls.registerBtn.disabled = true;
    authEls.registerBtn.textContent = "Creating account...";
    try {
      const apiBase = SCORING_CONFIG.api.base_url;
      const resp = await fetch(apiBase + "/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, display_name: display_name || undefined })
      });
      const data = await resp.json();
      if (!resp.ok) {
        showAuthError(authEls.registerError, data.detail || "Registration failed.");
        return;
      }
      const meResp = await fetch(apiBase + "/api/v1/auth/me", {
        headers: { "Authorization": "Bearer " + data.access_token }
      });
      const user = await meResp.json();
      chrome.storage.local.set({
        auth_token: data.access_token,
        auth_user: user,
        auth_skipped: false
      });
      showUserBar(user);
      loadExistingResults();
    } catch (err) {
      showAuthError(authEls.registerError, "Network error. Is the backend running?");
    } finally {
      authEls.registerBtn.disabled = false;
      authEls.registerBtn.textContent = "Create Account";
    }
  }

  function handleLogout() {
    chrome.storage.local.remove(["auth_token", "auth_user", "auth_skipped"]);
    authEls.userBar.classList.add("hidden");
    showState("auth");
  }

  function showAuthError(el, message) {
    el.textContent = message;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  }

  // ─── STATE MANAGEMENT ────────────────────────────────────

  function showState(stateName) {
    // Include auth-state in panel management
    const allPanels = { ...panels, auth: authEls.authState };
    for (const [name, panel] of Object.entries(allPanels)) {
      if (name === stateName) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    }
  }

  // ─── LOAD EXISTING RESULTS ──────────────────────────────

  function loadExistingResults() {
    getActiveTabId((tabId) => {
      if (!tabId) return;

      chrome.runtime.sendMessage(
        { type: "REQUEST_SCORES", tabId: tabId },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (response) {
            displayResults(response);
          }
        }
      );
    });
  }

  // ─── ANALYSIS FLOW ──────────────────────────────────────

  function startAnalysis() {
    showState("loading");
    setLoadingText("Extracting page content...");

    getActiveTabId((tabId) => {
      if (!tabId) {
        showError("No active tab found. Please open a web page and try again.");
        return;
      }

      // Ask content script to extract and score the page
      chrome.tabs.sendMessage(
        tabId,
        { type: "ANALYZE_PAGE" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Content script might not be injected
            showError(
              "Could not connect to the page. " +
              "Refresh the page and try again."
            );
            return;
          }

          if (response && response.error) {
            showError(response.error);
            return;
          }

          if (response) {
            displayResults(response);
          }
        }
      );
    });

    // Also listen for progressive updates while loading
    chrome.runtime.onMessage.addListener(function progressListener(message) {
      if (message.type === "SCORES_READY") {
        chrome.runtime.onMessage.removeListener(progressListener);
        displayResults(message.data);
      }
    });
  }

  function setLoadingText(text) {
    els.loadingText.textContent = text;
  }

  // ─── DISPLAY RESULTS ────────────────────────────────────

  function displayResults(data) {
    showState("results");

    // SEO score
    const seoScore = data.seo_score ?? 0;
    updateScoreGauge("seo", seoScore);

    // GEO score — might not be available yet
    const geoScore = data.geo_score ?? null;
    if (geoScore !== null && geoScore !== undefined) {
      updateScoreGauge("geo", geoScore);
      setGeoStatus("done", "GEO analysis complete");
    } else {
      resetGauge("geo");
      setGeoStatus("pending", "GEO analysis pending...");

      // If there is page data, request backend GEO analysis
      if (data.page_data) {
        setLoadingText("Running GEO analysis...");
        requestGeoAnalysis(data.page_data, seoScore);
      }
    }

    // Combined score
    const combinedData = data.combined_score || null;
    if (combinedData) {
      updateCombinedScore(combinedData.score, combinedData.grade);
    } else if (geoScore !== null) {
      // Calculate combined from available scores
      const seoWeight = 0.4;
      const geoWeight = 0.6;
      const combined = Math.round(seoScore * seoWeight + geoScore * geoWeight);
      const grade = getGrade(combined);
      updateCombinedScore(combined, grade);
    } else {
      // Only SEO available — show partial
      updateCombinedScore(null, "-");
    }

    // Issues
    const issues = data.issues || [];
    renderIssues(issues);

    // Suggestions
    const suggestions = data.suggestions || data.geo_suggestions || [];
    renderSuggestions(suggestions);
  }

  // ─── GEO ANALYSIS REQUEST ───────────────────────────────

  function requestGeoAnalysis(pageData, seoScore) {
    chrome.runtime.sendMessage(
      { type: "ANALYZE_PAGE", data: pageData },
      (response) => {
        if (chrome.runtime.lastError) {
          setGeoStatus("error", "GEO analysis unavailable");
          return;
        }

        if (response && response.error) {
          setGeoStatus("error", "GEO: " + response.error);
          return;
        }

        if (response) {
          const geoScore = response.geo_score ?? 0;
          updateScoreGauge("geo", geoScore);
          setGeoStatus("done", "GEO analysis complete");

          // Recalculate combined
          const combined = Math.round(seoScore * 0.4 + geoScore * 0.6);
          const grade = getGrade(combined);
          updateCombinedScore(combined, grade);

          // Render GEO suggestions if available
          if (response.suggestions && response.suggestions.length > 0) {
            renderSuggestions(response.suggestions);
          }

          // Render GEO issues if available
          if (response.geo_issues && response.geo_issues.length > 0) {
            const existingIssues = getCurrentIssues();
            renderIssues([...existingIssues, ...response.geo_issues]);
          }
        }
      }
    );
  }

  // ─── SCORE GAUGES ────────────────────────────────────────

  function updateScoreGauge(type, score) {
    score = Math.max(0, Math.min(100, Math.round(score)));
    const circle = type === "seo" ? els.seoCircle : els.geoCircle;
    const valueEl = type === "seo" ? els.seoValue : els.geoValue;

    // Calculate stroke-dashoffset: full circumference = hidden, 0 = full
    const offset = GAUGE_CIRCUMFERENCE * (1 - score / 100);
    circle.style.strokeDashoffset = offset;

    // Apply color
    const color = getScoreColor(score);
    circle.style.stroke = color;

    // Animate the number
    animateValue(valueEl, score);

    // Color the value text
    valueEl.style.color = color;
  }

  function resetGauge(type) {
    const circle = type === "seo" ? els.seoCircle : els.geoCircle;
    const valueEl = type === "seo" ? els.seoValue : els.geoValue;

    circle.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
    circle.style.stroke = "#e2e8f0";
    valueEl.textContent = "--";
    valueEl.style.color = "#94a3b8";
  }

  function animateValue(el, target) {
    const duration = 600;
    const start = parseInt(el.textContent, 10) || 0;
    const diff = target - start;

    if (diff === 0) {
      el.textContent = target;
      return;
    }

    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function updateCombinedScore(score, grade) {
    if (score === null || score === undefined) {
      els.combinedGrade.textContent = grade || "-";
      els.combinedValue.textContent = "--";
      els.combinedGrade.className = "grade-letter";
      return;
    }

    score = Math.round(score);
    grade = grade || getGrade(score);

    els.combinedGrade.textContent = grade;
    els.combinedValue.textContent = score + "/100";

    // Grade color
    const colorClass = score >= 80 ? "grade-green"
                     : score >= 60 ? "grade-amber"
                     : "grade-red";
    els.combinedGrade.className = "grade-letter " + colorClass;
  }

  // ─── GEO STATUS BAR ─────────────────────────────────────

  function setGeoStatus(state, text) {
    els.geoStatusDot.className = "geo-status-dot " + state;
    els.geoStatusText.textContent = text;

    if (state === "done") {
      // Hide after a brief pause so the user sees completion
      setTimeout(() => {
        els.geoStatus.classList.add("hidden");
      }, 3000);
    } else {
      els.geoStatus.classList.remove("hidden");
    }
  }

  // ─── ISSUES ──────────────────────────────────────────────

  // Severity ordering: error > warning > info
  const SEVERITY_ORDER = { error: 0, warning: 1, info: 2, success: 3 };
  const SEVERITY_ICONS = { error: "E", warning: "W", info: "i" };

  function renderIssues(issues) {
    els.issueCount.textContent = issues.length;
    els.issuesList.innerHTML = "";

    if (issues.length === 0) {
      els.issuesList.innerHTML =
        '<div class="no-items">No issues detected. Great job!</div>';
      return;
    }

    // Sort: errors first, then warnings, then info
    const sorted = [...issues].sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.severity || a.type || "info"] ?? 2;
      const bOrder = SEVERITY_ORDER[b.severity || b.type || "info"] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Secondary sort by impact score (higher first)
      return (b.impact || 0) - (a.impact || 0);
    });

    const fragment = document.createDocumentFragment();

    sorted.forEach((issue) => {
      const severity = issue.severity || issue.type || "info";

      const card = document.createElement("div");
      card.className = "issue-card " + severity;

      const dot = document.createElement("div");
      dot.className = "issue-severity " + severity;
      dot.textContent = SEVERITY_ICONS[severity] || "i";

      const body = document.createElement("div");
      body.className = "issue-body";

      const title = document.createElement("div");
      title.className = "issue-title";
      title.textContent = issue.message || issue.title || "Issue";

      body.appendChild(title);

      if (issue.detail || issue.recommendation) {
        const detail = document.createElement("div");
        detail.className = "issue-detail";
        detail.textContent = issue.detail || issue.recommendation;
        body.appendChild(detail);
      }

      card.appendChild(dot);
      card.appendChild(body);
      fragment.appendChild(card);
    });

    els.issuesList.appendChild(fragment);
  }

  /**
   * Read back the currently rendered issues so we can merge
   * GEO issues in without losing SEO issues.
   */
  function getCurrentIssues() {
    const cards = els.issuesList.querySelectorAll(".issue-card");
    const issues = [];
    cards.forEach((card) => {
      const title = card.querySelector(".issue-title");
      const detail = card.querySelector(".issue-detail");
      const severity = card.classList.contains("error")   ? "error"
                     : card.classList.contains("warning") ? "warning"
                     : "info";
      issues.push({
        severity: severity,
        message: title ? title.textContent : "",
        detail: detail ? detail.textContent : ""
      });
    });
    return issues;
  }

  // ─── SUGGESTIONS ─────────────────────────────────────────

  function renderSuggestions(suggestions) {
    els.suggestionCount.textContent = suggestions.length;
    els.suggestionsList.innerHTML = "";

    if (suggestions.length === 0) {
      els.suggestionsList.innerHTML =
        '<div class="no-items">No suggestions at this time.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    suggestions.forEach((sug) => {
      const card = document.createElement("div");
      card.className = "suggestion-card";

      const typeLabel = document.createElement("div");
      typeLabel.className = "suggestion-type";
      typeLabel.textContent = sug.category || sug.type || "Suggestion";

      const text = document.createElement("div");
      text.className = "suggestion-text";
      text.textContent = sug.text || sug.message || sug.suggestion || "";

      card.appendChild(typeLabel);
      card.appendChild(text);
      fragment.appendChild(card);
    });

    els.suggestionsList.appendChild(fragment);
  }

  // ─── EXPORT ──────────────────────────────────────────────

  function handleExport() {
    // Build a plain-text report from the currently displayed data
    let report = "SEO & GEO Optimizer Report\n";
    report += "==========================\n\n";

    // Scores
    const seo = els.seoValue.textContent;
    const geo = els.geoValue.textContent;
    const combined = els.combinedValue.textContent;
    const grade = els.combinedGrade.textContent;

    report += "Scores\n";
    report += "------\n";
    report += "  SEO:      " + seo + "/100\n";
    report += "  GEO:      " + geo + "/100\n";
    report += "  Combined: " + combined + " (Grade: " + grade + ")\n\n";

    // Issues
    const issueCards = els.issuesList.querySelectorAll(".issue-card");
    report += "Issues (" + issueCards.length + ")\n";
    report += "------\n";
    issueCards.forEach((card) => {
      const severity = card.classList.contains("error")   ? "ERROR"
                     : card.classList.contains("warning") ? "WARN"
                     : "INFO";
      const title = card.querySelector(".issue-title");
      const detail = card.querySelector(".issue-detail");
      report += "  [" + severity + "] " + (title ? title.textContent : "") + "\n";
      if (detail) {
        report += "          " + detail.textContent + "\n";
      }
    });
    report += "\n";

    // Suggestions
    const sugCards = els.suggestionsList.querySelectorAll(".suggestion-card");
    report += "Suggestions (" + sugCards.length + ")\n";
    report += "-----------\n";
    sugCards.forEach((card) => {
      const type = card.querySelector(".suggestion-type");
      const text = card.querySelector(".suggestion-text");
      report += "  [" + (type ? type.textContent : "") + "] ";
      report += (text ? text.textContent : "") + "\n";
    });

    // Copy to clipboard
    navigator.clipboard.writeText(report).then(
      () => showToast("Report copied to clipboard"),
      () => showToast("Failed to copy report")
    );
  }

  // ─── TOGGLE OVERLAYS ────────────────────────────────────

  function handleToggleOverlays() {
    overlaysVisible = !overlaysVisible;

    getActiveTabId((tabId) => {
      if (!tabId) return;

      chrome.tabs.sendMessage(
        tabId,
        {
          type: "SHOW_OVERLAYS",
          data: { visible: overlaysVisible }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            showToast("Could not toggle overlays");
            overlaysVisible = !overlaysVisible; // revert
            return;
          }
        }
      );
    });

    els.toggleOverlays.textContent =
      overlaysVisible ? "Hide Overlays" : "Show Overlays";
  }

  // ─── ERROR DISPLAY ───────────────────────────────────────

  function showError(message) {
    els.errorText.textContent = message;
    showState("error");
  }

  // ─── TOAST ───────────────────────────────────────────────

  function showToast(message) {
    // Remove existing toast if present
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow then animate in
    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── HELPERS ─────────────────────────────────────────────

  function getScoreColor(score) {
    if (score >= 80) return "#16a34a"; // green
    if (score >= 60) return "#f59e0b"; // amber
    return "#ef4444"; // red
  }

  function getGrade(score) {
    // Use shared Utils if available, otherwise inline
    if (typeof Utils !== "undefined" && Utils.getGrade) {
      return Utils.getGrade(score);
    }
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  }

  function getActiveTabId(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      callback(tabs && tabs[0] ? tabs[0].id : null);
    });
  }

})();
