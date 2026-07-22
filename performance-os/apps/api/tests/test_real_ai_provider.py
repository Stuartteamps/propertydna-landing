"""Real AI provider: parsing/validation logic tested WITHOUT network.

We monkeypatch the raw-completion methods so no key or HTTP call is needed; this verifies the
model-output -> validated FoodAnalysis path (fence stripping, JSON extraction, schema validation)
and the missing-key guard.
"""
import json

import pytest

from app.ai.providers.real import (
    RealCoachingProvider,
    RealNutritionProvider,
    RealVisionProvider,
    _Base,
    _extract_json,
)
from app.ai.validation import AIValidationError
from app.core.config import settings

VALID = {
    "meal_name": "Grilled chicken rice bowl",
    "meal_type": "lunch",
    "items": [
        {"name": "grilled chicken breast", "estimated_quantity": 170, "unit": "g",
         "calories": 281, "protein_g": 53, "carbohydrates_g": 0, "fat_g": 6, "fiber_g": 0,
         "confidence": 0.86}
    ],
    "totals": {"calories": 640, "protein_g": 58, "carbohydrates_g": 67, "fat_g": 15,
               "fiber_g": 8, "sodium_mg": 760, "potassium_mg": 1100},
    "assumptions": ["Chicken portion estimated from plate scale."],
    "overall_confidence": 0.78,
}


def test_extract_json_plain():
    assert _extract_json(json.dumps(VALID))["meal_name"].startswith("Grilled")


def test_extract_json_with_markdown_fence():
    fenced = "```json\n" + json.dumps(VALID) + "\n```"
    assert _extract_json(fenced)["meal_type"] == "lunch"


def test_extract_json_with_leading_prose():
    messy = "Here is your result:\n" + json.dumps(VALID) + "\nHope that helps!"
    assert _extract_json(messy)["items"][0]["protein_g"] == 53


def test_extract_json_rejects_non_json():
    with pytest.raises(AIValidationError):
        _extract_json("sorry, I can't do that")


def test_vision_provider_parses_and_validates(monkeypatch):
    prov = RealVisionProvider()
    monkeypatch.setattr(prov, "_complete_vision",
                        lambda *a, **k: "```json\n" + json.dumps(VALID) + "\n```")
    result = prov.analyze_food_image(b"fake-image-bytes", hint="lunch")
    assert result.is_estimate is True
    assert result.meal_type == "lunch"
    assert result.items[0].name == "grilled chicken breast"
    assert 0 <= result.overall_confidence <= 1


def test_vision_provider_rejects_absurd_totals(monkeypatch):
    bad = {**VALID, "totals": {**VALID["totals"], "calories": 99999}}
    prov = RealVisionProvider()
    monkeypatch.setattr(prov, "_complete_vision", lambda *a, **k: json.dumps(bad))
    with pytest.raises(AIValidationError):
        prov.analyze_food_image(b"x")


def test_nutrition_text_provider(monkeypatch):
    prov = RealNutritionProvider()
    monkeypatch.setattr(prov, "_complete_text", lambda *a, **k: json.dumps(VALID))
    assert prov.parse_meal_text("chicken and rice").totals.calories == 640


def test_coaching_provider(monkeypatch):
    prov = RealCoachingProvider()
    monkeypatch.setattr(prov, "_complete_text", lambda *a, **k: "Great work — stay consistent.")
    assert "consistent" in prov.daily_summary({"readiness_band": "green"})


def test_missing_key_raises_clear_error(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_API_KEY", None)
    with pytest.raises(RuntimeError, match="AI_PROVIDER_API_KEY"):
        _Base()._key()


def test_model_defaults_by_vendor(monkeypatch):
    monkeypatch.setattr(settings, "AI_MODEL", None)
    monkeypatch.setattr(settings, "AI_PROVIDER", "anthropic")
    assert _Base()._model.startswith("claude")
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    assert _Base()._model.startswith("gpt")
    monkeypatch.setattr(settings, "AI_MODEL", "custom-model-x")
    assert _Base()._model == "custom-model-x"
