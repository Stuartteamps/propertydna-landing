# Arete — App Store Listing Kit (ready to paste)

Everything App Store Connect asks for a **public** release. Fill the few `<...>` placeholders
(mostly URLs and your contact info), paste the rest. See `APP_STORE_CHECKLIST.md` for the full
pre-submit checklist and `DEPLOY.md` for hosting the API (required before public users can use it).

---

## App information
- **Name:** Arete
- **Subtitle (30 chars):** Health & performance OS
- **Bundle ID:** `com.arete.app`
- **Primary category:** Health & Fitness
- **Secondary category:** Lifestyle
- **Age rating:** 17+ (see age-rating answers below — health/wellness content)
- **Price:** Free (recommended to start)

## Promotional text (170 chars)
> Your daily readiness, nutrition targets, training, and recovery in one calm command center. Photograph meals, sync Apple Health, and know exactly what to do today.

## Description
> Arete is a personal health and performance operating system for people who train seriously.
>
> Open it in the morning and see one clear answer: how recovered you are, how hard to train, what to eat, and what needs attention — no spreadsheets, almost no typing.
>
> • Readiness score from sleep, HRV, resting heart rate, and training load — with a plain-English explanation of why it moved.
> • Adaptive nutrition targets (calories, protein, carbs, fat, fiber, hydration) that respond to your goal, weight trend, and today's session.
> • Photograph a meal for an editable nutrition estimate — no manual logging.
> • Apple Health sync for sleep, HRV, heart rate, workouts, steps, and activity.
> • Training log for strength, running, calisthenics, mobility, and conditioning, with weekly summaries and PRs.
> • A 10-minute morning routine that adapts to your readiness and progresses week to week.
> • Recovery tracking for sauna, cold plunge, and mobility, plus a one-minute journal.
> • Trends and a weekly report that tells you what improved, what slipped, and what to prioritize.
>
> Arete is for education, wellness, and fitness tracking. It does not diagnose, treat, or prescribe, and is not a substitute for professional medical advice. Nutrition and readiness figures are estimates. Consult a licensed clinician for medical decisions.

## Keywords (100 chars, comma-separated)
> readiness,HRV,recovery,nutrition,macros,protein,training,sleep,longevity,fitness,workout,health

## URLs (required — must resolve before submission)
- **Support URL:** `<https://your-domain-or-github-pages/support>`  (draft in `SUPPORT.md`)
- **Marketing URL (optional):** `<https://your-domain>`
- **Privacy Policy URL:** `<https://your-domain-or-github-pages/privacy>`  (draft in `PRIVACY_POLICY.md`)

---

## App Review information
- **Sign-in required:** Yes → provide the demo account.
  - **Username:** `demo@arete.app`
  - **Password:** `performance123`
  - (Seed it on your production API with `python -m app.seed`, or register it once.)
- **Notes for reviewer:**
  > Arete requires an account. Use the demo credentials above. The app talks to our hosted API at <YOUR_API_URL>. Apple Health and Google Calendar features use on-device permission prompts; in the demo account, health/calendar data is pre-populated so the dashboard, readiness score, meal logging, workouts, morning routine, recovery, journal, and trends are all reviewable without granting device permissions. Nutrition and readiness values are clearly labeled estimates and the app displays a medical disclaimer. The app does not provide medical diagnosis or treatment.
- **Contact:** `<your name>` / `<your email>` / `<your phone>`

## Export compliance
- Uses only standard HTTPS/TLS → **exempt**. `ITSAppUsesNonExemptEncryption` is already set to
  `false` in `app.json`, so App Store Connect won't ask again.

## Age rating questionnaire (answers)
- Medical/Treatment Information: **Infrequent/Mild** (wellness education + disclaimers; no diagnosis).
- Everything else (violence, sexual content, gambling, etc.): **None.**
- Result: typically **17+** due to health/wellness data. Confirm in the questionnaire.

---

## App Privacy ("nutrition labels")
Answer **Yes, we collect data**, then declare:

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|-----------|-----------|----------------|-------------------|---------|
| Health & Fitness (sleep, HRV, HR, workouts, activity) | Yes | Yes | No | App Functionality |
| Contact Info (email) | Yes | Yes | No | App Functionality (account) |
| User Content (meal photos, journal, labs) | Yes | Yes | No | App Functionality |
| Identifiers (user ID) | Yes | Yes | No | App Functionality |
| Diagnostics (crash/perf), if you add analytics later | Optional | — | No | App Functionality |

Key commitments (must stay true — they match the code):
- **No tracking**, no data sold, no third-party advertising.
- **HealthKit data is never used for advertising or shared with third parties** (App Store
  guideline 5.1.3 / HealthKit rules). It is used only to compute readiness and recommendations.
- Users can **export** and **delete** all their data in-app (Profile → Privacy; API:
  `GET /api/account/export`, `DELETE /api/account`).

---

## Screenshots (required — you generate these)
Apple requires screenshots for iPhone 6.9" and 6.5" displays (at minimum). Capture from a
simulator or device once the app runs:
- Today (readiness ring + coach), Nutrition (macros + meal), Training (weekly + workouts),
  Trends (charts + weekly report), Morning routine timer. 5 is plenty.
- `docs/MOBILE_BUILD.md` covers running on a simulator to capture them.

---

## Build & submit (public release)
Same as internal, but after the build is processed you select it under **App Store** (not just
TestFlight), attach this metadata + screenshots, and **Submit for Review**:
```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest      # uploads to App Store Connect
# then in App Store Connect: fill this listing, attach screenshots, Submit for Review
```
Expect **1–3 days** for review. Health apps get extra scrutiny — the demo account, clear
estimates, medical disclaimer, and HealthKit-usage honesty above are what reviewers look for.
