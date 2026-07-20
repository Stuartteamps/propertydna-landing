"""AI provider interfaces. Vendors are swapped behind these Protocols without touching callers.

Concrete impls live in app/ai/providers/. The factory (app/ai/factory.py) selects one from
the AI_PROVIDER env flag. Mock providers make the whole app run with no paid API.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schemas.food import FoodAnalysis


@runtime_checkable
class VisionProvider(Protocol):
    """Analyze a food image (bytes) into a structured, validated FoodAnalysis estimate."""
    name: str

    def analyze_food_image(self, image_bytes: bytes, hint: str | None = None) -> FoodAnalysis: ...


@runtime_checkable
class NutritionProvider(Protocol):
    """Parse free text / a nutrition label into a FoodAnalysis estimate."""
    name: str

    def parse_meal_text(self, text: str) -> FoodAnalysis: ...

    def parse_nutrition_label(self, text: str) -> FoodAnalysis: ...


@runtime_checkable
class CoachingProvider(Protocol):
    """Turn a structured daily/weekly context dict into concise, safe coaching copy."""
    name: str

    def daily_summary(self, context: dict) -> str: ...

    def weekly_summary(self, context: dict) -> str: ...


@runtime_checkable
class TranscriptionProvider(Protocol):
    """Transcribe a voice journal / voice food log (audio bytes) to text."""
    name: str

    def transcribe(self, audio_bytes: bytes) -> str: ...
