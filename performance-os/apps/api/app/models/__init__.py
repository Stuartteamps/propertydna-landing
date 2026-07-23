"""All SQLModel tables for Arete.

Conventions:
- UUID string primary keys (`id`).
- `created_at` / `updated_at` on every row; `deleted_at` for soft-deletable rows.
- `source` (manual | healthkit | google_calendar | ai | seed) + `confidence` where relevant.
- User-owned rows carry `user_id`; the API scopes every query by it (app-layer RLS on SQLite;
  database RLS in supabase/rls.sql when on Postgres).
"""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import JSON as SA_JSON
from sqlalchemy import Column
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> dt.datetime:
    # Naive UTC — SQLite drops tzinfo; keep the whole domain consistent.
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)


class TimestampMixin(SQLModel):
    created_at: dt.datetime = Field(default_factory=_now, nullable=False)
    updated_at: dt.datetime = Field(default_factory=_now, nullable=False)


# --------------------------------------------------------------------------- auth / identity
class User(TimestampMixin, table=True):
    __tablename__ = "users"
    id: str = Field(default_factory=_uuid, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    is_active: bool = True
    onboarded: bool = False
    external_auth_id: str | None = Field(default=None, index=True)  # supabase uid seam
    deleted_at: dt.datetime | None = None


class Profile(TimestampMixin, table=True):
    __tablename__ = "profiles"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    name: str | None = None
    date_of_birth: dt.date | None = None
    sex: str | None = None                # male | female | other
    height_cm: float | None = None
    weight_kg: float | None = None
    goal_weight_kg: float | None = None
    body_fat_pct: float | None = None
    training_experience: str | None = None    # beginner | intermediate | advanced
    weekly_training_days: int | None = None
    dietary_preferences: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    allergies: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    injuries: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    medical_restrictions: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    equipment: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    wake_time: str | None = None          # "05:00"
    bedtime: str | None = None            # "21:30"
    units: str = "imperial"                  # imperial | metric
    consent_accepted_at: dt.datetime | None = None
    source: str = "manual"


class Goal(TimestampMixin, table=True):
    __tablename__ = "goals"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    objective: str                            # fat_loss | muscle_gain | recomposition | ...
    priority: int = 1                         # 1 = highest
    active: bool = True


class NutritionTarget(TimestampMixin, table=True):
    __tablename__ = "nutrition_targets"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    date: dt.date = Field(index=True)
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    fiber_g: int
    hydration_ml: int
    bmr: int
    tdee: int
    adjustment_kcal: int = 0                       # persisted weekly nudge (added to baseline)
    adjustment_reasons: str | None = None
    rationale: dict = Field(default_factory=dict, sa_column=Column(SA_JSON))
    source: str = "engine"


# --------------------------------------------------------------------------- nutrition
class Meal(TimestampMixin, table=True):
    __tablename__ = "meals"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    name: str | None = None
    meal_type: str = "snack"                  # breakfast | lunch | dinner | snack
    eaten_at: dt.datetime = Field(default_factory=_now, index=True)
    image_id: str | None = Field(default=None, foreign_key="food_images.id")
    overall_confidence: float | None = None
    assumptions: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    source: str = "manual"                    # manual | ai_photo | barcode | label | saved
    is_favorite: bool = False
    deleted_at: dt.datetime | None = None


class MealItem(TimestampMixin, table=True):
    __tablename__ = "meal_items"
    id: str = Field(default_factory=_uuid, primary_key=True)
    meal_id: str = Field(index=True, foreign_key="meals.id")
    name: str
    estimated_quantity: float | None = None
    unit: str | None = "g"
    confidence: float | None = None
    user_corrected: bool = False


class NutrientValue(TimestampMixin, table=True):
    """Per-meal-item nutrient breakdown (one row per item; wide columns for the tracked set)."""
    __tablename__ = "nutrient_values"
    id: str = Field(default_factory=_uuid, primary_key=True)
    meal_item_id: str = Field(index=True, foreign_key="meal_items.id")
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    potassium_mg: float = 0
    calcium_mg: float = 0
    iron_mg: float = 0
    magnesium_mg: float = 0
    vitamin_a_ug: float = 0
    vitamin_c_mg: float = 0
    vitamin_d_ug: float = 0
    vitamin_b12_ug: float = 0
    folate_ug: float = 0
    cholesterol_mg: float = 0


class FoodImage(TimestampMixin, table=True):
    __tablename__ = "food_images"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    path: str
    content_type: str = "image/jpeg"
    deleted_at: dt.datetime | None = None


# --------------------------------------------------------------------------- training
class Workout(TimestampMixin, table=True):
    __tablename__ = "workouts"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    type: str = "strength"        # strength | running | calisthenics | mobility | conditioning
    title: str | None = None   # ... | sport | recovery | pharos_class
    started_at: dt.datetime = Field(default_factory=_now, index=True)
    duration_min: int | None = None
    perceived_effort: int | None = None   # RPE 1-10
    notes: str | None = None
    source: str = "manual"                   # manual | healthkit | google_calendar
    external_id: str | None = Field(default=None, index=True)
    dedup_key: str | None = Field(default=None, index=True)
    confirmed: bool = True
    deleted_at: dt.datetime | None = None


class Exercise(TimestampMixin, table=True):
    __tablename__ = "exercises"
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(index=True)
    category: str = "strength"    # strength | mobility | core | conditioning
    primary_muscle: str | None = None
    equipment: str | None = None


class WorkoutSet(TimestampMixin, table=True):
    __tablename__ = "workout_sets"
    id: str = Field(default_factory=_uuid, primary_key=True)
    workout_id: str = Field(index=True, foreign_key="workouts.id")
    exercise_name: str
    set_number: int = 1
    reps: int | None = None
    load_kg: float | None = None
    rpe: float | None = None
    rest_sec: int | None = None
    tempo: str | None = None
    is_pr: bool = False
    notes: str | None = None


class Run(TimestampMixin, table=True):
    __tablename__ = "runs"
    id: str = Field(default_factory=_uuid, primary_key=True)
    workout_id: str | None = Field(default=None, foreign_key="workouts.id")
    user_id: str = Field(index=True, foreign_key="users.id")
    started_at: dt.datetime = Field(default_factory=_now, index=True)
    distance_km: float | None = None
    duration_min: float | None = None
    avg_pace_min_km: float | None = None
    avg_hr: int | None = None
    elevation_m: float | None = None
    cadence: int | None = None
    zone2_min: float | None = None
    perceived_effort: int | None = None
    source: str = "manual"


# --------------------------------------------------------------------------- health / recovery
class HealthSample(TimestampMixin, table=True):
    __tablename__ = "health_samples"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    metric: str = Field(index=True)   # hrv | resting_hr | steps | active_energy | vo2max | ...
    value: float
    unit: str | None = None
    recorded_at: dt.datetime = Field(default_factory=_now, index=True)
    source: str = "healthkit"
    source_name: str | None = None  # data-source attribution
    external_id: str | None = Field(default=None, index=True)


class SleepSession(TimestampMixin, table=True):
    __tablename__ = "sleep_sessions"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    date: dt.date = Field(index=True)   # the "morning of" date
    duration_min: float
    quality: float | None = None     # 0-100
    deep_min: float | None = None
    rem_min: float | None = None
    awake_min: float | None = None
    start_at: dt.datetime | None = None
    end_at: dt.datetime | None = None
    source: str = "healthkit"


class ReadinessScore(TimestampMixin, table=True):
    __tablename__ = "readiness_scores"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    date: dt.date = Field(index=True)
    score: int | None = None                 # 0-100, None if insufficient data
    band: str = "unknown"                       # green | yellow | red | unknown
    components: dict = Field(default_factory=dict, sa_column=Column(SA_JSON))
    weights: dict = Field(default_factory=dict, sa_column=Column(SA_JSON))
    explanation: list = Field(default_factory=list, sa_column=Column(SA_JSON))
    data_completeness: float = 0.0              # 0-1


class CalendarEvent(TimestampMixin, table=True):
    __tablename__ = "calendar_events"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    external_id: str | None = Field(default=None, index=True)
    title: str
    description: str | None = None
    calendar_name: str | None = None
    start_at: dt.datetime = Field(index=True)
    end_at: dt.datetime | None = None
    matched_type: str | None = None          # from calendar matching rules
    imported_workout_id: str | None = Field(default=None, foreign_key="workouts.id")
    source: str = "google_calendar"


# --------------------------------------------------------------------------- morning routine
class MorningRoutine(TimestampMixin, table=True):
    __tablename__ = "morning_routines"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    date: dt.date = Field(index=True)
    progression_week: int = 1
    intensity_target: str = "moderate"
    total_duration_min: int = 10
    blocks: dict = Field(default_factory=dict, sa_column=Column(SA_JSON))  # warmup/main/mobility
    completed: bool = False
    completed_at: dt.datetime | None = None
    source: str = "engine"


class RoutineExercise(TimestampMixin, table=True):
    __tablename__ = "routine_exercises"
    id: str = Field(default_factory=_uuid, primary_key=True)
    routine_id: str = Field(index=True, foreign_key="morning_routines.id")
    block: str = "main"           # warmup | main | mobility | cooldown
    name: str
    prescription: str             # "3 x 12" or "45s"
    substitution: str | None = None
    order: int = 0


# --------------------------------------------------------------------------- recovery modalities
class RecoverySession(TimestampMixin, table=True):
    __tablename__ = "recovery_sessions"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    modality: str = "mobility"    # mobility | stretch | massage | breathwork | walk
    duration_min: int | None = None
    performed_at: dt.datetime = Field(default_factory=_now, index=True)
    notes: str | None = None
    source: str = "manual"


class SaunaSession(TimestampMixin, table=True):
    __tablename__ = "sauna_sessions"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    temperature_c: float | None = None
    duration_min: int | None = None
    performed_at: dt.datetime = Field(default_factory=_now, index=True)
    session_type: str = "post_workout"   # post_workout | separate
    subjective_response: str | None = None
    source: str = "manual"


class ColdPlungeSession(TimestampMixin, table=True):
    __tablename__ = "cold_plunge_sessions"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    temperature_c: float | None = None
    duration_min: float | None = None
    performed_at: dt.datetime = Field(default_factory=_now, index=True)
    session_type: str = "separate"
    subjective_response: str | None = None
    source: str = "manual"


# --------------------------------------------------------------------------- journal / labs
class JournalEntry(TimestampMixin, table=True):
    __tablename__ = "journal_entries"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    date: dt.date = Field(index=True)
    mood: int | None = None       # 1-5
    energy: int | None = None     # 1-5
    stress: int | None = None     # 1-5
    soreness: int | None = None   # 1-5
    gratitude: str | None = None
    daily_win: str | None = None
    daily_challenge: str | None = None
    notes: str | None = None
    voice_transcribed: bool = False
    source: str = "manual"


class LabResult(TimestampMixin, table=True):
    __tablename__ = "lab_results"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    panel: str | None = None
    test_name: str
    value: float
    unit: str
    reference_low: float | None = None
    reference_high: float | None = None
    flag: str | None = None       # low | high | normal (user/lab supplied only)
    collected_on: dt.date | None = None
    laboratory: str | None = None
    notes: str | None = None
    source_document: str | None = None
    source: str = "manual"


class Medication(TimestampMixin, table=True):
    """Sensitive. Never emitted to logs; separate table for least-privilege access."""
    __tablename__ = "medications"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    name: str
    dose: str | None = None
    schedule: str | None = None
    sensitive: bool = True
    deleted_at: dt.datetime | None = None


class Supplement(TimestampMixin, table=True):
    __tablename__ = "supplements"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    name: str
    dose: str | None = None
    schedule: str | None = None
    deleted_at: dt.datetime | None = None


# --------------------------------------------------------------------------- system
class NotificationPreference(TimestampMixin, table=True):
    __tablename__ = "notification_preferences"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id", unique=True)
    morning_summary: bool = True
    workout_reminder: bool = True
    meal_reminder: bool = True
    protein_deficit: bool = True
    hydration_deficit: bool = True
    bedtime: bool = True
    journal_reminder: bool = True
    recovery_warning: bool = True
    weekly_report: bool = True
    lab_followup: bool = True
    quiet_hours_start: str = "21:30"
    quiet_hours_end: str = "05:00"


class Integration(TimestampMixin, table=True):
    __tablename__ = "integrations"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    provider: str = Field(index=True)    # apple_health | google_calendar
    status: str = "disconnected"         # connected | disconnected | error | revoked
    connected: bool = False
    last_sync_at: dt.datetime | None = None
    last_error: str | None = None
    scopes: list = Field(default_factory=list, sa_column=Column(SA_JSON))


class SyncJob(TimestampMixin, table=True):
    __tablename__ = "sync_jobs"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    provider: str
    status: str = "queued"    # queued | running | success | error
    started_at: dt.datetime | None = None
    finished_at: dt.datetime | None = None
    records_imported: int = 0
    error: str | None = None


class AIAnalysisRecord(TimestampMixin, table=True):
    __tablename__ = "ai_analysis_records"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    kind: str                 # vision | nutrition | coaching | transcription | weekly
    provider: str
    request_ref: str | None = None       # e.g. image id (no PII)
    output_confidence: float | None = None
    valid: bool = True
    latency_ms: int | None = None


class AuditLog(TimestampMixin, table=True):
    __tablename__ = "audit_logs"
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str | None = Field(default=None, index=True)
    action: str = Field(index=True)         # login | export | delete_account | revoke_integration
    resource: str | None = None
    ip: str | None = None
    meta: dict = Field(default_factory=dict, sa_column=Column(SA_JSON))


__all__ = [
    "User", "Profile", "Goal", "NutritionTarget", "Meal", "MealItem", "NutrientValue",
    "FoodImage", "Workout", "Exercise", "WorkoutSet", "Run", "HealthSample", "SleepSession",
    "ReadinessScore", "CalendarEvent", "MorningRoutine", "RoutineExercise", "RecoverySession",
    "SaunaSession", "ColdPlungeSession", "JournalEntry", "LabResult", "Medication",
    "Supplement", "NotificationPreference", "Integration", "SyncJob", "AIAnalysisRecord",
    "AuditLog",
]
