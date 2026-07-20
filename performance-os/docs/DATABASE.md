# Data Model

All tables are defined as SQLModel classes in `apps/api/app/models/__init__.py`. There are
**30 tables**. The same models run on SQLite (local demo) and Postgres/Supabase (production);
the Postgres DDL and Row Level Security policies live in
[`supabase/schema.sql`](../supabase/schema.sql) and [`supabase/rls.sql`](../supabase/rls.sql).

---

## Conventions

- **Primary keys** — `id` is a UUID stored as a string (`str(uuid.uuid4())`). On Postgres this
  maps to `uuid` with `default gen_random_uuid()`.
- **Timestamps** — every table has `created_at` and `updated_at` (`TimestampMixin`). Times are
  stored as naive UTC (SQLite drops tzinfo; the domain is kept consistent). On Postgres these are
  `timestamptz` with `now()` defaults.
- **Soft delete** — deletable rows carry a nullable `deleted_at` (users, meals, food_images,
  workouts, medications, supplements). Queries filter it out; the row is retained.
- **Provenance** — `source` (`manual | healthkit | google_calendar | ai | seed | engine | ...`)
  and, where relevant, `confidence` / `overall_confidence` capture where a value came from and how
  sure we are. External-import rows also carry `external_id` and a `dedup_key`.
- **Ownership & isolation** — user-owned rows carry `user_id` (FK → `users.id`). The API scopes
  every query by it (app-layer isolation on SQLite). On Postgres, database **Row Level Security**
  enforces the same (see [SECURITY.md](./SECURITY.md) and `supabase/rls.sql`). Child tables
  (`meal_items`, `nutrient_values`, `workout_sets`, `routine_exercises`) have no `user_id` and are
  scoped through their parent.
- **JSON columns** — list/dict fields (`dietary_preferences`, `rationale`, `components`,
  `blocks`, `scopes`, `meta`, ...) are `JSON` on SQLite and `jsonb` on Postgres.

---

## Identity & profile

### `users`
Account + auth. `id`, `email` (unique, indexed), `hashed_password`, `is_active`, `onboarded`,
`external_auth_id` (indexed; Supabase UID seam), `deleted_at`.

### `profiles`
One per user. Demographics and preferences: `user_id`, `name`, `date_of_birth`, `sex`,
`height_cm`, `weight_kg`, `goal_weight_kg`, `body_fat_pct`, `training_experience`,
`weekly_training_days`, JSON lists (`dietary_preferences`, `allergies`, `injuries`,
`medical_restrictions`, `equipment`), `wake_time`, `bedtime`, `units`, `consent_accepted_at`,
`source`.

### `goals`
Ranked objectives: `user_id`, `objective` (`fat_loss | muscle_gain | recomposition | ...`),
`priority`, `active`.

---

## Nutrition

### `nutrition_targets`
Engine-computed daily targets: `user_id`, `date` (indexed), `calories`, `protein_g`, `carbs_g`,
`fat_g`, `fiber_g`, `hydration_ml`, `bmr`, `tdee`, `rationale` (JSON), `source`.

### `meals`
A logged meal: `user_id`, `name`, `meal_type` (`breakfast | lunch | dinner | snack`),
`eaten_at` (indexed), `image_id` (FK → `food_images`), `overall_confidence`, `assumptions`
(JSON), `source` (`manual | ai_photo | barcode | label | saved`), `is_favorite`, `deleted_at`.

### `meal_items`
Line items within a meal (**child of `meals`**): `meal_id`, `name`, `estimated_quantity`,
`unit`, `confidence`, `user_corrected`.

### `nutrient_values`
Per-item nutrient breakdown (**child of `meal_items`**), one row per item with a wide set of
columns: `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`,
`potassium_mg`, `calcium_mg`, `iron_mg`, `magnesium_mg`, `vitamin_a_ug`, `vitamin_c_mg`,
`vitamin_d_ug`, `vitamin_b12_ug`, `folate_ug`, `cholesterol_mg`.

### `food_images`
Uploaded meal photos: `user_id`, `path`, `content_type`, `deleted_at`.

---

## Training

### `workouts`
`user_id`, `type` (`strength | running | calisthenics | mobility | conditioning | sport |
recovery | ...`), `title`, `started_at` (indexed), `duration_min`, `perceived_effort` (RPE),
`notes`, `source` (`manual | healthkit | google_calendar`), `external_id` (indexed),
`dedup_key` (indexed), `confirmed`, `deleted_at`.

### `exercises`
Exercise catalog: `name` (indexed), `category`, `primary_muscle`, `equipment`.

### `workout_sets`
Set-by-set detail (**child of `workouts`**): `workout_id`, `exercise_name`, `set_number`,
`reps`, `load_kg`, `rpe`, `rest_sec`, `tempo`, `is_pr`, `notes`.

### `runs`
Run detail (optionally linked to a workout): `workout_id`, `user_id`, `started_at`,
`distance_km`, `duration_min`, `avg_pace_min_km`, `avg_hr`, `elevation_m`, `cadence`,
`zone2_min`, `perceived_effort`, `source`.

---

## Health, sleep & recovery signals

### `health_samples`
Generic metric samples: `user_id`, `metric` (indexed; `hrv | resting_hr | steps |
active_energy | vo2max | respiratory_rate | ...`), `value`, `unit`, `recorded_at` (indexed),
`source`, `source_name` (attribution), `external_id` (indexed).

### `sleep_sessions`
Per-night sleep: `user_id`, `date` (the "morning of"), `duration_min`, `quality`, `deep_min`,
`rem_min`, `awake_min`, `start_at`, `end_at`, `source`.

### `readiness_scores`
Stored readiness output: `user_id`, `date` (indexed), `score` (0–100, nullable when
insufficient data), `band` (`green | yellow | red | unknown`), `components` (JSON), `weights`
(JSON), `explanation` (JSON), `data_completeness` (0–1).

---

## Calendar & morning routine

### `calendar_events`
Imported calendar entries: `user_id`, `external_id` (indexed), `title`, `description`,
`calendar_name`, `start_at` (indexed), `end_at`, `matched_type` (from matching rules),
`imported_workout_id` (FK → `workouts`), `source`.

### `morning_routines`
Generated routines: `user_id`, `date` (indexed), `progression_week`, `intensity_target`,
`total_duration_min`, `blocks` (JSON: warmup/main/mobility/cooldown), `completed`,
`completed_at`, `source`.

### `routine_exercises`
Individual routine movements (**child of `morning_routines`**): `routine_id`, `block`
(`warmup | main | mobility | cooldown`), `name`, `prescription` (e.g. `"3 x 12"` / `"45s"`),
`substitution`, `order`.

---

## Recovery modalities

### `recovery_sessions`
`user_id`, `modality` (`mobility | stretch | massage | breathwork | walk`), `duration_min`,
`performed_at` (indexed), `notes`, `source`.

### `sauna_sessions`
`user_id`, `temperature_c`, `duration_min`, `performed_at` (indexed), `session_type`
(`post_workout | separate`), `subjective_response`, `source`.

### `cold_plunge_sessions`
`user_id`, `temperature_c`, `duration_min`, `performed_at` (indexed), `session_type`,
`subjective_response`, `source`.

---

## Journal, labs & sensitive data

### `journal_entries`
Daily check-in: `user_id`, `date` (indexed), `mood`, `energy`, `stress`, `soreness` (each 1–5),
`gratitude`, `daily_win`, `daily_challenge`, `notes`, `voice_transcribed`, `source`.

### `lab_results`
`user_id`, `panel`, `test_name`, `value`, `unit`, `reference_low`, `reference_high`, `flag`
(`low | high | normal` — user/lab supplied only, never diagnosed), `collected_on`, `laboratory`,
`notes`, `source_document`, `source`.

### `medications` — **sensitive**
Isolated for least-privilege access; **never emitted to logs**: `user_id`, `name`, `dose`,
`schedule`, `sensitive` (default `true`), `deleted_at`.

### `supplements`
`user_id`, `name`, `dose`, `schedule`, `deleted_at`.

---

## System, integrations & audit

### `notification_preferences`
One per user (`user_id` unique): per-category toggles (`morning_summary`, `workout_reminder`,
`meal_reminder`, `protein_deficit`, `hydration_deficit`, `bedtime`, `journal_reminder`,
`recovery_warning`, `weekly_report`, `lab_followup`) plus `quiet_hours_start` / `quiet_hours_end`.

### `integrations`
Provider connection state: `user_id`, `provider` (indexed; `apple_health | google_calendar`),
`status` (`connected | disconnected | error | revoked`), `connected`, `last_sync_at`,
`last_error`, `scopes` (JSON).

### `sync_jobs`
Sync run history: `user_id`, `provider`, `status` (`queued | running | success | error`),
`started_at`, `finished_at`, `records_imported`, `error`.

### `ai_analysis_records`
Audit of every AI call: `user_id`, `kind` (`vision | nutrition | coaching | transcription |
weekly`), `provider`, `request_ref` (no PII, e.g. an image id), `output_confidence`, `valid`,
`latency_ms`.

### `audit_logs`
Security-relevant actions: `user_id` (nullable, indexed), `action` (indexed; `login | export |
delete_account | revoke_integration | ...`), `resource`, `ip`, `meta` (JSON).

---

## Table index (all 30)

`users`, `profiles`, `goals`, `nutrition_targets`, `meals`, `meal_items`, `nutrient_values`,
`food_images`, `workouts`, `exercises`, `workout_sets`, `runs`, `health_samples`,
`sleep_sessions`, `readiness_scores`, `calendar_events`, `morning_routines`, `routine_exercises`,
`recovery_sessions`, `sauna_sessions`, `cold_plunge_sessions`, `journal_entries`, `lab_results`,
`medications`, `supplements`, `notification_preferences`, `integrations`, `sync_jobs`,
`ai_analysis_records`, `audit_logs`.

---

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md),
[supabase/README.md](../supabase/README.md).
