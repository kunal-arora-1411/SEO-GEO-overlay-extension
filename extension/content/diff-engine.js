// ═══════════════════════════════════════════════════════════════
// DIFF ENGINE
// Word-level diff using Longest Common Subsequence (LCS)
// for showing granular text changes in the overlay
// ═══════════════════════════════════════════════════════════════

class DiffEngine {
  /**
   * Compute a word-level diff between two strings.
   *
   * @param {string} oldText — the original text
   * @param {string} newText — the modified text
   * @returns {Array<{type: string, value: string}>}
   *   Array of segments where type is 'equal', 'removed', or 'added'
   */
  diff(oldText, newText) {
    var oldTokens = this._tokenize(oldText);
    var newTokens = this._tokenize(newText);

    // Build the LCS table
    var lcsTable = this._buildLCSTable(oldTokens, newTokens);

    // Backtrack through the table to produce diff segments
    var rawSegments = this._backtrack(lcsTable, oldTokens, newTokens);

    // Merge consecutive segments of the same type for cleaner output
    return this._mergeSegments(rawSegments);
  }

  // ─── TOKENIZATION ──────────────────────────────────────────

  /**
   * Split text into word tokens, preserving whitespace as part
   * of the preceding word token for accurate reconstruction.
   *
   * @param {string} text
   * @returns {string[]} Array of word tokens
   */
  _tokenize(text) {
    if (!text) return [];

    // Split on whitespace boundaries, keeping the words only
    // We preserve the word boundaries so we can reconstruct
    // the text with proper spacing
    var tokens = text.split(/(\s+)/);
    var result = [];

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      // Skip empty tokens but keep whitespace-only tokens
      // as they will be joined back during rendering
      if (token.length > 0 && !/^\s+$/.test(token)) {
        result.push(token);
      }
    }

    return result;
  }

  // ─── LCS TABLE ─────────────────────────────────────────────

  /**
   * Build the LCS (Longest Common Subsequence) dynamic programming table.
   *
   * @param {string[]} oldTokens
   * @param {string[]} newTokens
   * @returns {number[][]} 2D DP table
   */
  _buildLCSTable(oldTokens, newTokens) {
    var m = oldTokens.length;
    var n = newTokens.length;

    // Create (m+1) x (n+1) table initialized to 0
    var table = new Array(m + 1);
    for (var i = 0; i <= m; i++) {
      table[i] = new Array(n + 1);
      for (var j = 0; j <= n; j++) {
        table[i][j] = 0;
      }
    }

    // Fill the table bottom-up
    for (var r = 1; r <= m; r++) {
      for (var c = 1; c <= n; c++) {
        if (oldTokens[r - 1] === newTokens[c - 1]) {
          table[r][c] = table[r - 1][c - 1] + 1;
        } else {
          table[r][c] = Math.max(table[r - 1][c], table[r][c - 1]);
        }
      }
    }

    return table;
  }

  // ─── BACKTRACKING ──────────────────────────────────────────

  /**
   * Backtrack through the LCS table to produce diff segments.
   *
   * @param {number[][]} table — LCS DP table
   * @param {string[]} oldTokens
   * @param {string[]} newTokens
   * @returns {Array<{type: string, value: string}>} Raw diff segments
   */
  _backtrack(table, oldTokens, newTokens) {
    var segments = [];
    var i = oldTokens.length;
    var j = newTokens.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
        // Words match — equal segment
        segments.push({ type: "equal", value: oldTokens[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
        // Word added in new text
        segments.push({ type: "added", value: newTokens[j - 1] });
        j--;
      } else if (i > 0) {
        // Word removed from old text
        segments.push({ type: "removed", value: oldTokens[i - 1] });
        i--;
      }
    }

    // Reverse because we backtracked from the end
    segments.reverse();

    return segments;
  }

  // ─── MERGING ───────────────────────────────────────────────

  /**
   * Merge consecutive segments of the same type into single segments.
   *
   * @param {Array<{type: string, value: string}>} segments
   * @returns {Array<{type: string, value: string}>} Merged segments
   */
  _mergeSegments(segments) {
    if (segments.length === 0) return segments;

    var merged = [];
    var current = {
      type: segments[0].type,
      value: segments[0].value
    };

    for (var i = 1; i < segments.length; i++) {
      if (segments[i].type === current.type) {
        current.value += " " + segments[i].value;
      } else {
        merged.push(current);
        current = {
          type: segments[i].type,
          value: segments[i].value
        };
      }
    }

    merged.push(current);
    return merged;
  }
}
