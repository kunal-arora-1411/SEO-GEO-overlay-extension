"""Schemas for brand voice training and application endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateBrandVoiceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="Brand voice profile name")
    sample_urls: list[str] = Field(
        min_length=1,
        max_length=10,
        description="URLs of pages that exemplify the desired brand voice",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional description of the brand voice style",
    )


class ApplyBrandVoiceRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=5000,
        description="Text to apply the brand voice to",
    )


class StyleMetrics(BaseModel):
    avg_sentence_length: float = Field(description="Average words per sentence")
    vocabulary_level: str = Field(description="basic, intermediate, or advanced")
    formality_score: float = Field(ge=0.0, le=1.0, description="0 = casual, 1 = formal")
    tone_descriptors: list[str] = Field(
        default_factory=list,
        description="List of adjectives describing the tone",
    )


class BrandVoiceResponse(BaseModel):
    id: str
    name: str
    status: str = Field(description="pending, training, ready, or failed")
    style_metrics: Optional[StyleMetrics] = None
    style_description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BrandVoiceListResponse(BaseModel):
    voices: list[BrandVoiceResponse] = Field(default_factory=list)
