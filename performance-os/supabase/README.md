# Supabase / Postgres

This directory holds the production Postgres schema and Row Level Security policies that mirror
the SQLModel tables in `apps/api/app/models/__init__.py`. The local demo uses SQLite and needs
none of this; use it when running Arete against Postgres/Supabase.

| File | Purpose |
|------|---------|
| [`schema.sql`](./schema.sql) | The 30 tables as Postgres DDL (uuid PKs, `timestamptz`, `jsonb`, FKs, indexes). |
| [`rls.sql`](./rls.sql) | Enables RLS and per-user access policies (apply **after** `schema.sql`). |

See also [../docs/DATABASE.md](../docs/DATABASE.md) (data model) and
[../docs/SECURITY.md](../docs/SECURITY.md) (why RLS + the isolation model).

---

## Apply to a Supabase project

### Option A — Supabase SQL editor

1. Open your project → **SQL Editor**.
2. Paste and run the contents of **`schema.sql`**.
3. Paste and run the contents of **`rls.sql`**.

### Option B — psql / Supabase CLI

Get your connection string from **Project Settings → Database** (or `supabase status` locally):

```bash
export DATABASE_URL='postgresql://postgres:<password>@<host>:5432/postgres'

psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/rls.sql
```

`schema.sql` requires the `pgcrypto` extension for `gen_random_uuid()`; it runs
`create extension if not exists "pgcrypto";` at the top (already available on Supabase).

> **Alembic alternative.** The backend also ships Alembic migrations generated from the same
> models (`alembic upgrade head` from `apps/api`). Use **either** the Alembic migrations **or**
> `schema.sql` for the tables — not both — then apply `rls.sql` for the policies. See
> [../SETUP.md](../SETUP.md).

---

## Point the API at Postgres/Supabase

Set these in `.env` (see [`../.env.example`](../.env.example)):

```bash
# Use the psycopg driver prefix so SQLAlchemy/SQLModel connect correctly:
DATABASE_URL=postgresql+psycopg://postgres:<password>@<host>:5432/postgres

# Supabase project settings (Project Settings → API):
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# To use Supabase-issued identities instead of local JWTs:
AUTH_PROVIDER=supabase
```

Then start the API as usual (`python -m uvicorn app.main:app --reload --port 8000`). On startup
the app will use the Postgres connection.

---

## How RLS maps to our auth model

RLS restricts each row to its owner via `user_id::text = auth.uid()::text` (comparisons cast to
text so they're correct whether the id column is native `uuid` or text). The intended mapping is
`users.id == auth.uid()`; if you adopt the `SupabaseAuthProvider` seam, switch the comparisons to
`external_auth_id = auth.uid()::text`. Child tables (`meal_items`, `nutrient_values`,
`workout_sets`, `routine_exercises`) are scoped through their parent with an `EXISTS` check.

The backend's **service-role key** bypasses RLS by design for trusted server-side work; the
`anon`/`authenticated` roles are fully constrained by the policies. Details and rationale are in
[../docs/SECURITY.md](../docs/SECURITY.md).
