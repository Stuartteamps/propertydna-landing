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
