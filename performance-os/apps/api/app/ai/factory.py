"""Select AI providers from env flags. Swap vendors without touching callers."""
from __future__ import annotations

from functools import lru_cache

from app.ai.base import (
    CoachingProvider,
    NutritionProvider,
    TranscriptionProvider,
    VisionProvider,
)
from app.ai.providers import mock, real
from app.core.config import settings

_REAL = {"openai", "anthropic", "claude", "real"}


@lru_cache
def get_vision_provider() -> VisionProvider:
    if settings.AI_PROVIDER in _REAL:
        return real.RealVisionProvider()
    return mock.MockVisionProvider()


@lru_cache
def get_nutrition_provider() -> NutritionProvider:
    if settings.AI_PROVIDER in _REAL:
        return real.RealNutritionProvider()
    return mock.MockNutritionProvider()


@lru_cache
def get_coaching_provider() -> CoachingProvider:
    if settings.AI_PROVIDER in _REAL:
        return real.RealCoachingProvider()
    return mock.MockCoachingProvider()


@lru_cache
def get_transcription_provider() -> TranscriptionProvider:
    if settings.AI_PROVIDER in _REAL:
        return real.RealTranscriptionProvider()
    return mock.MockTranscriptionProvider()
