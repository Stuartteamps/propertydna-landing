# Shipping to TestFlight

Step-by-step guide to get Arete onto TestFlight for internal/external testing, using
Expo Application Services (EAS). This assumes the app builds locally as a Dev Client already
(see [MOBILE_BUILD.md](./MOBILE_BUILD.md)).

> **Approval is not guaranteed.** Apple reviews TestFlight builds (especially external testing)
> and can reject them. Health apps get extra scrutiny — work through
> [APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md) before submitting.

---

## Prerequisites

1. **Apple Developer Program membership** ($99/yr) — required to distribute any build.
2. **An App Store Connect record** for the app (create it under *My Apps → +*).
3. A **bundle identifier** registered to your team. Placeholder in this repo:
   `com.arete.app` (`APPLE_BUNDLE_IDENTIFIER` in `.env.example`). Use your own.
4. Your **Apple Team ID** (`APPLE_TEAM_ID` in `.env.example`).
5. `eas-cli` installed and logged in:

   ```bash
   npm install -g eas-cli   # or npx eas
   eas login
   ```

---

## 1. Configure EAS

From `apps/mobile`:

```bash
eas build:configure
```

This creates/updates `eas.json` with build profiles. Ensure a `production` profile exists and
that `app.json` has the correct `ios.bundleIdentifier`, a bumped `version`, and an incrementing
`ios.buildNumber` (EAS can auto-increment).

---

## 2. Certificates & provisioning (managed by EAS)

Let EAS manage signing — it creates and stores the distribution certificate and provisioning
profile for you. On the first production build it will prompt to generate credentials; accept
the managed flow. (Advanced: `eas credentials` to inspect or supply your own.)

---

## 3. Build for iOS (production)

```bash
eas build --platform ios --profile production
```

EAS builds in the cloud and produces a signed `.ipa`. This is the artifact TestFlight
distributes.

---

## 4. Submit to App Store Connect

```bash
eas submit --platform ios --profile production
```

`eas submit` uploads the build to App Store Connect. (You can also point it at a specific build
with `--latest` or a build id.) You'll need an App Store Connect API key or your Apple ID; EAS
walks you through it.

After upload, the build appears under **App Store Connect → your app → TestFlight** and goes
through Apple's automatic processing (a few minutes to an hour).

---

## 5. Internal testing

1. In **App Store Connect → TestFlight**, add **Internal Testers** (up to 100 members of your
   team; no App Review required for internal-only testing).
2. Assign the processed build to the internal group.
3. Testers install **TestFlight** from the App Store and accept the invite; the build appears
   there.

Provide **demo credentials** so testers can sign in immediately:

- Email: `demo@arete.app`
- Password: `performance123`

(This requires the tester's app to point at a reachable backend — a deployed API URL via
`EXPO_PUBLIC_API_URL`, not `localhost`.)

---

## 6. External testing (optional)

External testing (up to 10,000 testers) **requires a Beta App Review**. Complete the TestFlight
test information (what to test, contact info), fill in export-compliance answers, and submit for
review. Health-related functionality may draw additional questions.

---

## Common rejection / friction points

- Missing `Info.plist` **usage descriptions** for Health/camera/mic (see
  [MOBILE_BUILD.md](./MOBILE_BUILD.md)).
- Missing **in-app account deletion** (Apple requires it for account-based apps — implemented at
  `DELETE /api/account`).
- **Privacy** questionnaire / privacy manifest gaps (see
  [APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md)).
- Reviewers **can't reach the backend** — ensure `EXPO_PUBLIC_API_URL` points at a live HTTPS API
  and demo credentials work.
- Implying **medical claims** — keep copy to wellness/education; the app does not diagnose or
  prescribe.

Related: [MOBILE_BUILD.md](./MOBILE_BUILD.md), [APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md).
