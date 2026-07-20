-- ============================================================================
-- Performance OS — PostgreSQL schema (Supabase-ready)
--
-- Mirrors the 30 SQLModel tables in apps/api/app/models/__init__.py.
-- Conventions:
--   * Primary keys are UUIDs (SQLModel stores them as text UUIDs; here they are
--     native `uuid` with default gen_random_uuid()).
--   * created_at / updated_at are timestamptz defaulting to now().
--   * Soft-deletable rows carry deleted_at (nullable).
--   * JSON list/dict fields map to jsonb.
--   * user_id references users(id); child tables reference their parent.
--
-- Row Level Security policies are in rls.sql (apply after this file).
-- Requires the pgcrypto extension for gen_random_uuid() (bundled in Supabase).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- identity
create table if not exists users (
    id               uuid primary key default gen_random_uuid(),
    email            text not null unique,
    hashed_password  text not null,
    is_active        boolean not null default true,
    onboarded        boolean not null default false,
    external_auth_id text,
    deleted_at       timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists ix_users_external_auth_id on users (external_auth_id);

create table if not exists profiles (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references users(id) on delete cascade,
    name                 text,
    date_of_birth        date,
    sex                  text,
    height_cm            double precision,
    weight_kg            double precision,
    goal_weight_kg       double precision,
    body_fat_pct         double precision,
    training_experience  text,
    weekly_training_days integer,
    dietary_preferences  jsonb not null default '[]'::jsonb,
    allergies            jsonb not null default '[]'::jsonb,
    injuries             jsonb not null default '[]'::jsonb,
    medical_restrictions jsonb not null default '[]'::jsonb,
    equipment            jsonb not null default '[]'::jsonb,
    wake_time            text,
    bedtime              text,
    units                text not null default 'imperial',
    consent_accepted_at  timestamptz,
    source               text not null default 'manual',
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create index if not exists ix_profiles_user_id on profiles (user_id);

create table if not exists goals (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    objective  text not null,
    priority   integer not null default 1,
    active     boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists ix_goals_user_id on goals (user_id);

create table if not exists nutrition_targets (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    date         date not null,
    calories     integer not null,
    protein_g    integer not null,
    carbs_g      integer not null,
    fat_g        integer not null,
    fiber_g      integer not null,
    hydration_ml integer not null,
    bmr          integer not null,
    tdee         integer not null,
    rationale    jsonb not null default '{}'::jsonb,
    source       text not null default 'engine',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_nutrition_targets_user_id on nutrition_targets (user_id);
create index if not exists ix_nutrition_targets_date on nutrition_targets (date);

-- ---------------------------------------------------------------- nutrition
create table if not exists food_images (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    path         text not null,
    content_type text not null default 'image/jpeg',
    deleted_at   timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_food_images_user_id on food_images (user_id);

create table if not exists meals (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references users(id) on delete cascade,
    name               text,
    meal_type          text not null default 'snack',
    eaten_at           timestamptz not null default now(),
    image_id           uuid references food_images(id) on delete set null,
    overall_confidence double precision,
    assumptions        jsonb not null default '[]'::jsonb,
    source             text not null default 'manual',
    is_favorite        boolean not null default false,
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists ix_meals_user_id on meals (user_id);
create index if not exists ix_meals_eaten_at on meals (eaten_at);

create table if not exists meal_items (
    id                 uuid primary key default gen_random_uuid(),
    meal_id            uuid not null references meals(id) on delete cascade,
    name               text not null,
    estimated_quantity double precision,
    unit               text default 'g',
    confidence         double precision,
    user_corrected     boolean not null default false,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists ix_meal_items_meal_id on meal_items (meal_id);

create table if not exists nutrient_values (
    id             uuid primary key default gen_random_uuid(),
    meal_item_id   uuid not null references meal_items(id) on delete cascade,
    calories       double precision not null default 0,
    protein_g      double precision not null default 0,
    carbs_g        double precision not null default 0,
    fat_g          double precision not null default 0,
    fiber_g        double precision not null default 0,
    sugar_g        double precision not null default 0,
    sodium_mg      double precision not null default 0,
    potassium_mg   double precision not null default 0,
    calcium_mg     double precision not null default 0,
    iron_mg        double precision not null default 0,
    magnesium_mg   double precision not null default 0,
    vitamin_a_ug   double precision not null default 0,
    vitamin_c_mg   double precision not null default 0,
    vitamin_d_ug   double precision not null default 0,
    vitamin_b12_ug double precision not null default 0,
    folate_ug      double precision not null default 0,
    cholesterol_mg double precision not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists ix_nutrient_values_meal_item_id on nutrient_values (meal_item_id);

-- ---------------------------------------------------------------- training
create table if not exists workouts (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references users(id) on delete cascade,
    type             text not null default 'strength',
    title            text,
    started_at       timestamptz not null default now(),
    duration_min     integer,
    perceived_effort integer,
    notes            text,
    source           text not null default 'manual',
    external_id      text,
    dedup_key        text,
    confirmed        boolean not null default true,
    deleted_at       timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists ix_workouts_user_id on workouts (user_id);
create index if not exists ix_workouts_started_at on workouts (started_at);
create index if not exists ix_workouts_external_id on workouts (external_id);
create index if not exists ix_workouts_dedup_key on workouts (dedup_key);

create table if not exists exercises (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    category       text not null default 'strength',
    primary_muscle text,
    equipment      text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists ix_exercises_name on exercises (name);

create table if not exists workout_sets (
    id            uuid primary key default gen_random_uuid(),
    workout_id    uuid not null references workouts(id) on delete cascade,
    exercise_name text not null,
    set_number    integer not null default 1,
    reps          integer,
    load_kg       double precision,
    rpe           double precision,
    rest_sec      integer,
    tempo         text,
    is_pr         boolean not null default false,
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists ix_workout_sets_workout_id on workout_sets (workout_id);

create table if not exists runs (
    id               uuid primary key default gen_random_uuid(),
    workout_id       uuid references workouts(id) on delete set null,
    user_id          uuid not null references users(id) on delete cascade,
    started_at       timestamptz not null default now(),
    distance_km      double precision,
    duration_min     double precision,
    avg_pace_min_km  double precision,
    avg_hr           integer,
    elevation_m      double precision,
    cadence          integer,
    zone2_min        double precision,
    perceived_effort integer,
    source           text not null default 'manual',
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists ix_runs_user_id on runs (user_id);
create index if not exists ix_runs_started_at on runs (started_at);

-- ---------------------------------------------------------------- health / recovery signals
create table if not exists health_samples (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(id) on delete cascade,
    metric      text not null,
    value       double precision not null,
    unit        text,
    recorded_at timestamptz not null default now(),
    source      text not null default 'healthkit',
    source_name text,
    external_id text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists ix_health_samples_user_id on health_samples (user_id);
create index if not exists ix_health_samples_metric on health_samples (metric);
create index if not exists ix_health_samples_recorded_at on health_samples (recorded_at);
create index if not exists ix_health_samples_external_id on health_samples (external_id);

create table if not exists sleep_sessions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    date         date not null,
    duration_min double precision not null,
    quality      double precision,
    deep_min     double precision,
    rem_min      double precision,
    awake_min    double precision,
    start_at     timestamptz,
    end_at       timestamptz,
    source       text not null default 'healthkit',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_sleep_sessions_user_id on sleep_sessions (user_id);
create index if not exists ix_sleep_sessions_date on sleep_sessions (date);

create table if not exists readiness_scores (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references users(id) on delete cascade,
    date              date not null,
    score             integer,
    band              text not null default 'unknown',
    components        jsonb not null default '{}'::jsonb,
    weights           jsonb not null default '{}'::jsonb,
    explanation       jsonb not null default '[]'::jsonb,
    data_completeness double precision not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists ix_readiness_scores_user_id on readiness_scores (user_id);
create index if not exists ix_readiness_scores_date on readiness_scores (date);

create table if not exists calendar_events (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references users(id) on delete cascade,
    external_id         text,
    title               text not null,
    description         text,
    calendar_name       text,
    start_at            timestamptz not null,
    end_at              timestamptz,
    matched_type        text,
    imported_workout_id uuid references workouts(id) on delete set null,
    source              text not null default 'google_calendar',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists ix_calendar_events_user_id on calendar_events (user_id);
create index if not exists ix_calendar_events_external_id on calendar_events (external_id);
create index if not exists ix_calendar_events_start_at on calendar_events (start_at);

-- ---------------------------------------------------------------- morning routine
create table if not exists morning_routines (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references users(id) on delete cascade,
    date               date not null,
    progression_week   integer not null default 1,
    intensity_target   text not null default 'moderate',
    total_duration_min integer not null default 10,
    blocks             jsonb not null default '{}'::jsonb,
    completed          boolean not null default false,
    completed_at       timestamptz,
    source             text not null default 'engine',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists ix_morning_routines_user_id on morning_routines (user_id);
create index if not exists ix_morning_routines_date on morning_routines (date);

create table if not exists routine_exercises (
    id           uuid primary key default gen_random_uuid(),
    routine_id   uuid not null references morning_routines(id) on delete cascade,
    block        text not null default 'main',
    name         text not null,
    prescription text not null,
    substitution text,
    "order"      integer not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_routine_exercises_routine_id on routine_exercises (routine_id);

-- ---------------------------------------------------------------- recovery modalities
create table if not exists recovery_sessions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    modality     text not null default 'mobility',
    duration_min integer,
    performed_at timestamptz not null default now(),
    notes        text,
    source       text not null default 'manual',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_recovery_sessions_user_id on recovery_sessions (user_id);
create index if not exists ix_recovery_sessions_performed_at on recovery_sessions (performed_at);

create table if not exists sauna_sessions (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references users(id) on delete cascade,
    temperature_c       double precision,
    duration_min        integer,
    performed_at        timestamptz not null default now(),
    session_type        text not null default 'post_workout',
    subjective_response text,
    source              text not null default 'manual',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists ix_sauna_sessions_user_id on sauna_sessions (user_id);
create index if not exists ix_sauna_sessions_performed_at on sauna_sessions (performed_at);

create table if not exists cold_plunge_sessions (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references users(id) on delete cascade,
    temperature_c       double precision,
    duration_min        double precision,
    performed_at        timestamptz not null default now(),
    session_type        text not null default 'separate',
    subjective_response text,
    source              text not null default 'manual',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists ix_cold_plunge_sessions_user_id on cold_plunge_sessions (user_id);
create index if not exists ix_cold_plunge_sessions_performed_at on cold_plunge_sessions (performed_at);

-- ---------------------------------------------------------------- journal / labs
create table if not exists journal_entries (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references users(id) on delete cascade,
    date              date not null,
    mood              integer,
    energy            integer,
    stress            integer,
    soreness          integer,
    gratitude         text,
    daily_win         text,
    daily_challenge   text,
    notes             text,
    voice_transcribed boolean not null default false,
    source            text not null default 'manual',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists ix_journal_entries_user_id on journal_entries (user_id);
create index if not exists ix_journal_entries_date on journal_entries (date);

create table if not exists lab_results (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users(id) on delete cascade,
    panel           text,
    test_name       text not null,
    value           double precision not null,
    unit            text not null,
    reference_low   double precision,
    reference_high  double precision,
    flag            text,
    collected_on    date,
    laboratory      text,
    notes           text,
    source_document text,
    source          text not null default 'manual',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists ix_lab_results_user_id on lab_results (user_id);

-- Sensitive: least-privilege isolation; never emitted to logs.
create table if not exists medications (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    name       text not null,
    dose       text,
    schedule   text,
    sensitive  boolean not null default true,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists ix_medications_user_id on medications (user_id);

create table if not exists supplements (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    name       text not null,
    dose       text,
    schedule   text,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists ix_supplements_user_id on supplements (user_id);

-- ---------------------------------------------------------------- system
create table if not exists notification_preferences (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null unique references users(id) on delete cascade,
    morning_summary   boolean not null default true,
    workout_reminder  boolean not null default true,
    meal_reminder     boolean not null default true,
    protein_deficit   boolean not null default true,
    hydration_deficit boolean not null default true,
    bedtime           boolean not null default true,
    journal_reminder  boolean not null default true,
    recovery_warning  boolean not null default true,
    weekly_report     boolean not null default true,
    lab_followup      boolean not null default true,
    quiet_hours_start text not null default '21:30',
    quiet_hours_end   text not null default '05:00',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists ix_notification_preferences_user_id on notification_preferences (user_id);

create table if not exists integrations (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    provider     text not null,
    status       text not null default 'disconnected',
    connected    boolean not null default false,
    last_sync_at timestamptz,
    last_error   text,
    scopes       jsonb not null default '[]'::jsonb,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists ix_integrations_user_id on integrations (user_id);
create index if not exists ix_integrations_provider on integrations (provider);

create table if not exists sync_jobs (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references users(id) on delete cascade,
    provider         text not null,
    status           text not null default 'queued',
    started_at       timestamptz,
    finished_at      timestamptz,
    records_imported integer not null default 0,
    error            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists ix_sync_jobs_user_id on sync_jobs (user_id);

create table if not exists ai_analysis_records (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references users(id) on delete cascade,
    kind              text not null,
    provider          text not null,
    request_ref       text,
    output_confidence double precision,
    valid             boolean not null default true,
    latency_ms        integer,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists ix_ai_analysis_records_user_id on ai_analysis_records (user_id);

create table if not exists audit_logs (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid references users(id) on delete set null,
    action     text not null,
    resource   text,
    ip         text,
    meta       jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists ix_audit_logs_user_id on audit_logs (user_id);
create index if not exists ix_audit_logs_action on audit_logs (action);
