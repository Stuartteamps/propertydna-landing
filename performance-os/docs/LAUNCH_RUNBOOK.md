# Arete — Public Launch Runbook (Option A: you run it)

Ordered, copy-paste steps to take Arete from this repo to the public App Store. Apple Team ID
(`8NR9GCA6GQ`) is already wired into `eas.json` and `.env.example`. Est. hands-on time ~1–2 hours,
plus 1–3 days Apple review.

Prereqs: Node 20+, a free **Expo** account (expo.dev), your **Apple Developer** login, and a host
account for the API (Fly.io used below).

---

## 1. Put the API online  (required — public users can't reach localhost)
```bash
cd performance-os/apps/api
# one-time: install flyctl and log in
curl -L https://fly.io/install.sh | sh && fly auth login

fly launch --copy-config --now              # uses the included fly.toml + Dockerfile
fly secrets set SECRET_KEY="$(openssl rand -hex 32)"
fly deploy
fly open /api/health                        # confirm {"status":"ok",...}
```
Note the URL (e.g. `https://arete-api.fly.dev`). Seed the demo account Apple Review needs:
```bash
fly ssh console -C "python -m app.seed"     # creates demo@arete.app / performance123
```
> For durable multi-user data, attach Postgres: `fly postgres create && fly postgres attach <db>`
> (auto-sets `DATABASE_URL`), then `fly deploy` again. SQLite works to start but resets on
> machine replacement.

## 2. Point the app at your API
Edit `performance-os/apps/mobile/eas.json` → set `EXPO_PUBLIC_API_URL` to your Fly URL in **both**
the `preview` and `production` profiles.

## 3. Turn on real food-vision AI  (implemented — just add your key)
Meal photos, meal-text parsing, and coaching use a real model once you set a vendor + key.
Both Claude and OpenAI are wired (`app/ai/providers/real.py`); output is schema-validated before
storage. Pick one:
```bash
# Claude (default model claude-sonnet-5):
fly secrets set AI_PROVIDER=anthropic AI_PROVIDER_API_KEY=<your-anthropic-key>

# …or OpenAI (default model gpt-4o-mini):
fly secrets set AI_PROVIDER=openai AI_PROVIDER_API_KEY=<your-openai-key>
```
Optionally pin a model with `fly secrets set AI_MODEL=<model-id>`. Voice transcription uses
OpenAI Whisper when an OpenAI key is present. Keep `AI_PROVIDER=mock` for review if you prefer to
launch without live AI first.

## 4. Host the two required URLs
Publish `legal/PRIVACY_POLICY.md` and `legal/SUPPORT.md` (fill the `<...>` blanks first). Fastest:
enable **GitHub Pages** on this repo, or paste them into any static host. Keep the resulting URLs.

## 5. Build + upload the iOS app  (EAS cloud — no Mac needed)
```bash
npm i -g eas-cli
cd performance-os/apps/mobile
eas login                       # your Expo account
eas init                        # writes projectId into app.json (commit it)
eas build --platform ios --profile production
#   → EAS logs into your Apple account, registers App ID com.arete.app under team 8NR9GCA6GQ,
#     manages certs/provisioning, and builds in the cloud.
eas submit --platform ios --latest    # uploads the build to App Store Connect
#   → prompts your Apple ID once; creates the App Store Connect app record if needed.
```

## 6. Fill the listing + submit for review
In **App Store Connect → Arete**:
- Paste name/subtitle/description/keywords/category from `docs/APP_STORE_LISTING.md`.
- Set **Privacy Policy URL** and **Support URL** from step 4.
- Complete **App Privacy** using the table in the listing doc (no tracking; HealthKit not used for ads).
- Add **screenshots** (iPhone 6.9" + 6.5") — capture from a simulator/device (`docs/MOBILE_BUILD.md`).
- App Review → **Sign-in required: Yes**, provide `demo@arete.app` / `performance123` and paste the
  reviewer notes from the listing doc (include your API URL).
- Age rating questionnaire (answers in the listing doc) → typically 17+.
- **Submit for Review.** Expect 1–3 days; health apps get extra scrutiny — the demo account, clear
  "estimate" labeling, and medical disclaimer are what they check.

---

## Fastest path to *you* using it now (skip review)
After steps 1–2 and 5's `eas build`, add yourself in **App Store Connect → TestFlight → Internal
Testing**. Internal TestFlight needs **no App Review**, so you can install on your iPhone in minutes
while the public review runs in parallel.

## Where I can still help without your credentials
Wire a real AI vision provider (step 3), adjust listing copy, add Postgres/RLS config, fix any
`eas build` or review-rejection error you paste back to me.
