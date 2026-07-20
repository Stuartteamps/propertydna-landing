# Deploying Arete (personal / internal use)

Arete is two pieces: the **API** (must run somewhere your iPhone can reach) and the **iOS app**
(installed via TestFlight). For a single private user, the cheapest reliable setup is a tiny
always-on API host + TestFlight for the app.

---

## 1. API — pick one

### Option A: Local / same Wi-Fi (fastest, free)
Run the API on your Mac and point the app at your Mac's LAN IP.
```bash
cd apps/api && source .venv/bin/activate && python -m app.seed
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# find your IP: ipconfig getifaddr en0   →  set EXPO_PUBLIC_API_URL=http://<that-ip>:8000
```
Good for development and personal use when your phone and Mac share a network.

### Option B: Fly.io (always-on, ~free tier) — recommended for a phone you use anywhere
```bash
cd apps/api
fly launch --copy-config --now          # uses the included fly.toml + Dockerfile
fly secrets set SECRET_KEY="$(openssl rand -hex 32)"
# For persistence beyond a single machine, attach Postgres and set DATABASE_URL:
# fly postgres create && fly postgres attach <db>   (sets DATABASE_URL automatically)
fly deploy
```
Then set `EXPO_PUBLIC_API_URL=https://arete-api.fly.dev` in `apps/mobile/eas.json` (preview/production).

### Option C: Docker anywhere (Render, Railway, a VPS)
```bash
docker build -t arete-api apps/api
docker run -p 8000:8000 -e SECRET_KEY=$(openssl rand -hex 32) arete-api
```

### Database
- Demo/default: **SQLite** (self-contained, fine for one user; on Fly, add a volume to persist it).
- Recommended for real use: **Postgres/Supabase** — set `DATABASE_URL=postgresql+psycopg://...`,
  then apply `supabase/schema.sql` + `supabase/rls.sql`, or run `alembic upgrade head`.

---

## 2. iOS app — TestFlight (your own device)

Requires an **Apple Developer Program** membership ($99/yr) and a free **Expo** account.
See `docs/TESTFLIGHT.md` for the full walkthrough. Short version:
```bash
npm i -g eas-cli
cd apps/mobile
eas login
eas init                      # creates the EAS project; writes projectId into app.json
# put your API URL into eas.json (preview/production env), then:
eas build --platform ios --profile production
eas submit --platform ios --latest
```
Fill the placeholders in `eas.json` (`appleId`, `ascAppId`, `appleTeamId`) first. Because this is
for your own internal use, **internal TestFlight** (up to 100 of your own devices, no App Review)
is the fastest path — you don't need full App Store review to use it yourself.

---

## 3. Flip integrations to real (optional)
All of this runs in mock mode by default. To go live, set the flags + credentials in the API's
`.env` (see `.env.example`): `AI_PROVIDER`, `HEALTH_PROVIDER=healthkit` (device provides data),
`CALENDAR_PROVIDER=google` + Google OAuth creds. HealthKit already works on a Dev Client build via
`react-native-health`; the app posts samples to `/api/integrations/apple_health/sync`.
