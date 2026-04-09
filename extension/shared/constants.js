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

  // ─── GEO SCORING (100 points total — client-side) ────────
  geo: {
    answer_architecture: {
      weight_total: 25,
      rules: {
        direct_opening: { weight: 6, min_words: 20 },
        faq_pairs: { weight: 5, question_pattern: /^(what|how|why|when|where|who|which|can|do|does|is|are|should|will)\s/i, thresholds: [0, 0, 2, 3, 5] },
        term_definitions: { weight: 4, patterns: [
          /is defined as/i, /refers to/i, /known as/i, /also called/i, /is a type of/i, /meaning of/i
        ], thresholds: [0, 0, 2, 3, 4] },
        comparison_tables: { weight: 5, full_table_pts: 5, basic_table_pts: 3 },
        self_contained_h2: { weight: 5, min_words_per_section: 50, full_pct: 1.0, partial_pct: 0.75 }
      }
    },
    citation_worthiness: {
      weight_total: 25,
      rules: {
        stats_with_sources: { weight: 7, number_pattern: /(\d+%|\$[\d,.]+|\d{1,3}(?:,\d{3})+)/,
          attribution_pattern: /according to|per\s|source:|cited by|\(\d{4}\)|\[\d+\]/i,
          thresholds: [0, 0, 3, 5, 7] },
        attributed_claims: { weight: 5, pattern: /according to [A-Z]|per [A-Z]|(?:university|institute|foundation|association|organization|department) of/i,
          thresholds: [0, 0, 2, 5] },
        expert_quotes: { weight: 4, blockquote_weight: 2, attribution_pattern: /said|noted|explained|stated|argues|wrote|observed/i,
          thresholds: [0, 0, 2, 4] },
        publication_date: { weight: 5, recent_days: 90 },
        author_attribution: { weight: 4, schema_pts: 4, meta_pts: 2 }
      }
    },
    machine_readability: {
      weight_total: 20,
      rules: {
        json_ld_present: { weight: 5 },
        semantic_html: { weight: 4 },
        text_to_image_ratio: { weight: 3, thresholds: { high: 100, medium: 50, low: 20 } },
        content_in_html: { weight: 4, min_words_full: 300, min_words_partial: 100 },
        ai_crawlers_not_blocked: { weight: 2, blocked_patterns: [/noai/i, /noimageai/i, /data-nosnippet/i] },
        llms_txt: { weight: 2 }
      }
    },
    content_precision: {
      weight_total: 15,
      rules: {
        specific_entities: { weight: 5, entity_pattern: /(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)+|\d{4}|\$[\d,.]+|\d+(?:\.\d+)?%)/g,
          per_500_words: true, thresholds: { high: 3, medium: 2, low: 1 } },
        verifiable_claims: { weight: 5, thresholds: { high: 0.6, medium: 0.4, low: 0.2 } },
        no_filler: { weight: 5, filler_phrases: [
          "in today's world", "it goes without saying", "at the end of the day",
          "let's dive in", "without further ado", "in this article we will",
          "as we all know", "it is important to note that", "needless to say",
          "it is worth mentioning", "as a matter of fact", "the fact of the matter is"
        ], per_1000_words: true, thresholds: { clean: 1, acceptable: 3 } }
      }
    },
    multi_engine: {
      weight_total: 15,
      rules: {
        neutral_tone: { weight: 5, superlatives: [
          "best ever", "absolutely amazing", "guaranteed", "revolutionary",
          "game-changing", "world-class", "unbeatable", "number one", "#1",
          "once in a lifetime", "act now", "limited time", "exclusive offer"
        ], per_1000_words: true, thresholds: { clean: 2, acceptable: 5 } },
        experience_markers: { weight: 5, patterns: [
          /we tested/i, /in our experience/i, /we found that/i, /our team/i,
          /hands-on/i, /we recommend/i, /after (?:using|testing|trying)/i,
          /in practice/i, /based on our/i, /we observed/i
        ], thresholds: [0, 0, 2, 3, 5] },
        opening_answers: { weight: 5, answer_patterns: [
          /is a\s/i, /refers to\s/i, /you can\s/i, /the (?:best|main|primary|most)\s/i,
          /to\s\w+\s(?:a|an|the|your)\s/i, /are\s(?:a|the|an)\s/i
        ] }
      }
    }
  },

  // ─── PERFORMANCE THRESHOLDS ──────────────────────────────
  performance: {
    lazy_loading_min_images: 3,         // only flag if page has at least 3 images
    lazy_loading_threshold_pct: 0.30,   // 30%+ images missing lazy = issue
    dom_nodes_threshold: 1500,          // node count above this = warning
    request_count_threshold: 100        // resource requests above this = info
  },

  // ─── ACCESSIBILITY THRESHOLDS ─────────────────────────────
  accessibility: {
    min_interactive_elements: 1,        // only flag if page has interactive elements
    min_form_inputs: 1                  // only flag if page has form inputs
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
