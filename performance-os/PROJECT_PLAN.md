# Performance OS — Project Plan

Personal health & performance operating system. iOS-first (Expo/React Native) +
Python/FastAPI backend. Mock-first so the full demo runs with **zero paid credentials**.

> Working name: **Performance OS**. Branding is centralized in `packages/shared/branding.ts`
> and `apps/api/app/core/branding.py` so it can be renamed in one place later.

## Architecture (chosen, simplest production-capable)

```
performance-os/
├── apps/
│   ├── api/            FastAPI + SQLModel. SQLite for local demo, Postgres/Supabase-ready.
│   └── mobile/         Expo + TypeScript + expo-router + NativeWind.
├── packages/
│   ├── shared/         Cross-platform TS types + branding + API client contract.
│   └── ui/             Reusable RN UI primitives (Card, Ring, Stat, etc.).
├── docs/               Architecture, setup, security, roadmap, build/TestFlight guides.
├── scripts/            dev bootstrap + seed helpers.
├── supabase/           schema.sql, RLS policies, migration notes.
└── tests/              Cross-cutting test notes (unit/API tests live beside code).
```

### Key decisions (see DECISIONS.md)
- **DB for demo:** SQLite via SQLModel; `DATABASE_URL` swaps to Postgres/Supabase. Alembic wired.
- **Auth:** local JWT (email+password) with a `SupabaseAuthProvider` seam. Demo user auto-seeded.
- **AI:** provider interfaces (Vision/Nutrition/Coaching/Transcription) + Mock impls + factory.
  `AI_PROVIDER=mock` by default; real adapters are stubs guarded behind env.
- **Integrations:** Apple Health + Google Calendar are mock providers server-side + a device
  bridge on mobile; feature flags switch mock↔real.

## Phased build

- [x] P0  Inspect repo/tools; scaffold monorepo; plan + status docs.
- [x] P1  Backend core: config, DB, all SQLModel tables, session, migrations.
- [x] P2  AI provider abstractions + mock providers + factory + strict schemas + validation.
- [x] P3  Domain engines: nutrition targets, readiness score, morning-routine generator,
          calendar matching, workout dedup.
- [x] P4  Auth + onboarding/profile endpoints.
- [x] P5  Today dashboard endpoint (aggregate).
- [x] P6  Meals: photo upload → mock vision → editable nutrition → save → totals.
- [x] P7  Workouts + runs + weekly summary.
- [x] P8  Calendar mock import + Health mock import + dedup.
- [x] P9  Readiness, morning routine, journal, sauna/cold-plunge, labs, trends, notifications.
- [x] P10 Seed realistic demo data; run API; OpenAPI docs.
- [x] P11 Tests (readiness, nutrition, dedup, calendar, routine, AI-validation, API) — pass.
- [x] P12 Mobile app: expo-router shell, 5 tabs, API client, core screens, component tests.
- [x] P13 Docs: architecture, setup, security, TestFlight, App Store checklist, roadmap.

## First working release (priority flow)
sign in → onboarding → demo Health+Calendar → readiness → meal photo (mock) → save →
macros update → workout import/create → morning routine → sauna/plunge → journal → trends.
