"""Real provider stubs. Guarded behind AI_PROVIDER + AI_PROVIDER_API_KEY.

These are intentionally thin: wiring a real vendor (OpenAI/Anthropic vision, Whisper, etc.)
means implementing the same methods and validating output through app.ai.validation. They raise
a clear error if selected without a key so the demo never silently depends on a paid API.
"""
from __future__ import annotations

from app.core.config import settings
from app.schemas.food import FoodAnalysis


class _RequiresKey:
    def _ensure_key(self) -> None:
        if not settings.AI_PROVIDER_API_KEY:
            raise RuntimeError(
                f"AI_PROVIDER={settings.AI_PROVIDER} requires AI_PROVIDER_API_KEY. "
                "Set it in .env or use AI_PROVIDER=mock for the offline demo."
            )


class RealVisionProvider(_RequiresKey):
    name = "real-vision"

    def analyze_food_image(self, image_bytes: bytes, hint: str | None = None) -> FoodAnalysis:
        self._ensure_key()
        # TODO: call vendor vision API, then validate_food_analysis(raw_json).
        raise NotImplementedError("Wire a real vision vendor here; validate before returning.")


class RealNutritionProvider(_RequiresKey):
    name = "real-nutrition"

    def parse_meal_text(self, text: str) -> FoodAnalysis:
        self._ensure_key()
        raise NotImplementedError

    def parse_nutrition_label(self, text: str) -> FoodAnalysis:
        self._ensure_key()
        raise NotImplementedError


class RealCoachingProvider(_RequiresKey):
    name = "real-coaching"

    def daily_summary(self, context: dict) -> str:
        self._ensure_key()
        raise NotImplementedError

    def weekly_summary(self, context: dict) -> str:
        self._ensure_key()
        raise NotImplementedError


class RealTranscriptionProvider(_RequiresKey):
    name = "real-transcription"

    def transcribe(self, audio_bytes: bytes) -> str:
        self._ensure_key()
        raise NotImplementedError
