// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER (Background Script) for SEO & GEO Optimizer
// Handles API communication between content script and backend.
// MV3 service worker — no DOM access, no importScripts for ES modules.
// ═══════════════════════════════════════════════════════════════

const API_BASE = "http://localhost:8000";
const API_TIMEOUT = 30000;
const RETRY_MAX = 3;
const RETRY_BASE_DELAY = 1000;
const HEALTH_CHECK_INTERVAL = 60000;

// In-memory cache keyed by URL hash (for analysis results)
// and by tab ID (for popup access to latest scores).
const analysisCache = new Map();
const tabScores = new Map();

// Backend health state
let backendHealthy = true;
let lastHealthCheck = 0;

// Circuit breaker for LLM/backend failures
const circuitBreaker = {
  failures: 0,
  maxFailures: 3,
  cooldownMs: 120000,
  openedAt: 0,
  isOpen() {
    if (this.failures < this.maxFailures) return false;
    if (Date.now() - this.openedAt > this.cooldownMs) {
      this.failures = 0;
      return false;
    }
    return true;
  },
  recordFailure() {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.openedAt = Date.now();
    }
  },
  recordSuccess() {
    this.failures = 0;
  }
};

// ─── MESSAGE ROUTER ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // Content script (or popup) requests a full backend analysis
    case "ANALYZE_PAGE":
      handleAnalyzeRequest(message.data)
        .then((result) => sendResponse(result))
        .catch((err) =>
          sendResponse({
            geo_score: 0,
            geo_categories: {},
            geo_issues: [],
            suggestions: [],
            error: err.message
          })
        );
      return true; // keep channel open for async response

    // Popup asks for the most recent scores for the active tab
    case "REQUEST_SCORES": {
      const tabId = message.tabId || sender.tab?.id;
      if (tabId && tabScores.has(tabId)) {
        sendResponse(tabScores.get(tabId));
      } else {
        sendResponse(null);
      }
      return false;
    }

    // Content script broadcasts that local SEO scoring is done
    case "SCORES_READY": {
      const sourceTab = sender.tab?.id;
      if (sourceTab && message.data) {
        const score =
          message.data.combined_score?.score ??
          message.data.seo_score ??
          undefined;
        tabScores.set(sourceTab, message.data);
        if (score !== undefined) {
          updateBadge(sourceTab, Math.round(score));
        }
      }
      return false;
    }

    // Popup asks content script to export the current report
    case "EXPORT_SUGGESTIONS":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: "EXPORT_SUGGESTIONS" },
            sendResponse
          );
        } else {
          sendResponse({ error: "No active tab" });
        }
      });
      return true; // async

    // Popup asks content script to toggle overlays
    case "SHOW_OVERLAYS":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: "SHOW_OVERLAYS", data: message.data },
            sendResponse
          );
        } else {
          sendResponse({ error: "No active tab" });
        }
      });
      return true;

    default:
      return false;
  }
});

// ─── AUTH TOKEN ──────────────────────────────────────────────

async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["auth_token"], (data) => {
      resolve(data.auth_token || null);
    });
  });
}

async function getAuthHeaders() {
  const token = await getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  return headers;
}

// ─── HEALTH CHECK ────────────────────────────────────────────

async function checkBackendHealth() {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) return;
  lastHealthCheck = Date.now();
  try {
    const resp = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    backendHealthy = resp.ok;
    if (backendHealthy) circuitBreaker.recordSuccess();
  } catch (e) {
    backendHealthy = false;
  }
}

// ─── ANALYSIS REQUEST ────────────────────────────────────────

async function handleAnalyzeRequest(pageData) {
  if (!pageData || !pageData.url) {
    throw new Error("Missing page data");
  }

  // Check circuit breaker
  if (circuitBreaker.isOpen()) {
    throw new Error("Backend temporarily unavailable (circuit breaker open). SEO-only mode active.");
  }

  // Check cache — reuse if less than 1 hour old
  const cacheKey = hashURL(pageData.url);
  if (analysisCache.has(cacheKey)) {
    const cached = analysisCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.data;
    }
    analysisCache.delete(cacheKey);
  }

  const headers = await getAuthHeaders();

  // Retry with exponential backoff
  let lastError = null;
  for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(pageData),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Rate limit exceeded. Upgrade for more scans.");
      }

      if (response.status === 401) {
        // Token expired — clear auth
        chrome.storage.local.remove(["auth_token", "auth_user"]);
        throw new Error("Session expired. Please sign in again.");
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `API error ${response.status}${body ? ": " + body.substring(0, 200) : ""}`
        );
      }

      const result = await response.json();
      analysisCache.set(cacheKey, { timestamp: Date.now(), data: result });
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      // Don't retry on rate limit, auth, or circuit breaker errors
      if (error.message && (
        error.message.includes("429") ||
        error.message.includes("401") ||
        error.message.includes("circuit breaker")
      )) {
        throw error;
      }

      if (error.name === "AbortError") {
        lastError = new Error("Analysis request timed out");
      }

      if (attempt < RETRY_MAX - 1) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  circuitBreaker.recordFailure();
  throw lastError || new Error("Analysis failed after " + RETRY_MAX + " attempts");
}

// ─── BADGE ───────────────────────────────────────────────────

function updateBadge(tabId, score) {
  let color;
  if (score >= 80) {
    color = "#16a34a"; // green
  } else if (score >= 60) {
    color = "#f59e0b"; // amber
  } else {
    color = "#ef4444"; // red
  }

  chrome.action.setBadgeText({ text: String(score), tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Simple DJB2-style hash for cache keys.
 * Returns a short base-36 string.
 */
function hashURL(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// ─── LIFECYCLE ───────────────────────────────────────────────

// Clean up tab data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScores.delete(tabId);
});

// Clear badge when navigating to a new page within the same tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabScores.delete(tabId);
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

// Periodic health check
chrome.alarms.create("health-check", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "health-check") {
    checkBackendHealth();
  }
});
