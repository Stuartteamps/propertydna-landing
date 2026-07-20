"""Deterministic 10-minute morning routine generator with weekly progression.

Rules first, AI second. The routine complements the day's main workout (never pre-fatigues
the muscles it needs), scales with readiness/soreness, respects injuries & equipment, progresses
weekly, and deloads every 4th week. ~10 minutes total.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Movement pools tagged by emphasis so we can avoid pre-fatiguing the day's main muscles.
PUSH = ["push-ups", "incline push-ups", "pike push-ups", "shoulder taps"]
LEGS = ["air squats", "reverse lunges", "glute bridges", "wall sit"]
CORE = ["plank", "hollow hold", "dead bug", "sit-ups", "mountain climbers"]
CONDITIONING = ["burpees", "mountain climbers", "high knees"]
MOBILITY = ["world's greatest stretch", "hip flexor stretch", "thoracic rotations",
            "cat-cow", "90/90 hips"]
SHOULDER = ["band pull-aparts", "scap push-ups", "arm circles"]
BREATH = ["box breathing"]

INJURY_BLOCKLIST = {
    "shoulder": {"push-ups", "pike push-ups", "incline push-ups", "shoulder taps",
                 "scap push-ups", "arm circles", "burpees"},
    "knee": {"air squats", "reverse lunges", "wall sit", "burpees", "high knees"},
    "lower_back": {"sit-ups", "burpees", "hollow hold"},
    "hip": {"reverse lunges", "90/90 hips", "wall sit"},
}


@dataclass
class RoutineInput:
    main_workout_today: str | None = None      # strength_upper | strength_lower | running | ...
    main_workout_yesterday: str | None = None
    running_volume_week_km: float = 0.0
    readiness_band: str = "unknown"            # green | yellow | red | unknown
    soreness: int | None = None                # 1-5
    injuries: list[str] = field(default_factory=list)
    equipment: list[str] = field(default_factory=list)
    progression_week: int = 1                   # 1..N, week 4 = deload


@dataclass
class RoutineBlock:
    block: str
    name: str
    prescription: str
    substitution: str | None = None


@dataclass
class RoutineResult:
    intensity_target: str
    total_duration_min: int
    progression_week: int
    is_deload: bool
    blocks: list[RoutineBlock]


def _intensity(inp: RoutineInput) -> str:
    if inp.readiness_band == "red" or (inp.soreness and inp.soreness >= 4):
        return "easy"
    if inp.readiness_band == "green" and (not inp.soreness or inp.soreness <= 2):
        return "hard"
    return "moderate"


def _reps_for(base: int, intensity: str, is_deload: bool, week: int) -> int:
    reps = base + (week - 1) * 2                 # gradual weekly progression
    if intensity == "easy":
        reps = int(reps * 0.7)
    elif intensity == "hard":
        reps = int(reps * 1.15)
    if is_deload:
        reps = int(reps * 0.6)
    return max(reps, 5)


def _blocked(name: str, injuries: list[str]) -> bool:
    for inj in injuries:
        if name in INJURY_BLOCKLIST.get(inj, set()):
            return True
    return False


def _pick(pool: list[str], injuries: list[str], fallback: list[str]) -> str:
    for name in pool:
        if not _blocked(name, injuries):
            return name
    for name in fallback:
        if not _blocked(name, injuries):
            return name
    return "box breathing"  # always safe


def generate_routine(inp: RoutineInput) -> RoutineResult:
    is_deload = inp.progression_week % 4 == 0
    intensity = "easy" if is_deload else _intensity(inp)
    today = (inp.main_workout_today or "").lower()

    # Avoid pre-fatiguing the day's main movers.
    avoid_push = "upper" in today or "push" in today
    avoid_legs = "lower" in today or "leg" in today or "run" in today

    main_pool_a = CORE if (avoid_push and avoid_legs) else (
        LEGS if avoid_push else PUSH if avoid_legs else PUSH
    )
    main_pool_b = CORE if not avoid_legs else CONDITIONING
    # If running-heavy week, keep pounding low.
    if inp.running_volume_week_km > 40:
        main_pool_b = CORE

    warmup = [
        RoutineBlock("warmup", _pick(MOBILITY, inp.injuries, MOBILITY), "60s"),
        RoutineBlock("warmup", _pick(SHOULDER, inp.injuries, MOBILITY), "45s"),
    ]

    ex1 = _pick(main_pool_a, inp.injuries, CORE)
    ex2 = _pick([m for m in main_pool_b if m != ex1], inp.injuries, CORE)
    ex3 = _pick([m for m in CORE if m not in (ex1, ex2)], inp.injuries, MOBILITY)

    rounds = 2 if intensity == "easy" else 3
    main = [
        RoutineBlock("main", ex1, f"{rounds} x {_reps_for(12, intensity, is_deload, inp.progression_week)}",
                     substitution="incline push-ups" if ex1 == "push-ups" else None),
        RoutineBlock("main", ex2, f"{rounds} x {_reps_for(15, intensity, is_deload, inp.progression_week)}"),
        RoutineBlock("main", ex3, f"{rounds} x {_reps_for(30, intensity, is_deload, inp.progression_week)}s"
                     if ex3 in ("plank", "hollow hold", "wall sit")
                     else f"{rounds} x {_reps_for(15, intensity, is_deload, inp.progression_week)}"),
    ]

    mobility = [
        RoutineBlock("mobility", _pick([m for m in MOBILITY], inp.injuries, MOBILITY), "60s"),
        RoutineBlock("mobility", _pick(MOBILITY[::-1], inp.injuries, MOBILITY), "60s"),
    ]
    cooldown = [RoutineBlock("cooldown", "box breathing", "60s (4-4-4-4)")]

    blocks = warmup + main + mobility + cooldown
    return RoutineResult(
        intensity_target=intensity,
        total_duration_min=10,
        progression_week=inp.progression_week,
        is_deload=is_deload,
        blocks=blocks,
    )
