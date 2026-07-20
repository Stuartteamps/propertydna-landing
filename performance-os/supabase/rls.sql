-- ============================================================================
-- Arete — Row Level Security (RLS) policies
--
-- Apply AFTER schema.sql. Enables RLS on every user-owned table so a row is
-- visible/writable only when it belongs to the authenticated caller.
--
-- auth.uid() mapping
-- ------------------
-- In Supabase, auth.uid() returns the JWT subject (the authenticated user's id)
-- as a uuid. Our application users live in public.users. The intended mapping is
-- users.id == auth.uid() (or, when using the SupabaseAuthProvider seam,
-- users.external_auth_id == auth.uid()::text — swap the comparisons below to that
-- column if you adopt that seam).
--
-- Our SQLModel PKs are TEXT UUIDs at the ORM layer; in this Postgres schema they
-- are native uuid. To stay correct regardless of column type, every comparison
-- casts both sides to text: (user_id::text = auth.uid()::text).
--
-- Child tables (meal_items, nutrient_values, workout_sets, routine_exercises)
-- have no user_id and are scoped through their parent via an EXISTS check.
--
-- These policies target the `authenticated` role. The API's service-role key
-- (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS by design for trusted server work.
-- ============================================================================

-- ---------------------------------------------------------------- users (self row)
alter table users enable row level security;
create policy users_self on users
    for all to authenticated
    using (id::text = auth.uid()::text)
    with check (id::text = auth.uid()::text);

-- ---------------------------------------------------------------- helper macro (per-table, user_id owned)
-- Pattern repeated for each user-owned table:
--   alter table <t> enable row level security;
--   create policy <t>_owner on <t> for all to authenticated
--       using (user_id::text = auth.uid()::text)
--       with check (user_id::text = auth.uid()::text);

alter table profiles enable row level security;
create policy profiles_owner on profiles for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table goals enable row level security;
create policy goals_owner on goals for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table nutrition_targets enable row level security;
create policy nutrition_targets_owner on nutrition_targets for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table food_images enable row level security;
create policy food_images_owner on food_images for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table meals enable row level security;
create policy meals_owner on meals for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table workouts enable row level security;
create policy workouts_owner on workouts for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table runs enable row level security;
create policy runs_owner on runs for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table health_samples enable row level security;
create policy health_samples_owner on health_samples for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table sleep_sessions enable row level security;
create policy sleep_sessions_owner on sleep_sessions for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table readiness_scores enable row level security;
create policy readiness_scores_owner on readiness_scores for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table calendar_events enable row level security;
create policy calendar_events_owner on calendar_events for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table morning_routines enable row level security;
create policy morning_routines_owner on morning_routines for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table recovery_sessions enable row level security;
create policy recovery_sessions_owner on recovery_sessions for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table sauna_sessions enable row level security;
create policy sauna_sessions_owner on sauna_sessions for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table cold_plunge_sessions enable row level security;
create policy cold_plunge_sessions_owner on cold_plunge_sessions for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table journal_entries enable row level security;
create policy journal_entries_owner on journal_entries for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table lab_results enable row level security;
create policy lab_results_owner on lab_results for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table medications enable row level security;
create policy medications_owner on medications for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table supplements enable row level security;
create policy supplements_owner on supplements for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table notification_preferences enable row level security;
create policy notification_preferences_owner on notification_preferences for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table integrations enable row level security;
create policy integrations_owner on integrations for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table sync_jobs enable row level security;
create policy sync_jobs_owner on sync_jobs for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

alter table ai_analysis_records enable row level security;
create policy ai_analysis_records_owner on ai_analysis_records for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

-- audit_logs: user_id is nullable (system events). Callers may read only their
-- own rows; inserts are expected via the service role (which bypasses RLS).
alter table audit_logs enable row level security;
create policy audit_logs_read_own on audit_logs for select to authenticated
    using (user_id is not null and user_id::text = auth.uid()::text);

-- ---------------------------------------------------------------- child tables (scoped via parent)
alter table meal_items enable row level security;
create policy meal_items_via_parent on meal_items for all to authenticated
    using (exists (
        select 1 from meals m
        where m.id = meal_items.meal_id
          and m.user_id::text = auth.uid()::text))
    with check (exists (
        select 1 from meals m
        where m.id = meal_items.meal_id
          and m.user_id::text = auth.uid()::text));

alter table nutrient_values enable row level security;
create policy nutrient_values_via_parent on nutrient_values for all to authenticated
    using (exists (
        select 1 from meal_items mi
        join meals m on m.id = mi.meal_id
        where mi.id = nutrient_values.meal_item_id
          and m.user_id::text = auth.uid()::text))
    with check (exists (
        select 1 from meal_items mi
        join meals m on m.id = mi.meal_id
        where mi.id = nutrient_values.meal_item_id
          and m.user_id::text = auth.uid()::text));

alter table workout_sets enable row level security;
create policy workout_sets_via_parent on workout_sets for all to authenticated
    using (exists (
        select 1 from workouts w
        where w.id = workout_sets.workout_id
          and w.user_id::text = auth.uid()::text))
    with check (exists (
        select 1 from workouts w
        where w.id = workout_sets.workout_id
          and w.user_id::text = auth.uid()::text));

alter table routine_exercises enable row level security;
create policy routine_exercises_via_parent on routine_exercises for all to authenticated
    using (exists (
        select 1 from morning_routines r
        where r.id = routine_exercises.routine_id
          and r.user_id::text = auth.uid()::text))
    with check (exists (
        select 1 from morning_routines r
        where r.id = routine_exercises.routine_id
          and r.user_id::text = auth.uid()::text));

-- ---------------------------------------------------------------- shared reference data
-- exercises is a global catalog (no user_id). Enable RLS and allow all
-- authenticated users to read; writes are reserved for the service role.
alter table exercises enable row level security;
create policy exercises_read_all on exercises for select to authenticated
    using (true);
