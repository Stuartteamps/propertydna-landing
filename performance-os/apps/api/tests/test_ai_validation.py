import pytest

from app.ai.factory import get_vision_provider
from app.ai.validation import AIValidationError, validate_food_analysis
from app.schemas.food import FoodAnalysis, FoodItem, FoodTotals


def _valid_payload():
    return {
        "meal_name": "Test bowl", "meal_type": "lunch",
        "items": [{"name": "chicken", "estimated_quantity": 170, "unit": "g",
                   "calories": 281, "protein_g": 53, "confidence": 0.86}],
        "totals": {"calories": 281, "protein_g": 53},
        "overall_confidence": 0.8,
    }


def test_valid_payload_passes_and_forces_estimate_flag():
    a = validate_food_analysis(_valid_payload())
    assert isinstance(a, FoodAnalysis)
    assert a.is_estimate is True


def test_missing_items_rejected():
    bad = _valid_payload()
    bad["items"] = []
    with pytest.raises(AIValidationError):
        validate_food_analysis(bad)


def test_negative_calories_rejected():
    bad = _valid_payload()
    bad["items"][0]["calories"] = -5
    with pytest.raises(AIValidationError):
        validate_food_analysis(bad)


def test_absurd_totals_rejected():
    bad = _valid_payload()
    bad["totals"]["calories"] = 99999
    with pytest.raises(AIValidationError):
        validate_food_analysis(bad)


def test_confidence_clamped():
    a = FoodAnalysis(meal_name="x", meal_type="snack",
                     items=[FoodItem(name="a", estimated_quantity=1, calories=10, confidence=5)],
                     totals=FoodTotals(calories=10), overall_confidence=9)
    out = validate_food_analysis(a)
    assert out.overall_confidence == 1.0
    assert out.items[0].confidence == 1.0


def test_invalid_meal_type_coerced_to_snack():
    p = _valid_payload()
    p["meal_type"] = "brunch"
    assert validate_food_analysis(p).meal_type == "snack"


def test_mock_vision_provider_deterministic():
    prov = get_vision_provider()
    a = prov.analyze_food_image(b"same-bytes", hint="lunch")
    b = prov.analyze_food_image(b"same-bytes", hint="lunch")
    assert a.totals.calories == b.totals.calories
    assert a.is_estimate is True
    assert 0 <= a.overall_confidence <= 1
