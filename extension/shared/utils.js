// ═══════════════════════════════════════════════════════════════
// SHARED UTILITIES
// Helper functions used across content scripts and popup
// ═══════════════════════════════════════════════════════════════

const Utils = {
  /**
   * Get a letter grade from a numeric score
   */
  getGrade(score) {
    const grades = SCORING_CONFIG.combined.grades;
    for (const [grade, [min, max]] of Object.entries(grades)) {
      if (score >= min && score <= max) return grade;
    }
    return "F";
  },

  /**
   * Get color for a score value
   */
  getScoreColor(score) {
    if (score >= 80) return "#16a34a"; // green
    if (score >= 60) return "#f59e0b"; // amber
    return "#ef4444"; // red
  },

  /**
   * Truncate text to a maximum length with ellipsis
   */
  truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || "";
    return text.substring(0, maxLength) + "...";
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Debounce a function
   */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Simple hash for cache keys
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  },

  /**
   * Format a number with commas
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  /**
   * Calculate percentage
   */
  percentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }
};
