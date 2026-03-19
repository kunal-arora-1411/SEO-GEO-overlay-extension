"""Brand voice training and application API endpoints."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_user
from brand_voice.schemas import (
    ApplyBrandVoiceRequest,
    BrandVoiceListResponse,
    BrandVoiceResponse,
    CreateBrandVoiceRequest,
    StyleMetrics,
)
from brand_voice.trainer import BrandVoiceTrainer
from db.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brand-voice", tags=["brand-voice"])

# In-memory storage (replaced by DB in a later migration)
_voices: dict[str, dict[str, Any]] = {}


def _get_trainer() -> BrandVoiceTrainer:
    return BrandVoiceTrainer()


def _voice_to_response(voice: dict[str, Any]) -> BrandVoiceResponse:
    """Convert an in-memory voice record to a BrandVoiceResponse."""
    style_metrics = None
    raw_metrics = voice.get("style_metrics")
    if raw_metrics is not None:
        style_metrics = StyleMetrics(
            avg_sentence_length=raw_metrics["avg_sentence_length"],
            vocabulary_level=raw_metrics["vocabulary_level"],
            formality_score=raw_metrics["formality_score"],
            tone_descriptors=raw_metrics.get("tone_descriptors", []),
        )

    return BrandVoiceResponse(
        id=voice["id"],
        name=voice["name"],
        status=voice["status"],
        style_metrics=style_metrics,
        style_description=voice.get("style_description"),
        created_at=voice["created_at"],
    )


@router.get("", response_model=BrandVoiceListResponse)
async def list_brand_voices(
    user: User = Depends(get_current_user),
) -> BrandVoiceListResponse:
    """List all brand voice profiles."""
    voices = [_voice_to_response(v) for v in _voices.values()]
    return BrandVoiceListResponse(voices=voices)


@router.post("", response_model=BrandVoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_brand_voice(
    request: CreateBrandVoiceRequest,
    user: User = Depends(get_current_user),
    trainer: BrandVoiceTrainer = Depends(_get_trainer),
) -> BrandVoiceResponse:
    """Create a new brand voice profile and begin training.

    Training happens synchronously for now. In production this would be
    offloaded to a Celery task (see brand_voice.tasks).
    """
    voice_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    voice: dict[str, Any] = {
        "id": voice_id,
        "name": request.name,
        "description": request.description,
        "sample_urls": request.sample_urls,
        "status": "training",
        "style_metrics": None,
        "style_description": None,
        "created_at": now,
    }
    _voices[voice_id] = voice

    logger.info("Starting brand voice training for '%s' (%s)", request.name, voice_id)

    # Run training (sync for now; Celery task in production)
    result = await trainer.train(sample_urls=request.sample_urls)

    voice["status"] = result["status"]
    voice["style_metrics"] = result.get("style_metrics")
    voice["style_description"] = result.get("style_description")

    return _voice_to_response(voice)


@router.get("/{voice_id}", response_model=BrandVoiceResponse)
async def get_brand_voice(
    voice_id: str,
    user: User = Depends(get_current_user),
) -> BrandVoiceResponse:
    """Get details for a specific brand voice profile."""
    voice = _voices.get(voice_id)
    if voice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand voice profile not found",
        )
    return _voice_to_response(voice)


@router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand_voice(
    voice_id: str,
    user: User = Depends(get_current_user),
) -> None:
    """Delete a brand voice profile."""
    if voice_id not in _voices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand voice profile not found",
        )
    del _voices[voice_id]
    logger.info("Brand voice %s deleted", voice_id)


@router.post("/{voice_id}/apply")
async def apply_brand_voice(
    voice_id: str,
    request: ApplyBrandVoiceRequest,
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Apply a brand voice to sample text.

    Returns the original text alongside the rewritten version and the
    style metrics used for transformation.
    """
    voice = _voices.get(voice_id)
    if voice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand voice profile not found",
        )

    if voice["status"] != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Brand voice is not ready (status: {voice['status']})",
        )

    metrics = voice.get("style_metrics")
    if metrics is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No style metrics available for this brand voice",
        )

    # Apply style transformation using heuristics
    transformed = _apply_style_heuristics(request.text, metrics)

    return {
        "original_text": request.text,
        "transformed_text": transformed,
        "voice_name": voice["name"],
        "style_metrics_applied": metrics,
    }


def _apply_style_heuristics(text: str, metrics: dict[str, Any]) -> str:
    """Apply brand voice style using heuristic transformations.

    This is a lightweight rule-based approach. In production, this would
    be replaced by an LLM call with the style profile as system context.
    """
    import re

    formality = metrics.get("formality_score", 0.5)
    avg_sent_len = metrics.get("avg_sentence_length", 15)

    # Formality adjustments
    if formality > 0.7:
        # Make more formal
        replacements = {
            r"\bdon't\b": "do not",
            r"\bcan't\b": "cannot",
            r"\bwon't\b": "will not",
            r"\bisn't\b": "is not",
            r"\baren't\b": "are not",
            r"\bdidn't\b": "did not",
            r"\bwasn't\b": "was not",
            r"\bwouldn't\b": "would not",
            r"\bcouldn't\b": "could not",
            r"\bshouldn't\b": "should not",
            r"\bwanna\b": "want to",
            r"\bgonna\b": "going to",
            r"\bgotta\b": "have to",
        }
        for pattern, replacement in replacements.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    elif formality < 0.3:
        # Make more casual
        replacements = {
            r"\bdo not\b": "don't",
            r"\bcannot\b": "can't",
            r"\bwill not\b": "won't",
            r"\bis not\b": "isn't",
            r"\bare not\b": "aren't",
            r"\bdid not\b": "didn't",
            r"\bwas not\b": "wasn't",
            r"\bwould not\b": "wouldn't",
            r"\bcould not\b": "couldn't",
            r"\bshould not\b": "shouldn't",
        }
        for pattern, replacement in replacements.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # Sentence length adjustments
    sentences = re.split(r"([.!?]+\s+)", text)
    if avg_sent_len < 12 and len(sentences) > 1:
        # Prefer shorter sentences: split long ones at conjunctions
        result_parts: list[str] = []
        for part in sentences:
            if len(part.split()) > avg_sent_len * 1.5:
                # Try splitting at conjunctions
                sub_parts = re.split(r",\s+(and|but|or|so)\s+", part)
                for i, sp in enumerate(sub_parts):
                    cleaned = sp.strip().rstrip(",")
                    if cleaned and cleaned not in ("and", "but", "or", "so"):
                        if cleaned[-1] not in ".!?":
                            cleaned += "."
                        result_parts.append(cleaned + " ")
                    elif cleaned in ("and", "but", "or", "so"):
                        # Capitalize next part if it exists
                        continue
            else:
                result_parts.append(part)
        text = "".join(result_parts).strip()

    return text
