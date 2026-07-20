#!/usr/bin/env bash
# One-shot local bootstrap for Performance OS (backend). Mock-first: no credentials needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"

echo "▶ Setting up backend at $API"
cd "$API"
if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install: https://docs.astral.sh/uv/  (or: pip install uv)"; exit 1
fi
[ -d .venv ] || uv venv --python 3.11 .venv
# shellcheck disable=SC1091
source .venv/bin/activate
uv pip install -e ".[dev]" >/dev/null
[ -f .env ] || cp "$ROOT/.env.example" .env 2>/dev/null || true

echo "▶ Seeding demo data (demo@performanceos.app / performance123)"
python -m app.seed

echo "▶ Running tests"
python -m pytest -q

echo "▶ Starting API on http://localhost:8000  (docs at /docs)"
exec python -m uvicorn app.main:app --reload --port 8000
