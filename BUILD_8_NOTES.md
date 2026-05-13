# Build 8 — Apple Resubmission Notes (2026-05-13)

## What changed in this build
- **Removed the Safari fallback in auth.tsx.** On iOS/Android, sign-in now only attempts native Firebase Auth. If that fails, an inline error is shown — Safari is never opened. This was the exact rejection cause for Build 7.
- Magic-link emails now redirect to `https://thepropertydna.com/auth/callback` (instead of `capacitor://localhost`) so Universal Links bounce the user back into the app.
- `signInWithFacebook` now throws a native-only error message in the app (Facebook button is already hidden from the iOS UI).

## ⚠️ Required action before resubmitting — Supabase auth provider config

Native Firebase tokens won't be accepted by Supabase until two changes are made in the Supabase Dashboard.
Project: `https://supabase.com/dashboard/project/neccpdfhmfnvyjgyrysy`

### 1. Google provider → "Authorized Client IDs"
Add the **iOS Firebase Client ID**:
```
262652433329-1th34cp0n0dtob46n7qr4s2tlnen3l0a.apps.googleusercontent.com
```
Path: **Authentication → Providers → Google → Authorized Client IDs (for native sign in with ID tokens)**

### 2. Apple provider → "Authorized Client IDs"
Add the **iOS Bundle ID**:
```
com.thepropertydna.app
```
Path: **Authentication → Providers → Apple → Authorized Client IDs**

Without these, native sign-in still surfaces a clean inline error and the user can fall back to email magic link. With them, native sign-in completes end-to-end.

## Resolution Center reply (paste into ASC)
Submission to reply to: previous Build 7 review.

> Thank you for the detailed report. We identified the bug and Build 8 resolves it.
>
> The Build 7 issue: after native Sign in with Apple / Google succeeded, our backend rejected the resulting token and our error handler incorrectly redirected to a web-based OAuth flow that opened Safari and never returned. Build 8 removes that fallback entirely — native sign-in now either completes the session or shows a visible inline error in the modal. Safari is no longer involved in the auth path.
>
> If for any reason native sign-in is unavailable, every user (including reviewers) can sign in via the **"Send Sign-In Link"** email option directly below the Google/Apple buttons. The link returns to the app via Universal Links on `thepropertydna.com`.
>
> Demo email for review: **apple-reviewer@thepropertydna.com** (we can pre-seed this account on request).
>
> Tested on iPad Air (M3) and iPhone 17 Pro Max simulators on iPadOS 26.5 / iOS 26.4.

## Submission IDs
- Cancelled: `f75d80e2-7206-4b77-b4df-1226ea9be144` (state: CANCELING → COMPLETE)
- App Store Version: `9863831b-9cb2-4c92-a495-bf2b83c2a536`
- New build delivery: `0a34874c-dd74-4385-88b0-6a1dea1cd614` (Build 8)
