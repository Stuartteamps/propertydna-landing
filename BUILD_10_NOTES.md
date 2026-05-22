# Build 10 — Submission Notes

## What's New in This Version (≤4,000 chars; ASC versionString)

PropertyDNA is now built for the field, not just the desk.

NEW
• Native bottom tab bar — Home, Map, Saved, Account. One tap to your most-used screens.
• Use My Location — tap the pin on any address field to drop your current coordinates and prefill the form.
• Offline reports — every report you open is saved to your device automatically. Open them in airplane mode, at a showing with no signal, in the elevator.
• Save & Share — pin reports to keep them offline forever, or share to Messages, Mail, AirDrop, or any app via the native iOS share sheet.
• Haptic feedback — subtle taps confirm primary actions (analyze, sign in, save).
• Offline banner — when you lose signal, a banner lets you jump straight to your saved reports.

IMPROVED
• Account deletion — find it instantly from the user menu or the Account · Privacy card on your dashboard.
• Native sign-in — Apple, Google, and email magic-link all complete in-app without bouncing to Safari.

WHY THIS MATTERS
PropertyDNA exists to defend you against information asymmetry in the biggest purchase of your life. The native app puts that intelligence in your pocket — at the open house, on the curb, before you sign anything.

## Promotional Text (≤170 chars)

Property intelligence in your pocket. Offline reports, native share sheet, geolocation lookup, and haptic feedback — built for buyers and sellers in the field.

## App Review Notes (private — Apple reviewer only)

This release addresses Guideline 4.2 (Minimum Functionality) by adding native iOS capabilities that are impossible on the web:

1. Native bottom tab bar (Home/Map/Saved/Account) — visible on every screen.
2. iOS share sheet via @capacitor/share for any report.
3. Offline report cache via @capacitor/preferences — open any report, then put the device in airplane mode and tap the "Saved" tab. The report is fully readable offline.
4. Geolocation + reverse-geocode (@capacitor/geolocation + Nominatim) — tap "Use my location" next to the address field to autofill.
5. Haptic feedback (@capacitor/haptics) on primary CTAs.
6. Offline banner: disable Wi-Fi and cellular while in the app to see the offline state and the "View saved" CTA.

Native sign-in (carried over from Build 9) — sign in with Apple, Google, or email magic-link without leaving the app. Demo credentials below work; any Apple/Google account should also complete via native sign-in.

DEMO CREDENTIALS
Apple ID: ar_user235@icloud.com (validated in Build 8 review)
Email magic-link: any email address — link arrives via Resend.

Account deletion (Guideline 5.1.1(v)): two surfaces — Nav user menu → "Delete Account", and a dedicated Account · Privacy card at the top of the Dashboard. Both lead to the same confirm flow, which calls /.netlify/functions/delete-account to remove auth identity, profile, subscriptions, and saved reports.

## Resolution Center Reply (if Build 9 had open 4.2 ticket — paste in ASC UI)

Thank you for the previous review.

Build 10 substantially expands the iOS app's native functionality so it is meaningfully different from the web experience. New capabilities you can verify:

1. NATIVE BOTTOM TAB BAR — visible on every screen with haptic feedback on tap.
2. iOS SHARE SHEET — open any report and tap "Share Report" to invoke the system share sheet.
3. OFFLINE REPORTS — Open a report (it is automatically cached), enable Airplane Mode, tap the "Saved" tab. The report is readable with no network connection. This is impossible on the web.
4. GEOLOCATION — On the Analyze form, tap "Use my location" to fetch device GPS and reverse-geocode it into the address fields.
5. HAPTIC FEEDBACK on all primary CTAs.
6. OFFLINE BANNER — Disable Wi-Fi and cellular; a banner appears at the top of every screen with a one-tap link to saved reports.

We have also added a top-level "Account · Privacy" card on the dashboard surfacing the account deletion flow (5.1.1(v)) without requiring navigation.

Thank you for your time. Please let us know if there is anything else we can clarify.
