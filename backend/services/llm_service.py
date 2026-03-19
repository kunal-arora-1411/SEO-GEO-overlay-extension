import json
import time
import logging

import google.generativeai as genai

from config import Settings

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """Simple circuit breaker for LLM calls.

    After ``max_failures`` consecutive failures the breaker opens
    for ``cooldown_seconds``.  During that time all calls are
    short-circuited with a fallback.
    """

    def __init__(self, max_failures: int = 3, cooldown_seconds: int = 120) -> None:
        self.max_failures = max_failures
        self.cooldown_seconds = cooldown_seconds
        self._failures = 0
        self._opened_at: float = 0

    @property
    def is_open(self) -> bool:
        if self._failures < self.max_failures:
            return False
        if time.time() - self._opened_at > self.cooldown_seconds:
            self._failures = 0
            return False
        return True

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self.max_failures:
            self._opened_at = time.time()
            logger.warning(
                "Circuit breaker OPEN after %d failures (cooldown %ds)",
                self._failures,
                self.cooldown_seconds,
            )

    def record_success(self) -> None:
        if self._failures > 0:
            self._failures = 0


class LLMService:
    """Async wrapper around the Google Gemini API.

    Provides two methods -- ``analyze`` for cheaper/faster analysis tasks
    (gemini-2.0-flash) and ``rewrite`` for higher-quality content generation
    (gemini-2.0-flash).  Both return raw string responses and handle errors
    gracefully so callers never face unhandled exceptions from the LLM
    layer.

    Includes a circuit breaker that opens after 3 consecutive failures
    and stays open for 120 seconds.
    """

    def __init__(self, settings: Settings) -> None:
        genai.configure(api_key=settings.gemini_api_key)
        self._model_analysis = genai.GenerativeModel(
            settings.gemini_model_analysis,
            generation_config=genai.GenerationConfig(
                temperature=settings.llm_temperature,
                max_output_tokens=settings.llm_max_tokens_analysis,
                response_mime_type="application/json",
            ),
        )
        self._model_rewrite = genai.GenerativeModel(
            settings.gemini_model_rewrite,
            generation_config=genai.GenerationConfig(
                temperature=0.5,
                max_output_tokens=settings.llm_max_tokens_rewrite,
                response_mime_type="application/json",
            ),
        )
        self._circuit_breaker = CircuitBreaker()

    async def analyze(self, system_prompt: str, user_prompt: str) -> str:
        """Run an analysis call using the lighter model with JSON output.

        Returns the raw content string from the LLM.  On any failure a
        fallback empty-JSON string ``"{}"`` is returned so downstream
        callers can safely parse without crashing.
        """
        if self._circuit_breaker.is_open:
            logger.warning("Circuit breaker open — skipping LLM analysis call")
            return "{}"
        try:
            prompt = f"{system_prompt}\n\n{user_prompt}"
            response = await self._model_analysis.generate_content_async(prompt)
            content = response.text
            if content is None:
                logger.warning("LLM analysis returned None content")
                return "{}"
            self._circuit_breaker.record_success()
            return content
        except Exception:
            logger.exception("LLM analysis call failed")
            self._circuit_breaker.record_failure()
            return "{}"

    async def rewrite(self, system_prompt: str, user_prompt: str) -> str:
        """Run a rewrite/generation call using the higher-quality model.

        Returns the raw content string.  On failure returns a JSON string
        with an empty suggestions array.
        """
        if self._circuit_breaker.is_open:
            logger.warning("Circuit breaker open — skipping LLM rewrite call")
            return json.dumps({"suggestions": []})
        try:
            prompt = f"{system_prompt}\n\n{user_prompt}"
            response = await self._model_rewrite.generate_content_async(prompt)
            content = response.text
            if content is None:
                logger.warning("LLM rewrite returned None content")
                return json.dumps({"suggestions": []})
            self._circuit_breaker.record_success()
            return content
        except Exception:
            logger.exception("LLM rewrite call failed")
            self._circuit_breaker.record_failure()
            return json.dumps({"suggestions": []})
