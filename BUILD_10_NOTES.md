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
