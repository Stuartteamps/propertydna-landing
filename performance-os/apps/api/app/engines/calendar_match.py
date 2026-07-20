"""Configurable calendar → workout-type matching rules."""
from __future__ import annotations

from dataclasses import dataclass

# Ordered: first matching rule wins. Case-insensitive substring match on title (+description).
DEFAULT_RULES: list[tuple[str, str]] = [
    # Muscle-group specificity wins first (a "Pharos Legs" event is a lower-body day),
    # then the generic Pharos-class rule catches the rest.
    ("legs", "strength_lower"),
    ("lower", "strength_lower"),
    ("upper", "strength_upper"),
    ("push", "strength_upper"),
    ("pull", "strength_upper"),
    ("squat", "strength_lower"),
    ("deadlift", "strength_lower"),
    ("pharos", "pharos_class"),
    ("strength", "strength"),
    ("lift", "strength"),
    ("run", "running"),
    ("jog", "running"),
    ("5k", "running"),
    ("10k", "running"),
    ("tempo", "running"),
    ("mobility", "mobility"),
    ("stretch", "mobility"),
    ("yoga", "mobility"),
    ("sauna", "sauna"),
    ("cold plunge", "cold_plunge"),
    ("plunge", "cold_plunge"),
    ("ice bath", "cold_plunge"),
    ("recovery", "recovery"),
    ("pt ", "personal_training"),
    ("personal training", "personal_training"),
    ("baseball", "sport"),
    ("basketball", "sport"),
    ("tennis", "sport"),
    ("game", "sport"),
]


@dataclass
class MatchResult:
    matched_type: str | None
    matched_keyword: str | None


def match_event(title: str, description: str | None = None,
                rules: list[tuple[str, str]] | None = None) -> MatchResult:
    rules = rules or DEFAULT_RULES
    haystack = f"{title or ''} {description or ''}".lower()
    for keyword, wtype in rules:
        if keyword in haystack:
            return MatchResult(matched_type=wtype, matched_keyword=keyword)
    return MatchResult(matched_type=None, matched_keyword=None)


def workout_type_for_calendar(matched_type: str | None) -> str:
    """Collapse a fine-grained match into a Workout.type value."""
    if matched_type is None:
        return "conditioning"
    if matched_type.startswith("strength") or matched_type in ("pharos_class", "personal_training"):
        return "strength"
    if matched_type == "running":
        return "running"
    if matched_type in ("mobility", "recovery"):
        return "mobility"
    if matched_type == "sport":
        return "sport"
    if matched_type in ("sauna", "cold_plunge"):
        return "recovery"
    return "conditioning"
