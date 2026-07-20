# Setup

Copy-pasteable setup for Performance OS from a clean checkout. Two parts: the **backend**
(required for everything) and the **mobile app** (needs a Mac + Xcode for iOS builds).

The defaults are **mock-first**: the whole product runs with no paid credentials.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | **3.11** | Targeted runtime (`requires-python = ">=3.11"`). |
| uv | latest | Python package manager. Install: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | **22 LTS** | For the Expo mobile app. |
| npm | 10+ | Ships with Node 22. |
| Xcode | 15+ | macOS only; required for iOS simulator / device builds. |
| Expo CLI / EAS | via `npx` | No global install needed; use `npx expo` / `npx eas`. |

Optional: a Postgres/Supabase database if you want to run against Postgres instead of SQLite.

---

## 1. Backend (`apps/api`)

### 1.1 Create the environment file

From the repo root (`performance-os/`):

```bash
cp .env.example .env
```

The defaults run everything mocked. For production, at minimum regenerate `SECRET_KEY`:

```bash
# put the output in .env as SECRET_KEY=...
openssl rand -hex 32
```

> The API reads `.env` from `apps/api/.env` **or** the repo-root `.env` (see
> `apps/api/app/core/config.py`). Copying to the repo root as above works for both.

### 1.2 Create the venv and install

```bash
cd apps/api
python3.11 -m venv .venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### 1.3 Seed realistic demo data

```bash
python -m app.seed
```

This is idempotent (re-running reuses the demo user) and produces a fully populated Today
dashboard: 14 days of Health samples + sleep, a training week imported from Calendar, meals,
journal, recovery sessions, supplements, and labs.

Demo credentials:

- Email: `demo@performanceos.app`
- Password: `performance123`

### 1.4 Run the API

```bash
python -m uvicorn app.main:app --reload --port 8000
```

- Interactive OpenAPI docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/health>
- All routes are under `/api`.

Quick smoke test:

```bash
curl -s http://localhost:8000/api/health | python -m json.tool

curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@performanceos.app","password":"performance123"}'
```

### 1.5 Tests & lint

```bash
python -m pytest          # readiness, nutrition, dedup, calendar, routine, AI-validation, API
ruff check app tests      # lint
```

### 1.6 Database: SQLite (default) vs. Postgres/Supabase

- **Local demo** uses SQLite. On startup the app calls `create_all()` (see `app/main.py`
  lifespan), so no migration step is needed.
- **Postgres/Supabase**: set `DATABASE_URL` in `.env`, e.g.

  ```
  DATABASE_URL=postgresql+psycopg://user:pass@host:5432/postgres
  ```

  Alembic is wired for schema migrations:

  ```bash
  alembic upgrade head
  ```

  To apply the standalone Postgres schema + Row Level Security to a Supabase project, see
  [supabase/README.md](./supabase/README.md).

---

## 2. Mobile app (`apps/mobile`)

### 2.1 Install

```bash
cd apps/mobile
npm install
```

### 2.2 Point the app at the backend

The app reads `EXPO_PUBLIC_API_URL`.

```bash
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" >> .env
```

- iOS **simulator** can use `http://localhost:8000`.
- A **physical device** must use your machine's LAN IP, e.g. `http://192.168.1.50:8000`
  (the device and the backend must be on the same network).

### 2.3 Run

```bash
npx expo start
```

For **HealthKit** and **camera** you need an **Expo Dev Client** build (not Expo Go), because
`react-native-health` and native camera modules aren't in the Expo Go runtime. Full instructions
are in [docs/MOBILE_BUILD.md](./docs/MOBILE_BUILD.md).

> The mobile app cannot be launched in a headless CI container (no iOS simulator). It typechecks
> and runs Jest component tests there; run it on a Mac/simulator.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ModuleNotFoundError: app...` | Run backend commands from `apps/api` with the venv active (`source .venv/bin/activate`). |
| `uv: command not found` | Install uv (see Prerequisites), then re-open the shell. |
| Wrong Python picked up | Recreate the venv with `python3.11 -m venv .venv`. |
| Login 401 | Run `python -m app.seed` first; verify email/password exactly. |
| Mobile can't reach API | Use your LAN IP (not `localhost`) on a physical device; confirm the backend is running and both are on the same Wi-Fi. |
| CORS errors in a browser | The API allows all origins in dev (`app/main.py`); tighten per-environment in production. |
| SQLite locked / stale data | Stop the server, delete `apps/api/performance_os.db`, re-run `python -m app.seed`. |
| Postgres won't connect | Confirm `DATABASE_URL` uses the `postgresql+psycopg://` driver and the DB is reachable; then `alembic upgrade head`. |

---

## Related docs

- [README.md](./README.md) — product overview
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — how it fits together
- [docs/API.md](./docs/API.md) — endpoint reference
- [docs/SECURITY.md](./docs/SECURITY.md) — security & privacy
