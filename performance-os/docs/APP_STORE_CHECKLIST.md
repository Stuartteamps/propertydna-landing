# App Store Submission Checklist

Work through this before submitting Performance OS to App Review. Health apps are held to a
higher bar; several items below are hard requirements, not nice-to-haves.

Legend: ☐ = to do. Items marked **(required)** commonly cause rejection if missing.

---

## Identity & configuration

- ☐ **Bundle identifier** set to your own reverse-DNS id (placeholder:
  `app.performanceos.mobile`; also `APPLE_BUNDLE_IDENTIFIER` in `.env.example`). **(required)**
- ☐ **Apple Team ID** configured (`APPLE_TEAM_ID`). **(required)**
- ☐ App **name**, subtitle, and category chosen (Health & Fitness). Rebrand from the working name
  "Performance OS" if desired — change `apps/api/app/core/branding.py` and
  `packages/shared/branding.ts`.
- ☐ `version` and incrementing `ios.buildNumber` set in `app.json`.

## Assets

- ☐ **App icon** — 1024×1024 (no alpha), plus the generated icon set. *(placeholder — replace)*
- ☐ **Splash / launch screen** configured. *(placeholder — replace)*
- ☐ **Screenshots** for required device sizes (e.g. 6.7" and 6.5" iPhone).
- ☐ Optional preview video.

## Usage descriptions (`Info.plist`) **(required)**

All strings must be specific and truthful. See [MOBILE_BUILD.md](./MOBILE_BUILD.md) for wording.

- ☐ `NSHealthShareUsageDescription` (read Health)
- ☐ `NSHealthUpdateUsageDescription` (write Health)
- ☐ `NSCameraUsageDescription` (meal photos)
- ☐ `NSPhotoLibraryUsageDescription` (attach photos)
- ☐ `NSPhotoLibraryAddUsageDescription` (save photos, if used)
- ☐ `NSMicrophoneUsageDescription` (voice journal)
- ☐ Notifications permission prompt copy
- ☐ **HealthKit entitlement** enabled for the App ID + `react-native-health` plugin configured.

## Privacy

- ☐ **Privacy nutrition labels** completed in App Store Connect. Declare what you collect and
  how it's used. Expected categories for this app:
  - Health & Fitness data (sleep, HRV, heart rate, workouts, nutrition, labs)
  - Identifiers (account email)
  - User Content (food photos, journal text/voice)
  - Usage/diagnostics if analytics are added
- ☐ **Privacy manifest** (`PrivacyInfo.xcprivacy`) included, declaring data types and any
  required-reason APIs. **(required for new submissions)**
- ☐ **Do not use Health data for advertising or share it with third parties** (Apple HealthKit
  policy) — this app does not.
- ☐ **Privacy policy URL** live and linked. *(placeholder — `PRIVACY_URL` in
  `app/core/branding.py`; replace `https://example.com/privacy`)* **(required)**
- ☐ **Support URL** live. *(placeholder — `SUPPORT_URL` in `app/core/branding.py`; replace
  `https://example.com/support`)* **(required)**

## Account & data rights **(required)**

- ☐ **In-app account deletion** — Apple guideline 5.1.1(v). Implemented: `DELETE /api/account`.
- ☐ **Data export** available — `GET /api/account/export`.
- ☐ **Image deletion** — `DELETE /api/account/images/{image_id}`.
- ☐ **Integration revocation** — `POST /api/integrations/{provider}/revoke`.
- ☐ If sign-up uses a third-party login, **Sign in with Apple** may be required alongside it.

## Health-app review considerations

- ☐ **No medical claims.** Copy stays in wellness/education framing. The app does **not**
  diagnose, treat, or prescribe. The disclaimer in `branding.py` (`DISCLAIMER`) is surfaced.
- ☐ AI nutrition/readiness outputs are clearly labeled **estimates** with confidence, and are
  **editable**.
- ☐ Lab results and readiness are presented as tracking/wellness signals, **not diagnoses**.
- ☐ Safety bounds are enforced server-side (calorie floors, capped deficits) — no unsafe advice.
- ☐ Medications are stored as sensitive data and never logged (see [SECURITY.md](./SECURITY.md)).

## Functional review readiness

- ☐ **Reachable backend** — `EXPO_PUBLIC_API_URL` points at a live **HTTPS** API (not
  `localhost`).
- ☐ **Demo account** works: `demo@performanceos.app` / `performance123`, with seeded data so the
  reviewer sees a populated app.
- ☐ App handles **permission denial** gracefully (Health/camera/mic declined).
- ☐ No crashes, no placeholder/debug screens, no broken links.
- ☐ Export-compliance (encryption) questions answered in App Store Connect.

---

Related: [MOBILE_BUILD.md](./MOBILE_BUILD.md), [TESTFLIGHT.md](./TESTFLIGHT.md),
[SECURITY.md](./SECURITY.md).
