"""Validate + sanitize any AI output before it is stored.

Rejects malformed payloads, clamps impossible values, and guarantees `is_estimate=True`.
Used by both mock and (future) real providers.
"""
from __future__ import annotations

from pydantic import ValidationError

from app.schemas.food import FoodAnalysis


class AIValidationError(Exception):
    pass


def validate_food_analysis(raw: dict | FoodAnalysis) -> FoodAnalysis:
    try:
        analysis = raw if isinstance(raw, FoodAnalysis) else FoodAnalysis.model_validate(raw)
    except ValidationError as e:
        raise AIValidationError(f"AI food analysis failed schema validation: {e}") from e

    # Never present an AI estimate as exact.
    analysis.is_estimate = True

    # Clamp confidences into [0, 1].
    analysis.overall_confidence = min(max(analysis.overall_confidence, 0.0), 1.0)
    for item in analysis.items:
        item.confidence = min(max(item.confidence, 0.0), 1.0)

    # Sanity bound: reject absurd single-meal totals rather than store garbage.
    if analysis.totals.calories > 8000:
        raise AIValidationError("Implausible calorie total (>8000) rejected.")
    return analysis
