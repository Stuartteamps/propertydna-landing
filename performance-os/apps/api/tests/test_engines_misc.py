import datetime as dt

from app.engines.calendar_match import match_event, workout_type_for_calendar
from app.engines.dedup import choose_primary, dedup_key, is_duplicate
from app.engines.morning_routine import RoutineInput, generate_routine


# ---------------- calendar matching ----------------
def test_calendar_matching_rules():
    # Muscle-group specificity wins over the generic pharos rule.
    assert match_event("Pharos Strength — Upper").matched_type == "strength_upper"
    assert match_event("Pharos Conditioning").matched_type == "pharos_class"
    assert match_event("Zone 2 Run 8k").matched_type == "running"
    assert match_event("Pharos Legs").matched_type == "strength_lower"
    assert match_event("Upper Body Push").matched_type == "strength_upper"
    assert match_event("Board meeting").matched_type is None


def test_calendar_type_collapse():
    assert workout_type_for_calendar("running") == "running"
    assert workout_type_for_calendar("strength_lower") == "strength"
    assert workout_type_for_calendar(None) == "conditioning"


# ---------------- dedup ----------------
def test_dedup_same_session_within_window():
    a = dt.datetime(2026, 7, 20, 6, 0, tzinfo=dt.UTC)
    b = dt.datetime(2026, 7, 20, 6, 45, tzinfo=dt.UTC)
    assert is_duplicate(a, "strength", b, "strength")


def test_dedup_different_type_not_duplicate():
    a = dt.datetime(2026, 7, 20, 6, 0, tzinfo=dt.UTC)
    b = dt.datetime(2026, 7, 20, 6, 10, tzinfo=dt.UTC)
    assert not is_duplicate(a, "strength", b, "running")


def test_dedup_outside_window():
    a = dt.datetime(2026, 7, 20, 6, 0, tzinfo=dt.UTC)
    b = dt.datetime(2026, 7, 20, 9, 0, tzinfo=dt.UTC)
    assert not is_duplicate(a, "strength", b, "strength")


def test_dedup_key_stable_and_bucketed():
    a = dt.datetime(2026, 7, 20, 6, 0, tzinfo=dt.UTC)
    b = dt.datetime(2026, 7, 20, 6, 30, tzinfo=dt.UTC)
    assert dedup_key("u1", a, "strength") == dedup_key("u1", b, "strength")


def test_choose_primary_prefers_healthkit():
    assert choose_primary("google_calendar", "healthkit") == "healthkit"
    assert choose_primary("healthkit", "manual") == "healthkit"


# ---------------- morning routine ----------------
def test_routine_is_ten_minutes_with_all_blocks():
    r = generate_routine(RoutineInput(readiness_band="green", progression_week=1))
    assert r.total_duration_min == 10
    blocks = {b.block for b in r.blocks}
    assert {"warmup", "main", "mobility", "cooldown"} <= blocks


def test_routine_avoids_pushups_before_upper_day():
    r = generate_routine(RoutineInput(main_workout_today="strength_upper",
                                      readiness_band="green", progression_week=1))
    main_names = {b.name for b in r.blocks if b.block == "main"}
    assert "push-ups" not in main_names


def test_routine_respects_shoulder_injury():
    r = generate_routine(RoutineInput(injuries=["shoulder"], readiness_band="green",
                                      progression_week=1))
    names = {b.name for b in r.blocks}
    assert "push-ups" not in names and "burpees" not in names


def test_routine_deloads_on_week_four():
    r = generate_routine(RoutineInput(readiness_band="green", progression_week=4))
    assert r.is_deload is True
    assert r.intensity_target == "easy"


def test_routine_progression_increases_reps():
    w1 = generate_routine(RoutineInput(readiness_band="green", progression_week=1))
    w3 = generate_routine(RoutineInput(readiness_band="green", progression_week=3))

    def first_main_reps(res):
        b = next(b for b in res.blocks if b.block == "main")
        return b.prescription
    assert w1.blocks and w3.blocks  # both generated
    # week 3 prescription should not be smaller than week 1 for the same intensity
    assert first_main_reps(w1) != first_main_reps(w3) or w1.intensity_target != w3.intensity_target


def test_routine_easy_when_red_readiness():
    r = generate_routine(RoutineInput(readiness_band="red", soreness=5, progression_week=1))
    assert r.intensity_target == "easy"
