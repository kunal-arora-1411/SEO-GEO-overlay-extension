// ═══════════════════════════════════════════════════════════════
// READABILITY SCORER
// Calculates Flesch Reading Ease, Flesch-Kincaid Grade Level,
// and SMOG Index for extracted page text
// ═══════════════════════════════════════════════════════════════

class ReadabilityScorer {
  /**
   * Analyze text and return readability metrics.
   * @param {string} text — raw body text
   * @returns {Object} scores and stats
   */
  analyze(text) {
    if (!text || text.trim().length === 0) {
      return this._emptyResult();
    }

    var words = this._countWords(text);
    var sentences = this._countSentences(text);
    var syllables = this._countTotalSyllables(text);
    var polysyllables = this._countPolysyllables(text);

    if (words === 0 || sentences === 0) {
      return this._emptyResult();
    }

    var avgSentenceLength = words / sentences;
    var avgSyllablesPerWord = syllables / words;

    return {
      flesch_reading_ease: this._fleschReadingEase(
        words,
        sentences,
        syllables
      ),
      flesch_kincaid_grade: this._fleschKincaidGrade(
        words,
        sentences,
        syllables
      ),
      smog_index: this._smogIndex(sentences, polysyllables),
      stats: {
        word_count: words,
        sentence_count: sentences,
        syllable_count: syllables,
        polysyllable_count: polysyllables,
        avg_sentence_length:
          Math.round(avgSentenceLength * 10) / 10,
        avg_syllables_per_word:
          Math.round(avgSyllablesPerWord * 100) / 100
      }
    };
  }

  // ─── FORMULAS ────────────────────────────────────────────────

  /**
   * Flesch Reading Ease
   * 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
   * Target: 60-80 (plain English)
   */
  _fleschReadingEase(words, sentences, syllables) {
    var score =
      206.835 -
      1.015 * (words / sentences) -
      84.6 * (syllables / words);
    // Clamp to 0-100
    return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  }

  /**
   * Flesch-Kincaid Grade Level
   * 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
   * Target: 6-10 (broadly accessible)
   */
  _fleschKincaidGrade(words, sentences, syllables) {
    var grade =
      0.39 * (words / sentences) +
      11.8 * (syllables / words) -
      15.59;
    return Math.round(Math.max(0, grade) * 10) / 10;
  }

  /**
   * SMOG Index
   * 1.043 * sqrt(polysyllables * (30 / sentences)) + 3.1291
   * Requires at least 3 sentences for a reliable estimate.
   */
  _smogIndex(sentences, polysyllables) {
    if (sentences < 3) return 0;
    var smog =
      1.043 * Math.sqrt(polysyllables * (30 / sentences)) + 3.1291;
    return Math.round(Math.max(0, smog) * 10) / 10;
  }

  // ─── COUNTING HELPERS ───────────────────────────────────────

  /**
   * Count words by splitting on whitespace.
   */
  _countWords(text) {
    return text
      .trim()
      .split(/\s+/)
      .filter(function (w) { return w.length > 0; }).length;
  }

  /**
   * Count sentences by splitting on sentence-ending punctuation.
   * Filters out fragments with fewer than 3 words.
   */
  _countSentences(text) {
    var parts = text.split(/[.!?]+/).filter(function (s) {
      var trimmed = s.trim();
      if (trimmed.length === 0) return false;
      var wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      return wordCount > 2;
    });
    return Math.max(parts.length, 1);
  }

  /**
   * Sum syllables across all words.
   */
  _countTotalSyllables(text) {
    var self = this;
    return text
      .trim()
      .split(/\s+/)
      .filter(function (w) { return w.length > 0; })
      .reduce(function (sum, word) {
        return sum + self._syllablesInWord(word);
      }, 0);
  }

  /**
   * Count words with 3+ syllables (polysyllabic words).
   */
  _countPolysyllables(text) {
    var self = this;
    return text
      .trim()
      .split(/\s+/)
      .filter(function (w) { return w.length > 0; })
      .filter(function (word) {
        return self._syllablesInWord(word) >= 3;
      }).length;
  }

  /**
   * Estimate the number of syllables in a single word.
   *
   * Algorithm:
   *  1. Lowercase and strip non-alpha characters.
   *  2. Words of 3 or fewer letters are treated as 1 syllable.
   *  3. Remove common silent suffixes (es, ed) that don't add a syllable.
   *  4. Count groups of consecutive vowels (a, e, i, o, u, y).
   *  5. Ensure at least 1 syllable.
   */
  _syllablesInWord(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length === 0) return 0;
    if (word.length <= 3) return 1;

    // Remove silent trailing "e"
    word = word.replace(/e$/, "");

    // Remove silent suffixes that don't contribute a vowel sound
    word = word.replace(/(?:es|ed)$/, function (match) {
      // Keep the suffix if removing it would leave nothing
      return "";
    });

    // If the word got too short after stripping, restore minimum
    if (word.length === 0) return 1;

    // Count vowel groups
    var vowelGroups = word.match(/[aeiouy]+/g);
    var count = vowelGroups ? vowelGroups.length : 0;

    return Math.max(1, count);
  }

  // ─── EMPTY RESULT ───────────────────────────────────────────

  _emptyResult() {
    return {
      flesch_reading_ease: 0,
      flesch_kincaid_grade: 0,
      smog_index: 0,
      stats: {
        word_count: 0,
        sentence_count: 0,
        syllable_count: 0,
        polysyllable_count: 0,
        avg_sentence_length: 0,
        avg_syllables_per_word: 0
      }
    };
  }
}
