# Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Build under `performance-os/` inside the existing repo | Task requires this repo + branch `claude/performance-os-mvp-2ii9qq`; the repo already hosts an unrelated PropertyDNA project which must not be deleted. Isolating in a subdir keeps both intact. |
| 2 | SQLModel + SQLite for local demo, `DATABASE_URL` swaps to Postgres/Supabase | Zero-credential local run (mock-first requirement). Same models compile to Postgres. |
| 3 | Python 3.11 target (env has 3.11.15, not 3.12) | Only tool available; all deps (FastAPI/SQLModel/Pydantic v2) support 3.11. Code stays 3.12-compatible. |
| 4 | Local JWT auth with a `SupabaseAuthProvider` seam | Demo must work offline; Supabase becomes a drop-in via env. |
| 5 | AI provider interfaces + Mock implementations, `AI_PROVIDER` flag | Required "mock-first" + swappable-vendor requirement. |
| 6 | Deterministic engines (nutrition, readiness, morning routine) live in pure Python modules with unit tests; AI only *augments* copy | Explainability, testability, safety. AI never sets targets or scores. |
| 7 | Server-side Health/Calendar **mock providers** + on-device bridges on mobile | Lets the whole flow work in CI/local with no Apple/Google credentials. |
| 8 | Expo Dev Client (not Expo Go) assumed for HealthKit | `react-native-health` needs native modules; documented in docs/MOBILE_BUILD.md. |
| 9 | uv for Python venv/deps | Fast, available in env. |
| 10 | Readiness uses weighted, normalized components with a documented formula and a `data_completeness` gate | Avoids falsely precise scores; explainable. |

## Safety stance
- No diagnosis, prescription, or medication changes anywhere in code or copy.
- AI nutrition/vision output is always labeled *estimate* with confidence + editable.
- Calorie floors enforced (never recommend below a safe floor); no extreme dehydration/overtraining advice.
- Medications stored in a dedicated table flagged sensitive; never emitted to logs.
