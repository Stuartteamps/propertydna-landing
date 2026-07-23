"""Mock AI providers — deterministic, offline, no paid API. Default in demo mode.

Determinism: results are seeded from a hash of the input so the same photo/text yields the
same estimate (stable tests, believable UX). Values are realistic but explicitly *estimates*.
"""
from __future__ import annotations

import hashlib

from app.schemas.food import FoodAnalysis, FoodItem, FoodTotals

# A tiny reference table (per 100 g unless noted) the mock composes meals from.
_FOODS = [
    # name, kcal, protein, carbs, fat, fiber, sodium, potassium
    ("grilled chicken breast", 165, 31, 0, 3.6, 0, 74, 256),
    ("white rice, cooked", 130, 2.7, 28, 0.3, 0.4, 1, 35),
    ("mixed greens salad", 20, 1.5, 3.5, 0.2, 2.1, 28, 260),
    ("avocado", 160, 2, 9, 15, 7, 7, 485),
    ("salmon fillet", 208, 20, 0, 13, 0, 59, 363),
    ("sweet potato", 86, 1.6, 20, 0.1, 3, 55, 337),
    ("greek yogurt", 59, 10, 3.6, 0.4, 0, 36, 141),
    ("blueberries", 57, 0.7, 14, 0.3, 2.4, 1, 77),
    ("scrambled eggs", 148, 10, 1.6, 11, 0, 145, 138),
    ("oatmeal, cooked", 71, 2.5, 12, 1.5, 1.7, 4, 70),
    ("almonds", 579, 21, 22, 50, 12, 1, 733),
    ("broccoli", 34, 2.8, 7, 0.4, 2.6, 33, 316),
]

_MEAL_TEMPLATES = {
    "breakfast": [("scrambled eggs", 150), ("oatmeal, cooked", 200), ("blueberries", 80)],
    "lunch": [("grilled chicken breast", 170), ("white rice, cooked", 180), ("mixed greens salad", 90)],
    "dinner": [("salmon fillet", 180), ("sweet potato", 150), ("broccoli", 120)],
    "snack": [("greek yogurt", 170), ("almonds", 28)],
}


def _seed(data: bytes) -> int:
    return int.from_bytes(hashlib.sha256(data).digest()[:4], "big")


def _guess_meal_type(seed: int, hint: str | None) -> str:
    if hint:
        h = hint.lower()
        for mt in ("breakfast", "lunch", "dinner", "snack"):
            if mt in h:
                return mt
    return ["breakfast", "lunch", "dinner", "snack"][seed % 4]


def _round(x: float, n: int = 1) -> float:
    return round(x, n)


def _compose(meal_type: str, seed: int) -> FoodAnalysis:
    template = _MEAL_TEMPLATES[meal_type]
    lookup = {f[0]: f for f in _FOODS}
    items: list[FoodItem] = []
    totals = FoodTotals(calories=0)
    for name, grams in template:
        f = lookup[name]
        factor = grams / 100.0
        # small deterministic jitter so confidence varies believably
        conf = 0.72 + ((seed >> (len(items) * 3)) % 20) / 100.0
        conf = min(conf, 0.95)
        cal, pro, carb, fat, fiber, sodium, potassium = (
            f[1] * factor, f[2] * factor, f[3] * factor,
            f[4] * factor, f[5] * factor, f[6] * factor, f[7] * factor,
        )
        # Per-item micronutrient estimates (rough, scaled from macros — clearly estimates).
        micros = {
            "sugar_g": carb * 0.18, "sodium_mg": sodium, "potassium_mg": potassium,
            "calcium_mg": cal * 0.12, "iron_mg": cal * 0.006, "magnesium_mg": cal * 0.06,
            "vitamin_a_ug": cal * 0.5, "vitamin_c_mg": fiber * 4, "vitamin_d_ug": fat * 0.02,
            "vitamin_b12_ug": pro * 0.02, "folate_ug": carb * 1.2, "cholesterol_mg": pro * 2.5,
        }
        items.append(FoodItem(
            name=name, estimated_quantity=_round(grams, 0), unit="g",
            calories=_round(cal), protein_g=_round(pro), carbohydrates_g=_round(carb),
            fat_g=_round(fat), fiber_g=_round(fiber), confidence=_round(conf, 2),
            **{k: _round(v) for k, v in micros.items()},
        ))
        totals.calories += cal
        totals.protein_g += pro
        totals.carbohydrates_g += carb
        totals.fat_g += fat
        totals.fiber_g += fiber
        for k, v in micros.items():
            setattr(totals, k, getattr(totals, k) + v)
    for field in ("calories", "protein_g", "carbohydrates_g", "fat_g", "fiber_g", "sugar_g",
                  "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg",
                  "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_b12_ug",
                  "folate_ug", "cholesterol_mg"):
        setattr(totals, field, _round(getattr(totals, field)))
    overall = _round(sum(i.confidence for i in items) / len(items), 2)
    return FoodAnalysis(
        meal_name=f"{meal_type.capitalize()} plate",
        meal_type=meal_type,
        items=items,
        totals=totals,
        assumptions=[
            "Portions estimated from typical plate scale.",
            "Cooking oil estimated at ~1 tsp where relevant.",
            "Micronutrients are rough estimates, not measured values.",
        ],
        overall_confidence=overall,
        is_estimate=True,
    )


class MockVisionProvider:
    name = "mock-vision"

    def analyze_food_image(self, image_bytes: bytes, hint: str | None = None) -> FoodAnalysis:
        seed = _seed(image_bytes or b"empty")
        return _compose(_guess_meal_type(seed, hint), seed)


class MockNutritionProvider:
    name = "mock-nutrition"

    def parse_meal_text(self, text: str) -> FoodAnalysis:
        seed = _seed(text.encode())
        return _compose(_guess_meal_type(seed, text), seed)

    def parse_nutrition_label(self, text: str) -> FoodAnalysis:
        # Treat a label as a single-item snack with numbers pulled from the seed.
        seed = _seed(text.encode())
        cal = 150 + seed % 250
        analysis = FoodAnalysis(
            meal_name="Packaged item (label)",
            meal_type="snack",
            items=[FoodItem(
                name="labeled food", estimated_quantity=1, unit="serving",
                calories=cal, protein_g=cal * 0.05, carbohydrates_g=cal * 0.12,
                fat_g=cal * 0.03, fiber_g=2, confidence=0.9,
            )],
            totals=FoodTotals(
                calories=cal, protein_g=round(cal * 0.05, 1),
                carbohydrates_g=round(cal * 0.12, 1), fat_g=round(cal * 0.03, 1), fiber_g=2,
            ),
            assumptions=["Parsed from nutrition label text (mock)."],
            overall_confidence=0.9,
        )
        return analysis


class MockCoachingProvider:
    name = "mock-coaching"

    def daily_summary(self, context: dict) -> str:
        band = context.get("readiness_band", "unknown")
        workout = context.get("workout_title") or "an easy session"
        protein_left = context.get("protein_remaining_g")
        parts = []
        if band == "green":
            parts.append("You're well recovered — good day to push intensity.")
        elif band == "yellow":
            parts.append("Moderate readiness — train, but keep intensity in check.")
        elif band == "red":
            parts.append("Recovery is down today. Prioritize easy movement and sleep.")
        else:
            parts.append("Limited data today — log sleep and HRV for a sharper read.")
        parts.append(f"Planned: {workout}.")
        if isinstance(protein_left, (int, float)) and protein_left > 0:
            parts.append(f"~{int(protein_left)}g protein to go.")
        return " ".join(parts)

    def weekly_summary(self, context: dict) -> str:
        return (
            "Solid week. Training adherence held up and protein was consistent. "
            "Sleep was the main lever — nudging bedtime earlier should lift readiness next week."
        )


class MockTranscriptionProvider:
    name = "mock-transcription"

    def transcribe(self, audio_bytes: bytes) -> str:
        seed = _seed(audio_bytes or b"empty")
        samples = [
            "Felt strong today, energy was high after the morning routine.",
            "Legs a little sore from yesterday's session but sleep was solid.",
            "Busy day, kept hydration up and hit my protein target.",
            "Low energy this morning, went with an easier run.",
        ]
        return samples[seed % len(samples)]
