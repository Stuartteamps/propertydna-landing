"""Real AI providers — Anthropic (Claude) or OpenAI, selected by AI_PROVIDER.

Vision food analysis, meal/label text parsing, coaching copy, and (OpenAI) transcription.
Uses httpx directly (no vendor SDKs) so there is no SDK version coupling. Every model output
is parsed and run through app.ai.validation before it is returned, so malformed or implausible
responses are rejected rather than stored.

Runtime config (env):
  AI_PROVIDER          anthropic | openai
  AI_PROVIDER_API_KEY  the vendor key (set via `fly secrets set ...`, never committed)
  AI_MODEL             optional model override (defaults below)
"""
from __future__ import annotations

import base64
import json

import httpx

from app.ai.validation import AIValidationError, validate_food_analysis
from app.core.config import settings
from app.schemas.food import FoodAnalysis

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_AUDIO_URL = "https://api.openai.com/v1/audio/transcriptions"

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_OPENAI_TRANSCRIBE_MODEL = "whisper-1"

# The strict contract we ask the model to return. Keep in sync with schemas/food.py.
FOOD_JSON_INSTRUCTIONS = (
    "You are a nutrition-estimation assistant. Analyze the food and respond with ONLY a JSON "
    "object (no markdown, no prose) matching exactly this shape:\n"
    "{\n"
    '  "meal_name": string,\n'
    '  "meal_type": one of "breakfast"|"lunch"|"dinner"|"snack",\n'
    '  "items": [{"name": string, "estimated_quantity": number, "unit": string, '
    '"calories": number, "protein_g": number, "carbohydrates_g": number, "fat_g": number, '
    '"fiber_g": number, "sugar_g": number, "sodium_mg": number, "potassium_mg": number, '
    '"calcium_mg": number, "iron_mg": number, "magnesium_mg": number, "vitamin_a_ug": number, '
    '"vitamin_c_mg": number, "vitamin_d_ug": number, "vitamin_b12_ug": number, '
    '"folate_ug": number, "cholesterol_mg": number, "confidence": number between 0 and 1}],\n'
    '  "totals": {"calories": number, "protein_g": number, "carbohydrates_g": number, '
    '"fat_g": number, "fiber_g": number, "sugar_g": number, "sodium_mg": number, '
    '"potassium_mg": number, "calcium_mg": number, "iron_mg": number, "magnesium_mg": number, '
    '"vitamin_a_ug": number, "vitamin_c_mg": number, "vitamin_d_ug": number, '
    '"vitamin_b12_ug": number, "folate_ug": number, "cholesterol_mg": number},\n'
    '  "assumptions": [string],\n'
    '  "overall_confidence": number between 0 and 1\n'
    "}\n"
    "All nutrient values are best-effort ESTIMATES. Never claim exactness. Use 0 for unknown "
    "micronutrients. Portions are grams unless clearly countable."
)


def _extract_json(text: str) -> dict:
    """Tolerantly pull a JSON object out of a model response (handles ``` fences / stray prose)."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t.strip("`")
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise AIValidationError("AI response did not contain a JSON object.")
    try:
        return json.loads(t[start : end + 1])
    except json.JSONDecodeError as e:
        raise AIValidationError(f"AI response was not valid JSON: {e}") from e


class _Base:
    name = "real"

    def _key(self) -> str:
        if not settings.AI_PROVIDER_API_KEY:
            raise RuntimeError(
                f"AI_PROVIDER={settings.AI_PROVIDER} requires AI_PROVIDER_API_KEY. "
                "Set it (e.g. `fly secrets set AI_PROVIDER_API_KEY=...`) or use AI_PROVIDER=mock."
            )
        return settings.AI_PROVIDER_API_KEY

    @property
    def _is_anthropic(self) -> bool:
        return settings.AI_PROVIDER in ("anthropic", "claude")

    @property
    def _model(self) -> str:
        if settings.AI_MODEL:
            return settings.AI_MODEL
        return DEFAULT_ANTHROPIC_MODEL if self._is_anthropic else DEFAULT_OPENAI_MODEL

    # ---- raw completions (network). Split out so tests can monkeypatch. ----
    def _complete_text(self, system: str, user: str) -> str:
        if self._is_anthropic:
            return self._anthropic([{"role": "user", "content": user}], system)
        return self._openai(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )

    def _complete_vision(self, system: str, prompt: str, image_bytes: bytes, media_type: str) -> str:
        b64 = base64.b64encode(image_bytes).decode()
        if self._is_anthropic:
            content = [
                {"type": "image",
                 "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": prompt},
            ]
            return self._anthropic([{"role": "user", "content": content}], system)
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
        ]
        return self._openai(
            [{"role": "system", "content": system}, {"role": "user", "content": content}]
        )

    def _anthropic(self, messages: list, system: str) -> str:
        r = httpx.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": self._key(),
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json={"model": self._model, "max_tokens": 1500, "system": system,
                  "messages": messages},
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        r.raise_for_status()
        blocks = r.json().get("content", [])
        return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")

    def _openai(self, messages: list, json_mode: bool = True) -> str:
        body: dict = {"model": self._model, "max_tokens": 1500, "messages": messages}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        r = httpx.post(
            OPENAI_CHAT_URL,
            headers={"Authorization": f"Bearer {self._key()}",
                     "Content-Type": "application/json"},
            json=body,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


class RealVisionProvider(_Base):
    name = "real-vision"

    def analyze_food_image(self, image_bytes: bytes, hint: str | None = None) -> FoodAnalysis:
        prompt = FOOD_JSON_INSTRUCTIONS + (f"\nMeal context: {hint}." if hint else "")
        raw = self._complete_vision("Return only JSON.", prompt, image_bytes, "image/jpeg")
        return validate_food_analysis(_extract_json(raw))


class RealNutritionProvider(_Base):
    name = "real-nutrition"

    def parse_meal_text(self, text: str) -> FoodAnalysis:
        raw = self._complete_text(FOOD_JSON_INSTRUCTIONS, f"Meal described: {text}")
        return validate_food_analysis(_extract_json(raw))

    def parse_nutrition_label(self, text: str) -> FoodAnalysis:
        raw = self._complete_text(FOOD_JSON_INSTRUCTIONS, f"Nutrition label text: {text}")
        return validate_food_analysis(_extract_json(raw))


class RealCoachingProvider(_Base):
    name = "real-coaching"

    _SYSTEM = (
        "You are a concise, evidence-based performance coach. 2-3 sentences, supportive, no "
        "medical claims, no diagnosis. Never recommend extreme restriction or dangerous practices."
    )

    def daily_summary(self, context: dict) -> str:
        return self._complete_text(
            self._SYSTEM, f"Write today's coaching note from this data: {json.dumps(context)}"
        ).strip()

    def weekly_summary(self, context: dict) -> str:
        return self._complete_text(
            self._SYSTEM, f"Write a short weekly summary from this data: {json.dumps(context)}"
        ).strip()


class RealTranscriptionProvider(_Base):
    name = "real-transcription"

    def transcribe(self, audio_bytes: bytes) -> str:
        # Whisper is an OpenAI endpoint; use it regardless of the chat vendor if a key is present.
        model = settings.AI_MODEL if (settings.AI_MODEL or "").startswith("whisper") \
            else DEFAULT_OPENAI_TRANSCRIBE_MODEL
        r = httpx.post(
            OPENAI_AUDIO_URL,
            headers={"Authorization": f"Bearer {self._key()}"},
            files={"file": ("audio.m4a", audio_bytes, "audio/m4a")},
            data={"model": model},
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        r.raise_for_status()
        return r.json().get("text", "").strip()
