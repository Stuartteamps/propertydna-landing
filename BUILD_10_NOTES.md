# Build 15 — Resubmission Notes

Build 14 rejected on two grounds:
- **2.1(a)** — Sign in with Apple produced an error on iPad Air 11-inch (M3), also when attempting to create a new account.
- **3.1.1** — Apple continues to flag the app for accessing externally-purchased content.

Build 15 addresses both at the architecture level by **removing user accounts entirely from the iOS app**. PropertyDNA on iOS is now a fully anonymous tool. No sign-in, no account, no path to externally-purchased content, no broken Apple Sign-In flow.

## What changed

**Sign-in removed completely on iOS:**
- `AuthModal.tsx` returns null on `isNative()` — no Sign in with Apple, no Sign in with Google, no email magic link, no plans view. The 2.1(a) iPad Sign In bug cannot occur because the surface doesn't exist.
- `Nav.tsx` "Sign In" button hidden on iOS.
- `Dashboard.tsx` redirects to `/` on iOS — `/dashboard` is unreachable.
- Native `AccountViewController` SwiftUI tab renamed "Settings" (not "Account"). No "Open Dashboard" link. No tier badge. Just preferences + a "Clear saved reports" action that wipes local UserDefaults.

**Anonymous tool architecture:**
- Reports generated on iOS are saved to local device storage only (via `@capacitor/preferences`, surfaced in the Home tab).
- The email field on the Analyze form remains — it's for report delivery, not account creation. Apple has not flagged this in any prior review.
- No "user" concept exists in the iOS UI anywhere. No "your account", no "your reports", no "your plan", no "sign in to see more."

**Carried over from Build 14:**
- Runtime check-usage interception (forces isSubscribed=false on iOS even if a paid Stripe sub exists for that email)
- All pricing / tier / plan / subscription UI hidden on iOS
- Native UITabBarController root with Home / Search / Map / Settings tabs

## Why this addresses both rejections

**3.1.1**: There is no "externally-purchased content" because there is no account-based concept of "external content" in the iOS app. No sign-in, no email-based subscription lookup, no tier inference. The iOS app is now a self-contained anonymous tool.

**2.1(a)**: The broken Apple Sign-In flow on iPad cannot be encountered because no sign-in surface exists in the iOS app. The AuthModal returns null on native; the Nav Sign In button is hidden; the /dashboard route redirects home.

## App Review Notes (private)

PROPERTYDNA BUILD 15 — ANONYMOUS iOS TOOL

Apple's prior 2.1(a) and 3.1.1 notes are addressed by a single architectural decision: the iOS app no longer has user accounts.

- AuthModal.tsx returns null on native — no path to Sign in with Apple, Sign in with Google, or email magic link.
- Nav Sign In button hidden on native.
- /dashboard route redirects to / on native.
- AccountView SwiftUI tab is now "Settings" — no account, no dashboard link, just preferences + local-data controls.
- All tier / plan / subscription concepts already hidden on iOS in Build 14.
- The check-usage interception in main.tsx (Build 14) is retained as belt-and-suspenders, but with no sign-in flow it never executes a meaningful path.

iOS user flow: open app → use Analyze form (just type an address) → receive report → save offline. No account, no purchase, no upsell, no path to externally-purchased anything.

We are not currently offering In-App Purchase products. The iOS app is a free, anonymous property-intelligence tool. We may add IAP for subscriptions in a future submission once we've validated the anonymous-tool experience with users.

DEMO CREDENTIALS
No credentials required — the iOS app has no sign-in. Reviewer can immediately analyze any U.S. address from the Search tab.

WHAT TO LOOK AT FIRST
1. Open the app — native UITabBarController root with four tabs (Home / Search / Map / Settings).
2. Search tab → Analyze form → type an address → receive a complete property report (every section visible, no gating).
3. Home tab → see the report you just generated, saved offline.
4. Settings tab → preferences toggles + Clear-Saved-Reports button. No sign-in. No Dashboard link.
5. Long-press app icon → native iOS Quick Actions menu (Analyze / Saved / Heat Map).

There is no UI path anywhere in the app that involves accounts, sign-in, subscriptions, plans, tiers, "Pro", "Enterprise", or external payment.

## Resolution Center Reply (paste in ASC UI)

Thank you for the detailed review of Build 14.

Build 15 closes both issues at the architecture level:

**2.1(a) — Apple Sign-In bug**: The AuthModal (which contained all sign-in flows including Sign in with Apple) now returns null on iOS. The Sign In button in the navigation is hidden on iOS. The /dashboard route redirects to home on iOS. There is no path within the iOS app to encounter the Apple Sign-In flow, so the iPad bug cannot occur.

**3.1.1 — Externally-purchased content access**: With no user account concept in the iOS app, there is no way to access "content purchased outside the app." The iOS app is now a fully anonymous property-intelligence tool. The Settings tab contains only local preferences and a button to clear saved reports from the device — no account, no dashboard, no sign-in.

iOS users open the app, type an address into the Analyze form, and receive a complete property intelligence report. The report is saved to the device for offline reading. That's the entire scope of the app.

We are not currently offering In-App Purchase products. PropertyDNA on iOS is a free, anonymous tool. The web version continues to offer paid subscriptions, but the iOS app has no awareness of or interface with that.

Thank you for your time.

---

# Earlier build history

# Build 14 — Resubmission Notes

Build 13 cleared the *purchase-in-app* interpretation of 3.1.1 but Apple rejected on the *accessing externally-purchased content* interpretation. The iOS app was still exposing tier/plan/subscription concepts in its UI (tier badges, "Free Account" indicators, "Check your plan" prompts) which implied — correctly — that the app interfaces with externally-paid services.

Build 14's response: **make the iOS app entirely tier-blind**. No subscription, plan, tier, or paid concept appears anywhere in the iOS UI. Every user is treated identically. Every analyze submission produces a free report with no quota indication.

## Build 14 changes (3.1.1 — tier-blind architecture)

**Runtime-level enforcement** (`main.tsx`):
- The `check-usage` Netlify function's response is intercepted client-side on iOS. The response body is rewritten before reaching the React tree:
  `{ isSubscribed: false, plan: null, tier: 'free', reportCount: 0, quota: null }`
- This guarantees no downstream code path ever sees subscriber state on iOS, even for users who have an active Stripe subscription on their account.

**UI hidden on iOS:**
- `Nav.tsx` — tier badge ("Pro" / "Enterprise") next to avatar hidden on iOS.
- `Dashboard.tsx` — subscription bar (the "Free Account" / "Pro Active" pill) hidden entirely.
- `ReportView.tsx` — the tier banner with plan label + "Check your plan" inline email prompt hidden on iOS.
- `PropertyForm.tsx` — every iOS analyze submission goes straight to `goToCheckout(form, 'free')`. No quota check, no overage handling, no error message about used reports.
- The first-report Enterprise preview banner copy changed on iOS — no longer says "Subsequent reports use your current plan"; instead reads "You're seeing every section we offer."

**Pricing page on iOS** updated copy:
- Title: "Property intelligence on demand." (was "One free report per device.")
- Body: just describes what the app does, no scarcity / paid-alternative language.

## Why this addresses Apple's 3.1.1 note

Apple's note: "The app accesses digital content purchased outside the app, such as subscriptions, but that content isn't available to purchase using In-App Purchase."

The iOS app now:
1. Cannot access externally-purchased subscriptions — every user is tier-blind, regardless of Stripe sub status (main.tsx rewrites check-usage response).
2. Does not reference "subscriptions", "plans", "tiers", "Pro", or "Enterprise" anywhere in the user-facing UI.
3. Treats every analyze request identically — no upper limit, no quota, no payment surface.

PropertyDNA iOS is now a free, self-contained property-intelligence tool. The web version retains the full tiered subscription model, but the iOS app has no awareness of or access to that model.

## App Review Notes (private)

PROPERTYDNA BUILD 14 — TIER-BLIND iOS

Apple's prior 3.1.1 note observed that the iOS app accesses externally-purchased subscriptions. Build 14 closes this at the runtime level: the `check-usage` API response is intercepted client-side and rewritten to free-tier values before reaching the React tree. The iOS app cannot see, surface, or honor any externally-purchased subscription.

Specifically:
- main.tsx patches `window.fetch` so any response from `/check-usage` on native is rewritten to `{ isSubscribed: false, plan: null, tier: 'free', reportCount: 0, quota: null }` before parsing. Even if the user has a paid Stripe subscription, the iOS UI never sees that state.
- The Nav tier badge ("Pro" / "Enterprise" next to avatar) is hidden on native.
- The Dashboard's subscription bar ("Free Account" / "Pro Active") is hidden on native.
- The ReportView tier banner with plan check is hidden on native.
- The PropertyForm bypasses all quota / payment / overage logic on native; every submission is a free report.
- The Pricing page renders a generic product-description card on native — no plans, tiers, or pricing.

Reviewer can confirm: signing in with any account (paid or unpaid) produces the same free-tier experience on iOS. There is no path to perceive, access, or interact with externally-purchased content.

We are not currently offering In-App Purchase products in this app. PropertyDNA on iOS is a free property-intelligence tool with no monetization in-app.

DEMO CREDENTIALS
Apple ID: ar_user235@icloud.com (worked in Build 8 review)
Email magic-link: any valid email.

## Resolution Center Reply (paste in ASC UI)

Thank you for the review of Build 13.

Build 14 implements a runtime-level fix: the iOS client intercepts the `check-usage` API response and forces every user (paid or unpaid) to appear as tier=free / isSubscribed=false / reportCount=0. This means the iOS app cannot access externally-purchased subscriptions, even for accounts that have an active web subscription.

Every reference to tiers, plans, "Pro", "Enterprise", "Free Account", or subscriptions has been hidden in the iOS UI:
- Nav tier badge — hidden on iOS
- Dashboard subscription bar — hidden on iOS
- ReportView tier banner + plan check prompt — hidden on iOS
- PropertyForm — no quota checks, no overage handling, no payment surface
- Pricing page — generic product description, no plans

The iOS app is now a free, self-contained property-intelligence tool. We will add In-App Purchase in a future submission if we decide to monetize on iOS; for now there is no payment of any kind in the app.

Thank you for your time.

---

# Earlier build history

# Build 13 — Resubmission Notes

Build 12 cleared 4.2 but was rejected on 3.1.1 — the reviewer found a path to a subscription purchase that I had missed (the `/pricing` page itself was still reachable via the webview, plus several inline pricing CTAs across the React tree). Build 13 closes every remaining payment surface.

## Build 13 changes (3.1.1 — exhaustive payment-UI removal)

Every entry point to a paid plan in the React/webview layer is now gated on `isNative()`:

- `/pricing` page → renders a "One free report per device" notice on iOS, with only an "Analyze" CTA. No tiers, no subscribe button.
- `Index.tsx` pricing section → entire section omitted on iOS (the `<section id="pricing">` with the 4 tiles).
- `Index.tsx` "Upgrade Access" button on the premium-preview tile → hidden on iOS.
- `Index.tsx` "See All Plans" scroll-to button → hidden on iOS.
- `Landing.tsx` "View Pricing" hero button → hidden on iOS.
- `Footer.tsx` "Pricing" nav link → filtered out on iOS.
- `ReportView.tsx` "Keep Enterprise" upsell banner → hidden on iOS.
- `Dashboard.tsx` "Upgrade Pro" button → hidden on iOS.
- `Analyze.tsx` pricing sidebar tile → hidden on iOS.
- `TierGate.tsx` → renders gated content fully on iOS (no lock, no CTA — Dan's "draw them in" strategy means the free first report shows every section unblurred).
- `LockedModule.tsx` → renders the underlying preview fully on iOS, no lock overlay.
- `PremiumPreviewCard.tsx` → forces `isPremium=true` on iOS so content shows without lock.
- `PremiumFeatureGrid.tsx` → unlocks every feature on iOS so users see the full value.
- `PremiumLockOverlay.tsx` → returns null on iOS (underlying content shows fully).
- `MarketHeatMapPreview.tsx` → upsell box + "View Plans" link hidden on iOS.
- `SampleReport.tsx` "View Plans" link → hidden on iOS.
- Plus existing Build 12 guards: PricingModal, PricingGate, AuthModal pricing view, Nav "Manage Plan" / "Get Started", PropertyForm.goToCheckout forces mode='free' on iOS.

**Runtime safety net** (`main.tsx`):
- `window.open()` on iOS strips any URL matching `/stripe\.com|checkout\.stripe|buy\.stripe/i`.
- The `/pricing` route is intercepted on cold-start and on popstate; iOS users land on `/` instead.

The result: there is no surface in the iOS app, anywhere, from which a user can purchase a subscription via Stripe or any external payment provider.

**Dan's "draw them in" point** (free-first-report full preview):
- The `isFirstReportPreview` logic in `ReportView.tsx` is intact — any free user with ≤1 reports sees `effectiveTier='enterprise'`, which renders every premium section (market trend, micro-location, full adjustments, event timeline) unblurred.
- Components that previously returned null on iOS (`PremiumPreviewCard`, `PremiumFeatureGrid`, `LockedModule`) now render their underlying content fully on iOS — so iOS users see the full value of every premium feature, just without any upgrade prompt.

## Build 12 architectural carry-over (4.2 — accepted by Apple last review)

The root view is a native `UITabBarController` (`NativeRootTabBarController.swift`). Three of four tabs are pure native SwiftUI/UIKit (Home, Map, Account); the Search tab hosts the Capacitor bridge. This passed Apple's 4.2 review on Build 12 and is unchanged.

Carried-over native subsystems: Vision OCR scanner, MKMapView modal, App Intents/Siri, Quick Actions, Core Spotlight indexing.

## App Review Notes (private)

Build 13 addresses the remaining 3.1.1 issue. Every payment surface in the embedded web layer is now gated on the native runtime flag. There is no path within the iOS app — whether via the Search tab webview, deep link, or back-stack — to purchase a subscription by any means other than In-App Purchase.

We are not currently offering In-App Purchase products in this app. PropertyDNA on iOS operates strictly as a free-tier experience: one complete property intelligence report per device, no subscription path, no per-report purchase, no external payment links. Users wanting more reports can use our website on a non-iOS device.

DEMO CREDENTIALS
Apple ID: ar_user235@icloud.com (worked in Build 8 review)
Email magic-link: any valid email — link arrives via Resend.

WHAT TO LOOK AT FIRST
1. Tap the Search tab → Analyze → submit a report (free). On the resulting report page, all premium sections (market trend, micro-location, full adjustments, event timeline) are shown unblurred — this is the "first report enterprise preview" experience.
2. Try to find a subscription purchase: tap Account → no Pricing link. Search → navigate to /pricing → a "free tier only" notice appears. Footer → no Pricing nav. Long-press app icon → Quick Actions menu has no Pricing item.
3. Verify the four native tabs (Home / Search / Map / Account) — Home, Map, and Account are SwiftUI/UIKit, not WebKit.

## Resolution Center Reply (paste in ASC UI)

Thank you for the careful review of Build 12.

Build 13 closes the remaining 3.1.1 issue: every subscription-purchase surface in the embedded web layer is now gated on the native runtime flag. There is no path within the iOS app to purchase a subscription. The /pricing page renders a "one free report per device" notice on iOS, with no plan tiles, no subscribe button, and no external payment link. The home page pricing section, footer pricing link, dashboard "Upgrade Pro" button, sidebar pricing tile, and every premium-lock-overlay upsell are all hidden on iOS.

PropertyDNA on iOS now operates strictly as a free-tier experience — one complete report per device, no subscriptions sold in-app by any means. We are not offering In-App Purchase products in this version; we may add StoreKit IAP in a future submission once we've validated the free-tier experience with users.

The native UITabBarController root and three native tabs (Home SwiftUI, Map MKMapView, Account SwiftUI) carry over from Build 12 unchanged. The Search tab continues to host the Capacitor web layer for /analyze and /report content.

Thank you for your time.

---

# Earlier build history

# Build 12 — Resubmission Notes

Build 11 was rejected on two grounds: (3.1.1) the "UPGRADE PRO" button pointed at an external payment surface; (4.2) Apple still considered the app a webview wrapper. Build 12 fixes both at the architectural level:

## What's New in This Version

PropertyDNA is now a fully native iOS app, root-and-branch:

NEW
• Native UITabBarController as the app root — Home, Search, Map, Account are real iOS tabs, not a web nav bar.
• Native SwiftUI Home dashboard — quick-action grid, recent saved-reports list, brand surface. Rendered by UIKit/SwiftUI, not WebKit.
• Native SwiftUI Account screen — settings, preferences, support, danger-zone delete. Real iOS controls.
• Native Map tab — full-screen MKMapView with Standard/Satellite/Hybrid, "find me", and 3-D buildings.
• Carried over from prior builds: Vision OCR address scanner, native MapKit "Open in Maps" on reports, Siri shortcuts via App Intents, Home Screen Quick Actions, Core Spotlight indexing.

## Promotional Text (≤170 chars)

Native iOS app: SwiftUI dashboard, MKMapView, on-device Vision OCR scanner, Siri shortcuts, offline reports. Property intelligence for buyers and sellers in the field.

## App Review Notes (private — Apple reviewer only)

PROPERTYDNA BUILD 20 — RESPONSE TO BUILD 19 REJECTION (2.1(b) + 3.1.2(c))

GUIDELINE 3.1.2(c) — AUTO-RENEWABLE SUBSCRIPTION DISCLOSURES
The pricing modal now explicitly displays, in the purchase flow itself:
• Title — "PropertyDNA Pro — Auto-Renewable Subscription"
• Length — "1-month subscription" or "1-year subscription" (toggled by the Monthly/Annual selector)
• Price — "$49.99 / month" or "$479.99 / year (≈$40.00 / month equivalent)"
• Functional link to Terms of Use (EULA) — Apple Standard EULA: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
• Functional link to Privacy Policy — https://thepropertydna.com/privacy
• Functional link to Service Terms — https://thepropertydna.com/terms
• Full auto-renewal disclosure: "Payment is charged to your Apple ID at confirmation of purchase. The subscription auto-renews at the same price unless canceled at least 24 hours before the end of the current period. Renewals can be turned off and the subscription managed in your iOS Settings → Apple ID → Subscriptions."
• Restore Purchases button.

The App Description in App Store Connect has also been updated with an explicit "Subscription & Legal" block containing the same EULA, Privacy, and Service Terms links plus the same price/length disclosures.

GUIDELINE 2.1(b) — IAP SANDBOX ERROR
Build 19's sandbox purchase error was caused by the Paid Apps Agreement not yet being in effect on the account. The Account Holder has now accepted the Paid Apps Agreement in App Store Connect → Business, so sandbox purchases of com.thepropertydna.app.pro.monthly and com.thepropertydna.app.pro.yearly resolve correctly with this build. Both IAP products have also been submitted for review and are submitted in the same submission as this binary.

HOW TO TEST
1. Open the app — tap Search (the web tab), or any "Unlock Premium" / "Upgrade" affordance on the Pro features within the report view.
2. The pricing modal opens with the Monthly/Annual toggle. Tap "Start Pro" — the native StoreKit sheet appears.
3. Sandbox purchase resolves; the modal closes and Pro features unlock (IntellaGraph AI panel, full Market Heat Map, premium report sections).
4. Restore Purchases is the next button below Start Pro; tapping it calls StoreKit's restore flow.

(Build 19's 4.0 Sign-in-with-Apple item, Build 18's 3.1.1 IAP item, Build 17's 3.1.1 / 2.3.3 items, and Build 16's 2.3.0 / arm64 item are all resolved and not present.)

The notes below document the native architecture carried forward from prior builds.

───────────────────────────────────────────

PROPERTYDNA BUILD 19 — RESPONSE TO BUILD 18 REJECTION (3.1.1) — IN-APP PURCHASE WIRED

GUIDELINE 3.1.1 — IN-APP PURCHASE
PropertyDNA Pro is now available for purchase inside the iOS app via StoreKit 2 In-App Purchase, fully aligned with 3.1.3(b) for our multi-platform service.

Two auto-renewable subscriptions in the "PropertyDNA Pro" group:
• com.thepropertydna.app.pro.monthly — $49.99/month
• com.thepropertydna.app.pro.yearly  — $479.99/year

How to test the purchase flow:
1. Open the app on the Search tab (or any screen with a Pro upsell — e.g. the IntellaGraph "Unlock Premium" button, or the Market Heat Map "Unlock All Markets" button).
2. The pricing modal opens with two options for the Pro plan and a Monthly/Annual toggle.
3. Tap "Start Pro" — the StoreKit purchase sheet appears, signed in to the sandbox account.
4. Complete the purchase. The modal closes and Pro features unlock (IntellaGraph AI panel responses, full Market Heat Map, premium report sections).
5. The Restore Purchases button is at the bottom of the same pricing modal. The Terms of Service and Privacy Policy links are immediately below it. Auto-renewal disclosure copy is shown above them.

Per Apple Guideline 3.1.3(b), a customer who subscribed on our website (thepropertydna.com) at the same price can also access Pro features in the iOS app when signed in — because In-App Purchase is now an equally available path on iOS.

(Build 18's prior 4.0 Sign-in-with-Apple item was resolved; the button now has a clear white border on the dark background. Earlier 2.3.0 / 3.1.1 / 2.3.3 items also remain resolved.)

The notes below document the native architecture carried forward from prior builds.

───────────────────────────────────────────

PROPERTYDNA BUILD 18 — RESPONSE TO BUILD 17 REJECTION (4.0 + 2.1)

GUIDELINE 4 — SIGN IN WITH APPLE BUTTON
The Sign in with Apple button has been restyled so it is clearly a button: it now has a solid 1px white border around the standard black button, making its shape unambiguous against the app's dark background. This was applied to every Sign in with Apple surface in the app.

GUIDELINE 2.1 — SUBSCRIPTION CLARIFICATION (information requested)
"PropertyDNA Pro" is a subscription sold on our website (thepropertydna.com) for web/desktop users. It includes unlimited property-intelligence reports plus market-intelligence features (comparable trend charts, market-velocity index, saved-property dashboard, priority PDF delivery). Pricing: $49.99/month or $479.99/year.
The iOS app is entirely FREE and does not include, reference, advertise, or unlock this subscription. There are no in-app purchases, no prices, no paywalls, and no links to purchase. Every feature in the iOS app is available to all users at no charge, and web-purchased content is not accessed in the iOS app. We intend to offer the subscription via In-App Purchase in a future update; until then the iOS app stays free with no paid content.

(Build 17's prior 3.1.1 and 2.3.3 items were resolved and are not present.)

The notes below document the native architecture carried forward from prior builds.

───────────────────────────────────────────

PROPERTYDNA BUILD 17 — RESPONSE TO BUILD 16 REJECTION (3.1.1 + 2.3.3)

Thank you for the review of Build 16. We've addressed both items.

GUIDELINE 3.1.1 — IN-APP PURCHASE
The iOS app is entirely free. It contains no subscriptions, no in-app purchases, no prices, and no payment links of any kind. Every feature is unlocked for all users on iOS. In Build 16, a few content screens (the market-intelligence map and the IntellaGraph analysis panel) still rendered "Unlock Premium" / "Unlock All Markets" call-to-action labels even though no purchase was possible. Those labels have been removed on iOS — the underlying content is now simply shown, free, with no upsell, no price, and no reference to paid plans or external purchase. There is no path in the iOS app to access content purchased elsewhere, and no path to purchase anything.

GUIDELINE 2.3.3 — ACCURATE METADATA (SCREENSHOTS)
The App Store screenshots have been replaced with new captures taken directly from the running app on iPhone 17 Pro Max. They show the native UI in use: the SwiftUI Home dashboard, the native Apple Maps market view, the native Settings screen, and the property-analysis entry screen. No marketing/Safari pages.

(Build 16's prior 2.3.0 arm64 install issue was resolved and is no longer present.)

The notes below document the native architecture carried forward from prior builds.

───────────────────────────────────────────

PROPERTYDNA BUILD 12 — RESPONSE TO BUILD 11 REJECTION (3.1.1 + 4.2)

Thank you for the detailed review of Build 11. We've addressed both issues at the source rather than at the margin.

═══════════════════════════════════════════
GUIDELINE 3.1.1 — IN-APP PURCHASE
═══════════════════════════════════════════

The "UPGRADE PRO" surface has been removed entirely from the iOS app. PropertyDNA's iOS app now operates as a free-tier-only experience. There is no path within the app to purchase digital subscriptions, and no external payment links are surfaced.

Specifically:
• The Pricing modal returns null on iOS (src/components/PricingModal.tsx).
• The Pricing gate (overage paywall) returns null on iOS (src/components/PricingGate.tsx).
• The PremiumLockOverlay and PremiumPreviewCard tease components return null on iOS.
• The "Manage Plan" and "Get Started" buttons in the Nav are hidden on iOS.
• The "View Plans" CTA in the Auth modal is hidden on iOS; the pricing sub-view is unreachable in native.
• The PropertyForm's create-checkout call now forces mode='free' on iOS; the per-report and subscription paths cannot be invoked from the native client.
• The overage flow, which previously opened the PricingGate, now shows an informational message on iOS instead.

iOS users get one free report per device. After that, they are informed that additional reports are not available in this version of the app — no upgrade prompt, no external link, no paywall. This puts the iOS app fully outside Guideline 3.1.1.

═══════════════════════════════════════════
GUIDELINE 4.2 — MINIMUM FUNCTIONALITY
═══════════════════════════════════════════

The root of the app is no longer a WKWebView. We replaced PropertyDNABridgeViewController as the app's rootViewController with a real UITabBarController — see AppDelegate.swift didFinishLaunchingWithOptions. The first thing iOS shows the user is now native UI.

The four tabs:

1. HOME (HomeViewController.swift) — UIHostingController wrapping a SwiftUI view. Renders the brand surface, a quick-action LazyVGrid (Analyze / Scan / Saved / Heat Map) using SF Symbols, a recent-saved-reports list (driven by SavedReportsStore.swift which reads @capacitor/preferences data directly from UserDefaults), and an About card. No WebKit involved.

2. SEARCH — wraps PropertyDNABridgeViewController inside SearchTabContainerViewController so the Capacitor web layer can host the Analyze form, report views, blog, and dossier content. This is where dynamic content lives.

3. MAP (MapTabViewController.swift) — native MKMapView with Apple Maps tiles, native pinch-zoom, Standard/Satellite/Hybrid segmented control, native "find me" button using CLLocationManager, 3-D buildings, and points of interest. This is not a WebKit map.

4. ACCOUNT (AccountViewController.swift) — UIHostingController wrapping a SwiftUI view. Renders identity, preferences (haptics toggle, location toggle persisting to NSUserDefaults), settings list, and a danger-zone delete card. No WebKit involved.

The native tab bar is the *first* surface the user touches, every time they open the app. Three out of four tabs are pure native (no WebKit). Only the Search tab hosts the web view, because that's the appropriate surface for dynamic property reports.

CARRIED-OVER NATIVE CAPABILITIES (from Build 11):

• Vision OCR address scanner (AVCaptureSession + VNRecognizeTextRequest, on-device) — VisionScannerCoordinator.swift + VisionScannerViewController.swift.
• Native MKMapView modal for any report — NativeMapPresenter.swift + NativeMapViewController.swift.
• Siri shortcuts via App Intents (iOS 16+) — PropertyAppIntents.swift.
• Home Screen Quick Actions — Info.plist UIApplicationShortcutItems + QuickActionsHandler.swift.
• Core Spotlight indexing of saved reports — SpotlightIndexer.swift.

DEMO CREDENTIALS
Apple ID: ar_user235@icloud.com
Email magic-link: any valid address.

WHAT TO LOOK AT FIRST

1. Launch the app — observe the native tab bar at the bottom with four iOS tabs.
2. Tap Home — note that this is a SwiftUI dashboard, not a web page. Quick action tiles use SF Symbols; the layout uses native LazyVGrid.
3. Tap Map — native MKMapView with native iOS controls.
4. Tap Account — native SwiftUI list with iOS toggles.
5. Tap Search → Analyze → "Scan" — full-screen native AVCaptureSession with on-device Vision text recognition.

The Search tab is the only place a web view is visible, and even there the surrounding shell (status bar, tab bar) is native iOS.

Thank you for your time. We appreciate the careful review.

## Resolution Center Reply (paste in ASC UI)

Thank you for the review of Build 11.

3.1.1 — The "UPGRADE PRO" surface has been removed entirely from the iOS app. There is no path within the iOS app to purchase digital subscriptions, no in-app paywall, and no external payment links. iOS users get one free report per device; thereafter the app shows an informational message with no upgrade CTA. The Pricing modal, PricingGate, PremiumLockOverlay, PremiumPreviewCard, and the Nav's "Get Started" / "Manage Plan" buttons all return null on iOS.

4.2 — The app's rootViewController is now a real UITabBarController (NativeRootTabBarController.swift), installed programmatically in AppDelegate.didFinishLaunchingWithOptions. Three of the four tabs are pure native iOS:
• Home — SwiftUI dashboard (HomeViewController.swift)
• Map — MKMapView (MapTabViewController.swift)
• Account — SwiftUI settings (AccountViewController.swift)
The fourth tab (Search) hosts the web view for dynamic report content, but the surrounding shell — status bar, tab bar, navigation — is native iOS. WKWebView is no longer the root of the application.

These are architectural fixes, not surface-level adjustments. Source files referenced above are in app/frontend/ios/App/App/ alongside AppDelegate.swift.

Thank you for your time.
