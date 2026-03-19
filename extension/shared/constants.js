// ═══════════════════════════════════════════════════════════════
// SCORING WEIGHTS & THRESHOLDS
// All scoring rules from Phase 0 research encoded as config
// ═══════════════════════════════════════════════════════════════

const SCORING_CONFIG = {

  // ─── SEO SCORING (100 points total) ───────────────────────
  seo: {
    title: {
      weight_total: 15,
      rules: {
        exists: { weight: 3 },
        length: { weight: 4, min: 40, max: 60 },
        keyword_position: { weight: 3, max_position_pct: 0.5 },
        uniqueness: { weight: 2, generic_patterns: [
          /^home$/i, /^welcome$/i, /^page\s*\d*$/i, /^untitled/i,
          /^document$/i, /^index$/i, /^test$/i
        ]},
        modifier: { weight: 1, modifiers: [
          "2026", "2025", "guide", "best", "how to", "review",
          "vs", "top", "complete", "ultimate", "free", "step"
        ]},
        brand_position: { weight: 2 }
      }
    },

    meta_description: {
      weight_total: 10,
      rules: {
        exists: { weight: 3 },
        length: { weight: 3, min: 120, max: 160 },
        contains_keyword: { weight: 2 },
        has_cta: { weight: 1, cta_words: [
          "learn", "discover", "get", "find", "try", "start",
          "explore", "download", "sign up", "join", "read", "see"
        ]},
        not_duplicate_title: { weight: 1 }
      }
    },

    headings: {
      weight_total: 15,
      rules: {
        single_h1: { weight: 4 },
        hierarchy_valid: { weight: 4 },
        h2_count: { weight: 3, min: 2, max: 8 },
        descriptive: { weight: 2, generic_labels: [
          /^introduction$/i, /^section\s*\d+$/i, /^conclusion$/i,
          /^overview$/i, /^summary$/i, /^details$/i
        ]},
        question_headings: { weight: 2, min_pct: 0.15 }
      }
    },

    content: {
      weight_total: 25,
      rules: {
        word_count: { weight: 4, thresholds: {
          blog: { min: 800, optimal_min: 1200, optimal_max: 2500 },
          landing: { min: 300, optimal_min: 500, optimal_max: 1000 },
          product: { min: 200, optimal_min: 300, optimal_max: 800 },
          default: { min: 500, optimal_min: 800, optimal_max: 2000 }
        }},
        readability: { weight: 5, fk_grade_min: 6, fk_grade_max: 10,
                       fre_min: 60, fre_max: 80 },
        paragraph_length: { weight: 3, max_sentences: 5 },
        sentence_length: { weight: 3, max_words: 20 },
        internal_links: { weight: 3, per_1000_words: 2 },
        external_links: { weight: 2, per_1000_words: 1 },
        image_optimization: { weight: 3 },
        keyword_density: { weight: 2, min_pct: 0.01, max_pct: 0.03 }
      }
    },

    technical: {
      weight_total: 15,
      rules: {
        canonical: { weight: 3 },
        viewport: { weight: 2 },
        open_graph: { weight: 2 },
        schema_markup: { weight: 4 },
        robots_meta: { weight: 2 },
        page_language: { weight: 1 },
        charset: { weight: 1 }
      }
    },

    links: {
      weight_total: 10,
      rules: {
        internal_count: { weight: 3, min: 3 },
        external_quality: { weight: 2 },
        descriptive_anchors: { weight: 3, bad_anchors: [
          /^click\s*here$/i, /^read\s*more$/i, /^here$/i,
          /^link$/i, /^this$/i, /^more$/i
        ]},
        no_broken: { weight: 2 }
      }
    },

    ux: {
      weight_total: 10,
      rules: {
        cta_presence: { weight: 3 },
        content_above_fold: { weight: 2 },
        list_usage: { weight: 2 },
        table_usage: { weight: 1 },
        no_wall_of_text: { weight: 2, max_block_words: 300 }
      }
    }
  },

  // ─── GEO SCORING (100 points total — sent to backend) ────
  geo: {
    answer_architecture: { weight_total: 25 },
    citation_worthiness: { weight_total: 25 },
    machine_readability: { weight_total: 20 },
    content_precision: { weight_total: 15 },
    multi_engine: { weight_total: 15 }
  },

  // ─── COMBINED SCORE ───────────────────────────────────────
  combined: {
    seo_weight: 0.4,
    geo_weight: 0.6,
    grades: {
      "A+": [90, 100],
      "A":  [80, 89],
      "B":  [70, 79],
      "C":  [60, 69],
      "D":  [50, 59],
      "F":  [0, 49]
    }
  },

  // ─── API CONFIGURATION ────────────────────────────────────
  api: {
    base_url: "http://localhost:8000",
    timeout_ms: 30000,
    retry_count: 2,
    retry_delay_ms: 1000
  }
};
