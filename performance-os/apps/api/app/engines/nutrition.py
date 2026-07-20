"""Nutrition target engine — deterministic, explainable, safety-bounded.

BMR: Mifflin–St Jeor. TDEE: BMR × activity factor + today's training load. Calorie target
adjusts toward the primary goal within safe bounds (never below a calorie floor; deficit capped).
Macros: protein by bodyweight & goal, fat as % of calories, carbs fill the remainder. Weekly
adjustment nudges the target gradually from the 7-day weight trend and adherence.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.core.config import settings

# Baseline (non-exercise) activity multipliers on BMR. Measured active-energy from the day's
# training is ADDED on top (training_load_kcal), so these represent NEAT/lifestyle only and
# intentionally avoid double-counting exercise.
ACTIVITY_FACTORS = {
    "beginner": 1.25,
    "intermediate": 1.35,
    "advanced": 1.45,
}

GOAL_CALORIE_DELTA = {   # baseline daily delta vs TDEE, before safety clamps
    "fat_loss": -500,
    "recomposition": -200,
    "muscle_gain": 250,
    "endurance": 100,
    "strength": 150,
    "longevity": 0,
    "general_health": 0,
    "athletic_performance": 100,
}

GOAL_PROTEIN_G_PER_KG = {
    "fat_loss": 2.2,
    "recomposition": 2.2,
    "muscle_gain": 2.0,
    "endurance": 1.6,
    "strength": 2.0,
    "longevity": 1.8,
    "general_health": 1.6,
    "athletic_performance": 2.0,
}


@dataclass
class NutritionInput:
    sex: str
    age: int
    height_cm: float
    weight_kg: float
    experience: str = "intermediate"
    primary_goal: str = "general_health"
    training_load_kcal: float = 0.0          # today's expected/actual active energy
    has_hard_session_today: bool = False


@dataclass
class NutritionResult:
    bmr: int
    tdee: int
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    fiber_g: int
    hydration_ml: int
    rationale: dict = field(default_factory=dict)


def mifflin_st_jeor(sex: str, age: int, height_cm: float, weight_kg: float) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + (5 if sex == "male" else -161)


def compute_targets(inp: NutritionInput) -> NutritionResult:
    bmr = mifflin_st_jeor(inp.sex, inp.age, inp.height_cm, inp.weight_kg)
    activity = ACTIVITY_FACTORS.get(inp.experience, 1.55)
    tdee = bmr * activity + inp.training_load_kcal

    delta = GOAL_CALORIE_DELTA.get(inp.primary_goal, 0)
    # On a hard training day, blunt any deficit to protect performance/recovery.
    if inp.has_hard_session_today and delta < 0:
        delta = int(delta * 0.5)

    # Safety: cap deficit and enforce a calorie floor.
    delta = max(delta, -settings.MAX_DAILY_DEFICIT)
    calories = tdee + delta
    floor = (
        settings.MIN_CALORIE_FLOOR_MALE if inp.sex == "male"
        else settings.MIN_CALORIE_FLOOR_FEMALE
    )
    floored = False
    if calories < floor:
        calories = floor
        floored = True

    protein_per_kg = GOAL_PROTEIN_G_PER_KG.get(inp.primary_goal, 1.8)
    protein_g = protein_per_kg * inp.weight_kg
    fat_g = (calories * 0.28) / 9                      # 28% of calories from fat
    remaining = calories - (protein_g * 4 + fat_g * 9)
    carbs_g = max(remaining, 0) / 4
    fiber_g = max(round(calories / 1000 * 14), 25)      # ~14g/1000 kcal, min 25
    hydration_ml = round(inp.weight_kg * 33 + inp.training_load_kcal * 0.6)

    return NutritionResult(
        bmr=round(bmr),
        tdee=round(tdee),
        calories=round(calories),
        protein_g=round(protein_g),
        carbs_g=round(carbs_g),
        fat_g=round(fat_g),
        fiber_g=fiber_g,
        hydration_ml=hydration_ml,
        rationale={
            "activity_factor": activity,
            "goal_delta_kcal": delta,
            "training_load_kcal": round(inp.training_load_kcal),
            "calorie_floor_applied": floored,
            "protein_g_per_kg": protein_per_kg,
            "note": "Estimates. Not medical advice; avoids extreme deficits.",
        },
    )


@dataclass
class WeeklyAdjustInput:
    goal: str
    seven_day_avg_calories: float
    weight_trend_kg_per_week: float          # negative = losing
    protein_adherence_pct: float             # 0-100
    workout_adherence_pct: float             # 0-100
    avg_readiness: float | None = None       # 0-100


def weekly_adjustment(current_calories: int, w: WeeklyAdjustInput) -> tuple[int, list[str]]:
    """Return (new_calorie_target, reasons). Changes are gradual and bounded."""
    reasons: list[str] = []
    change = 0
    max_step = settings.MAX_WEEKLY_TARGET_CHANGE

    losing = w.weight_trend_kg_per_week < -0.1
    gaining = w.weight_trend_kg_per_week > 0.1

    if w.goal in ("fat_loss", "recomposition"):
        if not losing:
            change -= 100
            reasons.append("Weight trend flat while targeting fat loss — small calorie reduction.")
        elif w.weight_trend_kg_per_week < -0.9:
            change += 100
            reasons.append("Losing faster than ~0.9kg/wk — easing deficit to protect muscle.")
    elif w.goal == "muscle_gain":
        if not gaining:
            change += 100
            reasons.append("Weight trend flat while targeting muscle gain — small calorie increase.")
        elif w.weight_trend_kg_per_week > 0.5:
            change -= 100
            reasons.append("Gaining quickly — trimming surplus to limit fat gain.")

    if w.avg_readiness is not None and w.avg_readiness < 55:
        change = min(change, 0)
        reasons.append("Readiness has been low — not increasing the deficit this week.")

    if w.protein_adherence_pct < 80:
        reasons.append("Protein adherence under 80% — focus on hitting protein before changing calories.")

    change = max(-max_step, min(max_step, change))
    if change == 0 and not reasons:
        reasons.append("On track — holding targets steady.")
    return current_calories + change, reasons
