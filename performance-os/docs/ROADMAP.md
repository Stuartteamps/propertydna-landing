# Roadmap

Where Arete is today and what comes next. The MVP is deliberately **mock-first and
deterministic-first**: everything works end-to-end with no paid credentials, and the seams for
real integrations are already in place behind feature flags and provider interfaces.

---

## Now — MVP (shipped)

Backend (FastAPI + SQLModel, 30 tables) and the mobile shell (Expo, 5 tabs) with the full flow
working in mock mode:

- **Auth & onboarding** — local JWT, profile + goals + consent.
- **Today dashboard** — aggregate readiness / nutrition / training / routine / recovery.
- **Readiness engine** — weighted, normalized, explainable; `unknown` below 40% data completeness.
- **Nutrition engine** — Mifflin–St Jeor BMR → TDEE → goal delta, with calorie floors, capped
  deficits, and gradual weekly adjustment.
- **Meals** — photo (mock vision), text, and label/barcode source types → editable estimate →
  save → daily totals vs. targets.
- **Training** — workouts + runs + sets, weekly summary.
- **Morning routine engine** — 10-minute generator with injury/equipment rules, weekly
  progression, and 4-week deload.
- **Recovery** — sauna, cold plunge, mobility/breathwork + recommendations.
- **Journal** — daily check-in + voice entry (mock transcription).
- **Labs** — results with reference ranges + educational context (no diagnosis).
- **Trends** — metric time series + weekly report.
- **Integrations** — Apple Health + Google Calendar as **mock** providers server-side, with
  dedup between imports.
- **Account** — data export, image deletion, account deletion.
- **Provider abstractions** — Vision/Nutrition/Coaching/Transcription behind Protocols + factory,
  with validation before storage.
- **Safety** — no diagnosis/prescription; AI outputs are labeled estimates; medications isolated
  and never logged.
- **Tests** — readiness, nutrition, dedup, calendar, routine, AI-validation, and API tests pass.

---

## Phase 1 — Real AI providers

- Wire `RealVisionProvider` / `RealNutritionProvider` / `RealCoachingProvider` /
  `RealTranscriptionProvider` (`app/ai/providers/real.py`) to a real vendor via
  `AI_PROVIDER=openai|anthropic` + `AI_PROVIDER_API_KEY`.
- Keep `validation.py` as the trust boundary; expand bounds/tests for real output.
- Cost/latency controls and caching for vision calls.

## Phase 2 — Real device & data integrations

- **Apple HealthKit** — device bridge via `react-native-health` in an Expo Dev Client, pushing
  real samples to `POST /api/integrations/apple_health/sync` (`HEALTH_PROVIDER=healthkit`).
- **Google Calendar** — real OAuth (`CALENDAR_PROVIDER=google`, `GOOGLE_*` env) feeding
  `POST /api/integrations/google_calendar/import`.
- **Strava / Garmin** — additional workout/run sources with the existing `dedup_key` pipeline.
- **CGM** (e.g. via provider APIs) — glucose as a first-class `health_samples` metric.
- **Labs** — automated import (PDF/portal parsing) into `lab_results` beyond manual entry.
- **Barcode / nutrition-label** scanning wired to a food database for the `barcode`/`label` meal
  sources.

## Phase 3 — Platform hardening & background work

- **Background jobs / scheduler** — nightly readiness computation, morning-summary generation,
  and automated **weekly target adjustment** (the `weekly_adjustment` engine exists; automate its
  application). `sync_jobs` already models job state.
- **Push notifications** — deliver the preferences already modeled in
  `notification_preferences` (morning summary, hydration/protein deficits, bedtime, etc.).
- **Move rate limiting** to a shared store (Redis) for multi-worker deployments.
- **Supabase auth** — flip `AUTH_PROVIDER=supabase` using the `external_auth_id` seam; apply
  `supabase/rls.sql` in production.

## Phase 4 — New surfaces & experiences

- **Apple Watch** app / complications for readiness and quick logging.
- Richer **trends** and correlations (readiness vs. sleep/training-load over time).
- **Coaching** improvements (weekly narrative, adherence nudges) — still copy-only, never setting
  numbers.

## Phase 5 — Compliance & scale

- **HIPAA hardening** — formal controls (BAAs, encryption at rest, access reviews, verified audit
  trails, retention policies). Today the system is HIPAA-*conscious* but **not compliant**
  (see [SECURITY.md](./SECURITY.md)).
- Production observability, backups, and incident response.
- Multi-region / performance work as usage grows.

---

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md),
[../KNOWN_ISSUES.md](../KNOWN_ISSUES.md).
