from app.engines.nutrition import (
    NutritionInput,
    WeeklyAdjustInput,
    compute_targets,
    mifflin_st_jeor,
    weekly_adjustment,
)


def test_bmr_male_reference():
    # 86kg, 185cm, 43y male -> Mifflin-St Jeor
    bmr = mifflin_st_jeor("male", 43, 185, 86)
    assert 1750 < bmr < 1900


def test_targets_hit_protein_by_bodyweight():
    inp = NutritionInput(sex="male", age=43, height_cm=185, weight_kg=86,
                         experience="advanced", primary_goal="recomposition")
    r = compute_targets(inp)
    assert r.protein_g >= round(86 * 2.0)  # >= 2 g/kg for recomposition
    assert r.calories == r.tdee + r.rationale["goal_delta_kcal"] or r.rationale["calorie_floor_applied"]


def test_calorie_floor_enforced():
    inp = NutritionInput(sex="female", age=30, height_cm=160, weight_kg=50,
                         experience="beginner", primary_goal="fat_loss")
    r = compute_targets(inp)
    assert r.calories >= 1200  # never below female floor


def test_deficit_is_capped():
    inp = NutritionInput(sex="male", age=43, height_cm=185, weight_kg=86,
                         experience="advanced", primary_goal="fat_loss",
                         training_load_kcal=0)
    r = compute_targets(inp)
    assert r.rationale["goal_delta_kcal"] >= -750


def test_hard_day_blunts_deficit():
    base = dict(sex="male", age=43, height_cm=185, weight_kg=86,
                experience="advanced", primary_goal="fat_loss")
    normal = compute_targets(NutritionInput(**base, has_hard_session_today=False))
    hard = compute_targets(NutritionInput(**base, has_hard_session_today=True))
    assert hard.rationale["goal_delta_kcal"] > normal.rationale["goal_delta_kcal"]


def test_weekly_adjustment_is_gradual_and_bounded():
    new_cal, reasons = weekly_adjustment(2500, WeeklyAdjustInput(
        goal="fat_loss", seven_day_avg_calories=2500, weight_trend_kg_per_week=0.0,
        protein_adherence_pct=95, workout_adherence_pct=90, avg_readiness=70,
    ))
    assert abs(new_cal - 2500) <= 150
    assert reasons


def test_weekly_adjustment_eases_when_losing_too_fast():
    new_cal, reasons = weekly_adjustment(2200, WeeklyAdjustInput(
        goal="fat_loss", seven_day_avg_calories=2200, weight_trend_kg_per_week=-1.2,
        protein_adherence_pct=90, workout_adherence_pct=90, avg_readiness=65,
    ))
    assert new_cal > 2200
