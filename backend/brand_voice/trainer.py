"""Brand voice training: analyse sample content to extract style metrics."""

import json
import logging
import math
import re
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 15
_USER_AGENT = "SEO-GEO-Optimizer-BrandVoice/1.0"

# Word lists for vocabulary level classification
_ADVANCED_WORDS = frozenset({
    "ameliorate", "elucidate", "juxtapose", "ubiquitous", "paradigm",
    "synergy", "heuristic", "cognizant", "precipitate", "nuance",
    "efficacy", "leverage", "optimize", "streamline", "facilitate",
    "mitigate", "exacerbate", "proliferate", "delineate", "extrapolate",
    "articulate", "synthesize", "corroborate", "substantiate", "enumerate",
    "pragmatic", "comprehensive", "multifaceted", "unprecedented",
    "meticulous", "rigorous", "pervasive", "inherent", "robust",
    "scalable", "holistic", "granular", "empirical", "salient",
})

_FORMAL_MARKERS = frozenset({
    "therefore", "consequently", "furthermore", "moreover", "nevertheless",
    "notwithstanding", "accordingly", "henceforth", "whereby", "herein",
    "pursuant", "whereas", "inasmuch", "therein", "aforementioned",
    "shall", "thus", "hence", "indeed", "notably",
})

_INFORMAL_MARKERS = frozenset({
    "gonna", "wanna", "kinda", "gotta", "ain't", "yeah", "nope", "hey",
    "ok", "okay", "cool", "awesome", "stuff", "things", "basically",
    "pretty much", "like", "totally", "super", "bunch",
    "lol", "omg", "btw", "fyi", "tbh",
})


class BrandVoiceTrainer:
    """Analyses sample content to build a brand voice profile."""

    async def train(
        self,
        sample_urls: list[str],
        llm_service: Optional[Any] = None,
    ) -> dict[str, Any]:
        """Fetch sample URLs and compute a brand voice profile.

        Args:
            sample_urls: List of URLs whose content exemplifies the brand voice.
            llm_service: Optional LLM service for generating a natural-language
                style description. If not provided, a rule-based description
                is generated instead.

        Returns:
            Dict with keys: style_metrics, style_description, status.
        """
        combined_text = await self._fetch_samples(sample_urls)

        if not combined_text.strip():
            return {
                "style_metrics": None,
                "style_description": "Could not extract text from provided URLs.",
                "status": "failed",
            }

        metrics = self.compute_style_metrics(combined_text)
        style_description = await self._generate_description(
            metrics, combined_text, llm_service
        )

        return {
            "style_metrics": metrics,
            "style_description": style_description,
            "status": "ready",
        }

    def compute_style_metrics(self, text: str) -> dict[str, Any]:
        """Compute quantitative style metrics from raw text.

        Returns dict with: avg_sentence_length, vocabulary_level,
        formality_score, tone_descriptors.
        """
        sentences = self._split_sentences(text)
        words = re.findall(r"\b[a-zA-Z]+\b", text.lower())

        # Average sentence length
        if sentences:
            word_counts = [len(re.findall(r"\b[a-zA-Z]+\b", s)) for s in sentences]
            avg_sentence_length = sum(word_counts) / len(word_counts)
        else:
            avg_sentence_length = 0.0

        # Vocabulary level
        vocabulary_level = self._analyze_vocabulary(words)

        # Formality score
        formality_score = self._compute_formality(text)

        # Tone descriptors
        tone_descriptors = self._detect_tone(
            text, words, avg_sentence_length, formality_score, vocabulary_level
        )

        return {
            "avg_sentence_length": round(avg_sentence_length, 1),
            "vocabulary_level": vocabulary_level,
            "formality_score": round(formality_score, 2),
            "tone_descriptors": tone_descriptors,
        }

    def _analyze_vocabulary(self, words: list[str]) -> str:
        """Categorise vocabulary richness as basic, intermediate, or advanced.

        Uses type-token ratio and presence of advanced vocabulary to classify.
        """
        if not words:
            return "basic"

        total = len(words)
        unique = len(set(words))

        # Type-token ratio (higher = richer vocabulary)
        ttr = unique / total if total > 0 else 0

        # Count advanced words
        advanced_count = sum(1 for w in words if w in _ADVANCED_WORDS)
        advanced_ratio = advanced_count / total if total > 0 else 0

        # Average word length
        avg_word_length = sum(len(w) for w in words) / total if total > 0 else 0

        # Scoring heuristic
        score = 0.0
        if ttr > 0.6:
            score += 2
        elif ttr > 0.4:
            score += 1

        if advanced_ratio > 0.02:
            score += 2
        elif advanced_ratio > 0.005:
            score += 1

        if avg_word_length > 6:
            score += 2
        elif avg_word_length > 4.5:
            score += 1

        if score >= 4:
            return "advanced"
        elif score >= 2:
            return "intermediate"
        return "basic"

    def _compute_formality(self, text: str) -> float:
        """Compute a formality score from 0 (casual) to 1 (formal).

        Uses a heuristic based on formal vs. informal markers, sentence
        structure, and punctuation patterns.
        """
        words_lower = re.findall(r"\b[a-zA-Z]+\b", text.lower())
        total = len(words_lower) if words_lower else 1

        formal_count = sum(1 for w in words_lower if w in _FORMAL_MARKERS)
        informal_count = sum(1 for w in words_lower if w in _INFORMAL_MARKERS)

        # Base score from marker ratio
        if formal_count + informal_count == 0:
            marker_score = 0.5
        else:
            marker_score = formal_count / (formal_count + informal_count)

        # Adjust for contractions (informal signal)
        contraction_count = len(re.findall(r"\b\w+'\w+\b", text))
        contraction_ratio = contraction_count / total
        contraction_penalty = min(contraction_ratio * 5, 0.3)

        # Adjust for exclamation marks (informal signal)
        exclamation_count = text.count("!")
        exclamation_penalty = min(exclamation_count * 0.02, 0.2)

        # Adjust for average sentence length (longer = more formal)
        sentences = self._split_sentences(text)
        if sentences:
            avg_sent_len = len(words_lower) / len(sentences)
            length_bonus = min((avg_sent_len - 10) * 0.01, 0.2) if avg_sent_len > 10 else 0
        else:
            length_bonus = 0

        score = marker_score - contraction_penalty - exclamation_penalty + length_bonus
        return max(0.0, min(1.0, score))

    def _detect_tone(
        self,
        text: str,
        words: list[str],
        avg_sentence_length: float,
        formality_score: float,
        vocabulary_level: str,
    ) -> list[str]:
        """Derive tone descriptor adjectives from computed metrics and text analysis."""
        descriptors: list[str] = []

        # Formality-based
        if formality_score > 0.7:
            descriptors.append("professional")
        elif formality_score < 0.3:
            descriptors.append("conversational")

        # Sentence length-based
        if avg_sentence_length > 20:
            descriptors.append("detailed")
        elif avg_sentence_length < 10:
            descriptors.append("concise")

        # Vocabulary-based
        if vocabulary_level == "advanced":
            descriptors.append("sophisticated")
        elif vocabulary_level == "basic":
            descriptors.append("accessible")

        # Question frequency (engaging)
        question_count = text.count("?")
        if question_count > 3:
            descriptors.append("engaging")

        # Imperative / instructional tone
        imperative_patterns = len(re.findall(
            r"(?:^|\. )(use|try|make|start|create|build|check|ensure|consider|avoid)\b",
            text.lower(),
        ))
        if imperative_patterns >= 3:
            descriptors.append("instructional")

        # Enthusiastic
        exclamation_count = text.count("!")
        if exclamation_count > 2:
            descriptors.append("enthusiastic")

        # Authoritative (statistics and citations)
        stat_count = len(re.findall(r"\d+%|\d+\.\d+", text))
        if stat_count >= 3:
            descriptors.append("data-driven")

        # Ensure at least one descriptor
        if not descriptors:
            descriptors.append("neutral")

        return descriptors

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences using a simple regex heuristic."""
        sentences = re.split(r"[.!?]+\s+", text.strip())
        return [s.strip() for s in sentences if s.strip()]

    async def _fetch_samples(self, urls: list[str]) -> str:
        """Fetch content from sample URLs and combine into a single text."""
        texts: list[str] = []

        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            for url in urls:
                try:
                    response = await client.get(url)
                    content_type = response.headers.get("content-type", "")
                    if "text/html" not in content_type:
                        logger.warning("Skipping non-HTML URL: %s", url)
                        continue

                    html = response.text
                    # Extract body text
                    body_match = re.search(
                        r"<body[^>]*>(.*)</body>", html,
                        re.IGNORECASE | re.DOTALL,
                    )
                    body_html = body_match.group(1) if body_match else html
                    # Remove script/style
                    body_clean = re.sub(
                        r"<(script|style)[^>]*>.*?</\1>", "",
                        body_html, flags=re.DOTALL | re.IGNORECASE,
                    )
                    body_text = re.sub(r"<[^>]+>", " ", body_clean)
                    body_text = re.sub(r"\s+", " ", body_text).strip()

                    if body_text:
                        texts.append(body_text)

                except httpx.TimeoutException:
                    logger.warning("Timeout fetching %s", url)
                except httpx.HTTPError as exc:
                    logger.warning("HTTP error fetching %s: %s", url, exc)
                except Exception:
                    logger.exception("Unexpected error fetching %s", url)

        return "\n\n".join(texts)

    async def _generate_description(
        self,
        metrics: dict[str, Any],
        sample_text: str,
        llm_service: Optional[Any],
    ) -> str:
        """Generate a natural-language style description.

        Uses the LLM if available; falls back to a rule-based description.
        """
        if llm_service is not None:
            try:
                system_prompt = (
                    "You are a writing style analyst. Given style metrics and a text sample, "
                    "produce a concise (2-3 sentence) description of the brand voice. "
                    "Respond with JSON: {\"description\": \"...\"}"
                )
                user_prompt = (
                    f"Style metrics:\n"
                    f"- Average sentence length: {metrics['avg_sentence_length']} words\n"
                    f"- Vocabulary level: {metrics['vocabulary_level']}\n"
                    f"- Formality score: {metrics['formality_score']} (0=casual, 1=formal)\n"
                    f"- Tone: {', '.join(metrics['tone_descriptors'])}\n\n"
                    f"Text sample (first 500 chars):\n{sample_text[:500]}"
                )
                raw = await llm_service.analyze(system_prompt, user_prompt)
                parsed = json.loads(raw)
                description = parsed.get("description", "")
                if description:
                    return description
            except Exception:
                logger.warning("LLM description generation failed; using rule-based fallback")

        # Rule-based fallback
        tone = ", ".join(metrics["tone_descriptors"])
        formality = "formal" if metrics["formality_score"] > 0.6 else (
            "casual" if metrics["formality_score"] < 0.4 else "balanced"
        )
        return (
            f"This brand voice uses {metrics['vocabulary_level']}-level vocabulary "
            f"with an average sentence length of {metrics['avg_sentence_length']} words. "
            f"The tone is {tone} with a {formality} register "
            f"(formality score: {metrics['formality_score']})."
        )
