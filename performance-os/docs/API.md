# API Reference

FastAPI backend. **All routes are served under the `/api` prefix.** Interactive, always-current
OpenAPI docs are at **<http://localhost:8000/docs>** (and the raw schema at `/openapi.json`)
while the server runs — treat that as the source of truth for request/response bodies; this page
is a durable map of the surface.

- **Base URL (local):** `http://localhost:8000`
- **Auth:** JSON Web Token (JWT) as `Authorization: Bearer <token>`. Obtain one from
  `POST /api/auth/login` or `POST /api/auth/register`.
- **Auth column below:** ✅ = requires a valid Bearer token; ⬜ = public.

Get a token:

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@arete.app","password":"performance123"}'
```

---

## System

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | Service info (name, docs, health links) | ⬜ |
| GET | `/api/health` | Status + active provider feature flags | ⬜ |

## Auth (`/api/auth`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/auth/register` | Create an account, returns a token | ⬜ |
| POST | `/api/auth/login` | Email + password → token | ⬜ |
| GET | `/api/auth/me` | Current user identity | ✅ |

## Profile & onboarding (`/api/profile`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/profile/onboarding` | Submit onboarding (profile, goals, consent) | ✅ |
| GET | `/api/profile` | Get the current profile | ✅ |
| PATCH | `/api/profile` | Update profile fields | ✅ |

## Dashboard (`/api/dashboard`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/dashboard/today` | Aggregate Today view (readiness, nutrition, training, routine, recovery). Optional `?on=YYYY-MM-DD` | ✅ |

## Meals & nutrition (`/api/meals`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/meals/analyze` | Analyze a food photo → editable `FoodAnalysis` estimate | ✅ |
| POST | `/api/meals/parse-text` | Parse a free-text meal → `FoodAnalysis` estimate | ✅ |
| POST | `/api/meals` | Save a (edited) meal with items + nutrients | ✅ |
| GET | `/api/meals` | List meals. Optional `?on=YYYY-MM-DD` | ✅ |
| GET | `/api/meals/totals` | Daily nutrition totals vs. targets. Optional `?on=YYYY-MM-DD` | ✅ |
| POST | `/api/meals/{meal_id}/favorite` | Toggle a meal as a saved favorite | ✅ |
| POST | `/api/meals/{meal_id}/copy` | Duplicate a saved/favorite meal to today | ✅ |
| DELETE | `/api/meals/{meal_id}` | Soft-delete a meal | ✅ |

## Workouts & runs (`/api/workouts`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/workouts` | Create a workout (with sets/run detail) | ✅ |
| GET | `/api/workouts` | List workouts | ✅ |
| POST | `/api/workouts/{workout_id}/confirm` | Confirm an imported/unconfirmed workout | ✅ |
| DELETE | `/api/workouts/{workout_id}` | Soft-delete a workout | ✅ |
| GET | `/api/workouts/weekly-summary` | Weekly training summary | ✅ |

## Integrations (`/api/integrations`)

Apple Health and Google Calendar are mock providers server-side by default (see
[ARCHITECTURE.md](./ARCHITECTURE.md)).

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/integrations/status` | Connection status for all providers | ✅ |
| POST | `/api/integrations/{provider}/connect` | Connect a provider | ✅ |
| POST | `/api/integrations/{provider}/revoke` | Revoke/disconnect a provider | ✅ |
| POST | `/api/integrations/apple_health/sync` | Import Health samples + sleep (deduped) | ✅ |
| POST | `/api/integrations/google_calendar/import` | Import calendar events → matched workouts | ✅ |

## Readiness (`/api/readiness`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/readiness` | Today's readiness score, band, components, weights, explanation. Optional `?on=YYYY-MM-DD` | ✅ |
| GET | `/api/readiness/history` | Recent scores. Optional `?days=N` (default 14) | ✅ |

## Morning routine (`/api/routine`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/routine/today` | Generated 10-minute routine for the day. Optional `?on=YYYY-MM-DD` | ✅ |
| POST | `/api/routine/{routine_id}/complete` | Mark a routine complete | ✅ |

## Journal (`/api/journal`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/journal` | Upsert today's journal (mood/energy/stress/soreness + text) | ✅ |
| POST | `/api/journal/voice` | Upload a voice entry → transcribed journal | ✅ |
| GET | `/api/journal` | List entries. Optional `?days=N` (default 14) | ✅ |
| GET | `/api/journal/weekly-summary` | Weekly journal summary | ✅ |

## Recovery (`/api/recovery`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/recovery/sauna` | Log a sauna session | ✅ |
| POST | `/api/recovery/cold-plunge` | Log a cold-plunge session | ✅ |
| POST | `/api/recovery/session` | Log a mobility/breathwork/other recovery session | ✅ |
| GET | `/api/recovery/recommendations` | Recovery recommendations | ✅ |

## Labs (`/api/labs`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/labs/panels` | Known panels + educational context | ⬜ |
| POST | `/api/labs` | Add a lab result (value, unit, reference range) | ✅ |
| GET | `/api/labs` | List lab results | ✅ |

## Trends (`/api/trends`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/trends/series` | Time series for a metric. Required `?metric=` (`hrv`, `resting_hr`, `vo2max`, `steps`, `active_energy`, `respiratory_rate`, `sleep`, `readiness`, ...); optional `?days=N` (default 30) | ✅ |
| GET | `/api/trends/weekly-report` | Cross-domain weekly report | ✅ |

## Notifications (`/api/notifications`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/notifications` | Get notification preferences | ✅ |
| PATCH | `/api/notifications` | Update notification preferences | ✅ |

## Account (`/api/account`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/account/export` | Export all of the user's data | ✅ |
| DELETE | `/api/account/images/{image_id}` | Delete a stored food image | ✅ |
| DELETE | `/api/account` | Delete the account and its data | ✅ |

---

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md),
[SECURITY.md](./SECURITY.md).
