# Architecture

Arete is a FastAPI backend plus an Expo/React Native mobile client. The design
principle throughout is **deterministic engines first, AI second**: all numbers that matter
(readiness score, calorie/macro targets, morning routine) come from pure, unit-tested Python.
AI only augments copy and turns unstructured input (photos, text, voice) into a *validated,
editable estimate*. Everything runs mock-first so the full product works with no paid credentials.

---

## Components

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mobile app (apps/mobile) — Expo + expo-router + NativeWind          │
│  Tabs: Today · Nutrition · Training · Trends · Profile               │
│  Device bridges: HealthKit (react-native-health), Camera (expo-camera)│
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTPS, JSON, Bearer JWT   (EXPO_PUBLIC_API_URL)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI app (apps/api/app/main.py)                                  │
│  CORS · JSON · lifespan(create_db_and_tables)                        │
│                                                                       │
│  Routers (/api/*)                                                    │
│    auth · profile · dashboard · meals · workouts · integrations      │
│    readiness · routine · journal · recovery · labs · trends          │
│    notifications · account                                           │
│                                                                       │
│  ┌───────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Deterministic engines     │   │ AI providers (Protocols)      │  │
│  │  engines/readiness.py     │   │  Vision / Nutrition /         │  │
│  │  engines/nutrition.py     │   │  Coaching / Transcription     │  │
│  │  engines/morning_routine  │   │  factory → mock | real        │  │
│  │  engines/calendar_match   │   │  validation before storage    │  │
│  │  engines/dedup            │   └───────────────────────────────┘  │
│  └───────────────────────────┘                                       │
│                                                                       │
│  Services: mock_integrations (Health/Calendar), storage, security    │
│                                                                       │
│  Persistence: SQLModel  →  SQLite (demo)  |  Postgres/Supabase (prod)│
└─────────────────────────────────────────────────────────────────────┘
```

- **`app/main.py`** wires CORS, registers every router under `/api`, exposes `/api/health` and
  `/`, and on startup (`lifespan`) configures logging and creates tables.
- **`app/core/`** — `config.py` (settings + feature flags + safety guardrails), `branding.py`
  (single source of product name/disclaimer), `security.py` (password hashing + JWT), `logging.py`.
- **`app/engines/`** — pure functions with dataclass inputs/outputs and unit tests.
- **`app/ai/`** — provider Protocols (`base.py`), the env-driven `factory.py`, mock and real
  implementations (`providers/`), and `validation.py`.
- **`app/services/`** — mock Health/Calendar integration data, file storage, and other glue.
- **`app/models/__init__.py`** — all 30 SQLModel tables (see [DATABASE.md](./DATABASE.md)).

---

## Provider abstractions

Vendors are swapped behind `typing.Protocol` interfaces so callers never change. Defined in
`app/ai/base.py`:

| Protocol | Responsibility | Key methods |
|----------|----------------|-------------|
| `VisionProvider` | Food image → structured estimate | `analyze_food_image(image_bytes, hint)` |
| `NutritionProvider` | Free text / label → estimate | `parse_meal_text(text)`, `parse_nutrition_label(text)` |
| `CoachingProvider` | Context dict → concise, safe copy | `daily_summary(context)`, `weekly_summary(context)` |
| `TranscriptionProvider` | Audio → text | `transcribe(audio_bytes)` |

All vision/nutrition methods return a `FoodAnalysis` schema (`app/schemas/food.py`).

### Factory + mock/real

`app/ai/factory.py` selects an implementation from the `AI_PROVIDER` flag. Any value in
`{"openai", "anthropic", "real"}` returns the `Real*` provider; everything else returns the
`Mock*` provider. Selections are memoized with `lru_cache`.

```
AI_PROVIDER=mock       → MockVisionProvider, MockNutritionProvider, ...
AI_PROVIDER=openai     → RealVisionProvider, RealNutritionProvider, ...  (guarded stubs)
```

The real adapters live in `app/ai/providers/real.py` and are guarded behind env; wiring a real
key is a small, isolated change. Mock providers make the whole app run with no paid API.

### Validation before storage

AI output is never trusted raw. `app/ai/validation.py` validates and bounds each estimate
before it is persisted, and every AI call is recorded in the `ai_analysis_records` table
(`kind`, `provider`, `output_confidence`, `valid`, `latency_ms`, and a non-PII `request_ref`).
Estimates are surfaced to the user with a confidence value and are **editable** before save.

---

## Deterministic engines vs. AI

| Concern | Owner | Why |
|---------|-------|-----|
| Readiness score | `engines/readiness.py` | Explainable, testable, honest about missing data |
| Calorie/macro targets | `engines/nutrition.py` | Safety bounds must be enforced deterministically |
| Weekly target adjustment | `engines/nutrition.py` | Gradual, bounded changes |
| Morning routine | `engines/morning_routine.py` | Injury/equipment rules, progression, deload |
| Calendar → workout typing | `engines/calendar_match.py` | Rule-based matching |
| Health/Calendar dedup | `engines/dedup.py` | Deterministic `dedup_key` |
| Copy / summaries | AI (Coaching) | Language only — never sets numbers |
| Photo/text/voice parsing | AI (Vision/Nutrition/Transcription) | Produces an *editable estimate* |

**AI never sets a target or a score.** This is a deliberate safety and explainability decision
(see `DECISIONS.md`).

### Readiness formula

```
score = 100 × Σ(weightᵢ × componentᵢ) / Σ(weight of available components)
```

Each component is normalized to `[0, 1]` (higher = more ready). Default weights
(`engines/readiness.py`): `sleep_duration 0.25`, `sleep_consistency 0.10`, `hrv 0.25`,
`resting_hr 0.15`, `training_load 0.10`, `soreness 0.05`, `mood 0.03`, `energy 0.04`,
`illness 0.03`. Bands: **green ≥ 70**, **yellow 50–69**, **red < 50**. If
`data_completeness < 0.4`, the engine returns `score=None` / `band="unknown"` rather than a
falsely precise number.

### Nutrition engine

Mifflin–St Jeor BMR → TDEE (`BMR × activity factor` + measured active energy added on top;
baseline factors: beginner 1.25 / intermediate 1.35 / advanced 1.45) → goal-based calorie delta.
Safety guardrails (from `app/core/config.py`): calorie floors (male 1500 / female 1200), daily
deficit capped at 750 kcal, and weekly target changes capped at ±150 kcal. On a hard training
day any deficit is halved to protect recovery.

---

## Feature flags

Set in `.env`, read via `app/core/config.py`, and echoed by `/api/health`:

| Flag | Default | Effect |
|------|---------|--------|
| `AI_PROVIDER` | `mock` | Selects mock vs. real AI providers |
| `HEALTH_PROVIDER` | `mock` | Server-side mock Health data vs. device HealthKit bridge |
| `CALENDAR_PROVIDER` | `mock` | Mock calendar events vs. real Google Calendar |
| `AUTH_PROVIDER` | `local` | Local JWT vs. Supabase auth seam |

---

## Integrations (Health & Calendar)

Two-sided by design:

- **Server side** — `app/services/mock_integrations.py` generates realistic Health samples,
  sleep sessions, and calendar events, so `POST /api/integrations/apple_health/sync` and
  `POST /api/integrations/google_calendar/import` work in CI/local with no Apple/Google
  credentials.
- **Device side (mobile)** — HealthKit via `react-native-health` (requires an Expo Dev Client
  build) reads on-device metrics and posts them to the same sync endpoint.

Imports are **deduplicated**: `engines/dedup.py` derives a `dedup_key` (per user, time, type)
so a workout imported from Calendar isn't double-counted against a HealthKit import.
`Integration` and `SyncJob` rows track connection status and sync history.

---

## Request lifecycle (example: log a meal by photo)

1. Mobile captures a photo (`expo-camera`) and calls `POST /api/meals/analyze` with the JWT.
2. `get_current_user` validates the Bearer token; the request is scoped to that `user_id`.
3. The `VisionProvider` (mock or real) returns a `FoodAnalysis` estimate; `validation.py`
   bounds it; an `ai_analysis_records` row is written.
4. The estimate (items + nutrients + confidence + assumptions) is returned to the client and
   shown as **editable**.
5. The user edits and calls `POST /api/meals`; the meal, its items, and nutrient values are
   persisted (`meals` → `meal_items` → `nutrient_values`, plus an optional `food_images` row).
6. `GET /api/meals/totals` and `GET /api/dashboard/today` reflect the new totals against the
   day's `nutrition_targets`.

---

## Why these decisions

- **SQLite for demo, Postgres/Supabase for prod** — zero-credential local run; the same SQLModel
  models compile to Postgres. `DATABASE_URL` swaps them.
- **Local JWT auth with a Supabase seam** — the demo must work offline; `User.external_auth_id`
  is the seam for a Supabase UID.
- **Provider Protocols + mock-first** — swappable vendors and a fully working offline demo.
- **Deterministic engines** — explainability, testability, and enforceable safety.
- **Mock Health/Calendar + device bridges** — the whole flow works in CI/local; real device sync
  is an additive, flag-gated path.

See `DECISIONS.md` for the full log. Related: [API.md](./API.md), [DATABASE.md](./DATABASE.md),
[SECURITY.md](./SECURITY.md).
