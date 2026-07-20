# Security & Privacy

Performance OS handles personal health data. This document describes the posture as built in the
MVP and where the seams for production hardening are.

> **Not HIPAA compliant.** The architecture is HIPAA-*conscious* — audit logging, least
> privilege, sensitive-field isolation, and an encrypted-transport expectation — but the controls
> are **not fully implemented or verified**, and the system should not be used to store Protected
> Health Information under HIPAA without a formal compliance program. See
> [ROADMAP.md](./ROADMAP.md) for planned hardening.

---

## Authentication & sessions

- **Local JWT** (`AUTH_PROVIDER=local`, default). `POST /api/auth/login` /
  `POST /api/auth/register` return a signed JWT; clients send it as
  `Authorization: Bearer <token>`. Passwords are hashed (never stored in plaintext) via
  `app/core/security.py`.
- **Token TTL** — `ACCESS_TOKEN_TTL_MINUTES` (default 7 days for demo convenience; shorten in
  production).
- **Signing secret** — `SECRET_KEY` comes from env. The `.env.example` value is intentionally
  insecure; generate a real one with `openssl rand -hex 32` before any non-local deployment.
- **Supabase seam** — `AUTH_PROVIDER=supabase` and `User.external_auth_id` allow swapping to
  Supabase-issued identities without changing callers.
- Every request to a protected route resolves the current user (`get_current_user`) and scopes
  all queries to that `user_id`.

---

## Data isolation: RLS (Postgres) vs. app-layer scoping (SQLite)

- **SQLite (local demo)** — Row Level Security is not available. Isolation is enforced in the
  **API layer**: every query filters by the authenticated `user_id`. Child tables
  (`meal_items`, `nutrient_values`, `workout_sets`, `routine_exercises`) are reached only through
  their owning parent.
- **Postgres/Supabase (production)** — the same isolation is enforced in the **database** via
  Row Level Security. [`supabase/rls.sql`](../supabase/rls.sql) enables RLS on every user-owned
  table and restricts rows to `user_id = auth.uid()::text` (our PKs are text UUIDs). Child tables
  are scoped through an `EXISTS` check against their parent. This is defense in depth: even a bug
  in the API layer cannot leak another user's rows.

---

## Sensitive-data handling

- **Medications** live in a **dedicated `medications` table** flagged `sensitive`, isolated for
  least-privilege access and **never written to logs**.
- **Log redaction** — logging is configured in `app/core/logging.py`; sensitive fields
  (medication names/doses, credentials, tokens) are kept out of log output. AI request references
  stored in `ai_analysis_records.request_ref` are non-PII (e.g. an image id), not raw content.
- **Least privilege** — sensitive and non-sensitive data are separated at the table level so
  access can be granted narrowly.

---

## Audit logging

The `audit_logs` table records security-relevant actions — `login`, `export`, `delete_account`,
`revoke_integration`, and similar — with the acting `user_id`, `action`, `resource`, `ip`, and a
JSON `meta`. AI calls are separately audited in `ai_analysis_records` (`kind`, `provider`,
`output_confidence`, `valid`, `latency_ms`).

---

## User rights: export, deletion, revocation

All exposed under `/api/account` and `/api/integrations` and required for App Store compliance:

| Right | Endpoint |
|-------|----------|
| Export all data | `GET /api/account/export` |
| Delete a stored image | `DELETE /api/account/images/{image_id}` |
| Delete account + data | `DELETE /api/account` |
| Revoke an integration | `POST /api/integrations/{provider}/revoke` |

In-app **account deletion** is mandatory for apps that support account creation (Apple guideline
5.1.1(v)); it is implemented here.

---

## Transport, secrets & configuration

- **Secrets via env only** — all secrets (`SECRET_KEY`, `AI_PROVIDER_API_KEY`, `SUPABASE_*`,
  `GOOGLE_*`) come from environment variables; `.env` is not committed (`.env.example` documents
  the shape). Never commit real secrets.
- **Encrypted transport** — production must terminate TLS (HTTPS) in front of the API. The mobile
  client reaches the backend over `EXPO_PUBLIC_API_URL`; use `https://` in production.
- **CORS** — the API currently allows all origins for local development
  (`app/main.py`); **tighten `allow_origins` per-environment in production.**

---

## Rate limiting

A simple in-memory token-bucket limits requests (`RATE_LIMIT_PER_MINUTE`, default 120/min in
`app/core/config.py`). This protects against accidental floods in the demo; for production behind
multiple workers, move to a shared store (e.g. Redis) or an edge/gateway limiter.

---

## Input validation & AI-output safety

- **Request validation** — all request bodies are Pydantic/SQLModel schemas; malformed input is
  rejected with a 422 before it reaches any handler.
- **AI output is never trusted raw** — `app/ai/validation.py` validates and bounds every AI
  estimate before storage; results are surfaced with a confidence value and are **editable** by
  the user before they are saved.
- **Deterministic safety bounds** — the nutrition engine enforces calorie floors (male 1500 /
  female 1200), a daily deficit cap (750 kcal), and gradual weekly target changes (±150 kcal), so
  no code path can recommend an unsafe target. No feature diagnoses, prescribes, or changes
  medications.

---

## Known limitations

See [`../KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). In short: RLS applies only on Postgres; SQLite
relies on app-layer scoping; rate limiting is in-memory; and the HIPAA-conscious controls are not
fully verified.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md),
[APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md).
