# Performance OS

> Your personal health & performance operating system.

Performance OS is an iOS-first personal health and performance app: a single place to
track training, nutrition, recovery, sleep, readiness, labs, and a daily journal — with
deterministic, explainable engines doing the math and AI only augmenting the copy. It is
**mock-first**, so the entire product runs end-to-end with **zero paid credentials**.

- **Backend:** Python 3.11 + FastAPI + SQLModel. SQLite for the local demo, Postgres/Supabase-ready.
- **Mobile:** Expo + TypeScript + expo-router + NativeWind (5 tabs: Today, Nutrition, Training, Trends, Profile).
- **Providers:** AI (Vision/Nutrition/Coaching/Transcription), Apple Health, and Google Calendar
  all default to mock implementations behind feature flags.

> **Working name.** "Performance OS" is a placeholder. Rebrand in one place via
> `apps/api/app/core/branding.py` (server) and `packages/shared/branding.ts` (client).

---

## What it does

- **Today dashboard** — a single aggregate view of readiness, nutrition progress, the day's
  training, morning routine, and recovery.
- **Readiness** — a weighted, normalized, explainable score from sleep, HRV, resting HR,
  training load, soreness, mood, energy, and illness. Honest about missing data (returns
  `unknown` below 40% completeness).
- **Nutrition** — deterministic calorie/macro targets (Mifflin–St Jeor BMR, activity factor,
  goal delta) with hard safety bounds; log meals by photo (mock vision), text, or barcode/label,
  edit the estimate, and save.
- **Training** — log/create workouts and runs, import from Calendar (mock), dedup against Health
  imports, and get a weekly training summary.
- **Morning routine** — a deterministic 10-minute routine generator that complements the day's
  main workout, scales with readiness/soreness, respects injuries/equipment, progresses weekly,
  and deloads every 4th week.
- **Recovery** — log sauna, cold plunge, and mobility/breathwork sessions; get recommendations.
- **Journal** — daily mood/energy/stress/soreness plus free text and voice entries (mock
  transcription).
- **Labs** — record lab results with reference ranges and educational context (no diagnosis).
- **Trends** — time series and a weekly report across health, sleep, readiness, and nutrition.
- **Integrations** — connect/revoke Apple Health and Google Calendar; sync/import (mock providers
  server-side, device bridge on mobile).
- **Account** — data export, image deletion, and full account deletion.

---

## Monorepo layout

```
performance-os/
├── apps/
│   ├── api/            FastAPI + SQLModel backend (this is what runs the demo)
│   └── mobile/         Expo + TypeScript + expo-router + NativeWind app
├── packages/
│   ├── shared/         Cross-platform TS types + branding + API client contract
│   └── ui/             Reusable React Native UI primitives
├── docs/               Architecture, API, database, security, build, roadmap
├── scripts/            Dev bootstrap + seed helpers
├── supabase/           schema.sql, rls.sql, and how to apply them
└── tests/              Cross-cutting test notes (unit/API tests live beside code)
```

---

## Quickstart

Prerequisites and full copy-paste instructions are in **[SETUP.md](./SETUP.md)**. The short version:

### Backend (required for the demo)

```bash
cd apps/api
python3.11 -m venv .venv
source .venv/bin/activate
uv pip install -e ".[dev]"
cp ../../.env.example ../../.env      # defaults run fully mocked
python -m app.seed                    # creates the demo user + realistic data
python -m uvicorn app.main:app --reload --port 8000
```

- Interactive OpenAPI docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/health>
- All API routes are served under the `/api` prefix.

### Mobile

```bash
cd apps/mobile
npm install
# point the app at your running backend
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" >> .env
npx expo start
```

HealthKit and the camera require an **Expo Dev Client** build (not Expo Go). See
**[docs/MOBILE_BUILD.md](./docs/MOBILE_BUILD.md)**.

### Demo credentials

| Field    | Value                      |
|----------|----------------------------|
| Email    | `demo@performanceos.app`   |
| Password | `performance123`           |

---

## Feature flags (mock vs. real)

Set in `.env`. All default to mock so nothing paid is required.

| Flag               | Default | Options                    |
|--------------------|---------|----------------------------|
| `AI_PROVIDER`      | `mock`  | `mock` `openai` `anthropic`|
| `HEALTH_PROVIDER`  | `mock`  | `mock` `healthkit`         |
| `CALENDAR_PROVIDER`| `mock`  | `mock` `google`            |
| `AUTH_PROVIDER`    | `local` | `local` `supabase`         |

---

## Safety & medical disclaimer

Performance OS is for **education, wellness, and fitness tracking only**. It does **not**
diagnose, treat, or prescribe, and is not a substitute for professional medical advice.
AI-generated nutrition and readiness figures are **estimates**, always shown with a confidence
value and editable before they are stored. Deterministic engines enforce hard safety bounds
(calorie floors, capped deficits, gradual weekly changes). Medications are stored in a dedicated
sensitive table and are never written to logs. **Consult a licensed clinician for medical
decisions.**

Performance OS is **not HIPAA compliant**. The architecture is HIPAA-*conscious* — see
**[docs/SECURITY.md](./docs/SECURITY.md)**.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [SETUP.md](./SETUP.md) | Clean-checkout setup for backend + mobile |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, providers, engines, data flow |
| [docs/API.md](./docs/API.md) | Endpoint reference (grouped by area) |
| [docs/DATABASE.md](./docs/DATABASE.md) | The 30-table data model |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security & privacy posture |
| [docs/MOBILE_BUILD.md](./docs/MOBILE_BUILD.md) | Expo dev build + HealthKit |
| [docs/TESTFLIGHT.md](./docs/TESTFLIGHT.md) | Shipping to TestFlight via EAS |
| [docs/APP_STORE_CHECKLIST.md](./docs/APP_STORE_CHECKLIST.md) | App Store submission checklist |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | MVP scope and phased future work |
| [supabase/README.md](./supabase/README.md) | Applying the Postgres schema + RLS |

Project-history docs also live at the repo root: `PROJECT_PLAN.md`, `DECISIONS.md`,
`IMPLEMENTATION_STATUS.md`, and `KNOWN_ISSUES.md`.
