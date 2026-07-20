"""Readiness scoring — explainable, configurable, and honest about missing data.

Score = 100 × Σ(weightᵢ × componentᵢ) / Σ(weight of *available* components).
Each component is normalized to [0, 1] (higher = more ready). Weights are configurable.
If too few components are available (data_completeness < MIN_COMPLETENESS) we return
score=None / band="unknown" instead of a falsely precise number.

Bands: green ≥ 70, yellow 50–69, red < 50.

This is a wellness signal, not a medical measurement.
"""
from __future__ import annotations

from dataclasses import dataclass

DEFAULT_WEIGHTS = {
    "sleep_duration": 0.25,
    "sleep_consistency": 0.10,
    "hrv": 0.25,
    "resting_hr": 0.15,
    "training_load": 0.10,
    "soreness": 0.05,
    "mood": 0.03,
    "energy": 0.04,
    "illness": 0.03,
}

MIN_COMPLETENESS = 0.4   # need ≥40% of weighted components present to score


@dataclass
class ReadinessInput:
    # None means "not available" for that signal.
    sleep_minutes: float | None = None
    sleep_target_minutes: float = 480
    sleep_std_minutes: float | None = None          # 7-day consistency (lower = better)
    hrv_ms: float | None = None
    hrv_baseline_ms: float | None = None
    resting_hr: float | None = None
    resting_hr_baseline: float | None = None
    acute_load: float | None = None                 # last ~3 days strain
    chronic_load: float | None = None               # ~28-day strain baseline
    soreness: int | None = None                     # 1 (none) - 5 (severe)
    mood: int | None = None                         # 1-5 (5 best)
    energy: int | None = None                       # 1-5 (5 best)
    illness: bool | None = None                     # True if symptoms reported


@dataclass
class ReadinessResult:
    score: int | None
    band: str
    components: dict
    weights: dict
    explanation: list[str]
    data_completeness: float


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _norm_sleep_duration(mins: float, target: float) -> float:
    # 1.0 at/above target; degrades below. 90 min short ≈ 0.7.
    return _clamp01(1.0 - max(0.0, target - mins) / 300.0)


def _norm_sleep_consistency(std_min: float) -> float:
    # 0 std → 1.0; 90 min std → ~0.25.
    return _clamp01(1.0 - std_min / 120.0)


def _norm_hrv(hrv: float, baseline: float) -> float:
    # ratio vs baseline mapped so 100% = 0.8, +25% ≈ 1.0, -25% ≈ 0.5.
    if baseline <= 0:
        return 0.5
    ratio = hrv / baseline
    return _clamp01(0.8 + (ratio - 1.0) * 0.8)


def _norm_resting_hr(rhr: float, baseline: float) -> float:
    # Lower vs baseline is better. +8 bpm over baseline ≈ 0.4.
    if baseline <= 0:
        return 0.5
    delta = rhr - baseline
    return _clamp01(0.8 - delta * 0.05)


def _norm_training_load(acute: float, chronic: float) -> float:
    # Acute:chronic ratio. Sweet spot ~0.8-1.3. High ratio => less ready.
    if chronic <= 0:
        return 0.6
    acwr = acute / chronic
    if acwr <= 1.0:
        return _clamp01(0.85 + (1.0 - acwr) * 0.15)
    return _clamp01(1.0 - (acwr - 1.0) * 0.6)


def _norm_1to5(v: int, invert: bool = False) -> float:
    # soreness: invert (5=severe -> low readiness). mood/energy: 5 best.
    frac = (v - 1) / 4.0
    return _clamp01(1.0 - frac if invert else frac)


def compute_readiness(inp: ReadinessInput, weights: dict | None = None) -> ReadinessResult:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    comp: dict[str, float] = {}

    if inp.sleep_minutes is not None:
        comp["sleep_duration"] = _norm_sleep_duration(inp.sleep_minutes, inp.sleep_target_minutes)
    if inp.sleep_std_minutes is not None:
        comp["sleep_consistency"] = _norm_sleep_consistency(inp.sleep_std_minutes)
    if inp.hrv_ms is not None and inp.hrv_baseline_ms:
        comp["hrv"] = _norm_hrv(inp.hrv_ms, inp.hrv_baseline_ms)
    if inp.resting_hr is not None and inp.resting_hr_baseline:
        comp["resting_hr"] = _norm_resting_hr(inp.resting_hr, inp.resting_hr_baseline)
    if inp.acute_load is not None and inp.chronic_load is not None:
        comp["training_load"] = _norm_training_load(inp.acute_load, inp.chronic_load)
    if inp.soreness is not None:
        comp["soreness"] = _norm_1to5(inp.soreness, invert=True)
    if inp.mood is not None:
        comp["mood"] = _norm_1to5(inp.mood)
    if inp.energy is not None:
        comp["energy"] = _norm_1to5(inp.energy)
    if inp.illness is not None:
        comp["illness"] = 0.0 if inp.illness else 1.0

    available_weight = sum(w[k] for k in comp)
    total_weight = sum(w[k] for k in DEFAULT_WEIGHTS)
    completeness = round(available_weight / total_weight, 2) if total_weight else 0.0

    if completeness < MIN_COMPLETENESS or not comp:
        return ReadinessResult(
            score=None, band="unknown", components=comp, weights=w,
            explanation=["Not enough data to score readiness confidently. "
                         "Connect sleep and HRV for a reliable score."],
            data_completeness=completeness,
        )

    weighted = sum(w[k] * v for k, v in comp.items()) / available_weight
    score = round(weighted * 100)
    band = "green" if score >= 70 else "yellow" if score >= 50 else "red"

    explanation = _explain(comp, inp, score)
    return ReadinessResult(
        score=score, band=band, components={k: round(v, 3) for k, v in comp.items()},
        weights=w, explanation=explanation, data_completeness=completeness,
    )


def _explain(comp: dict, inp: ReadinessInput, score: int) -> list[str]:
    notes: list[str] = []
    # Surface the biggest drivers (lowest components).
    for key, val in sorted(comp.items(), key=lambda kv: kv[1])[:3]:
        if val >= 0.75:
            continue
        if key == "hrv" and inp.hrv_ms and inp.hrv_baseline_ms:
            pct = round((inp.hrv_ms / inp.hrv_baseline_ms - 1) * 100)
            notes.append(f"HRV is {pct:+d}% vs your baseline.")
        elif key == "sleep_duration" and inp.sleep_minutes is not None:
            deficit = round(inp.sleep_target_minutes - inp.sleep_minutes)
            if deficit > 0:
                notes.append(f"Sleep was {deficit} min below your target.")
        elif key == "resting_hr" and inp.resting_hr and inp.resting_hr_baseline:
            notes.append(f"Resting HR is {round(inp.resting_hr - inp.resting_hr_baseline):+d} bpm "
                         "vs baseline.")
        elif key == "training_load":
            notes.append("Recent training load is elevated relative to your baseline.")
        elif key == "soreness" and inp.soreness:
            notes.append("Reported soreness is elevated.")
        elif key == "illness" and inp.illness:
            notes.append("Illness symptoms reported — prioritize recovery.")
    if not notes:
        notes.append("All tracked signals are near or above baseline.")
    return notes
