# Build 11 — Resubmission Notes (after Build 10 4.2 rejection)

Build 10 was rejected under Guideline 4.2 with Apple's note that "push notifications, Core Location, or sharing do not provide a robust enough experience." Build 11 adds **substantial native iOS code** beyond webview features:

## What's New in This Version (≤4,000 chars; ASC versionString)

PropertyDNA is now a fully native iOS app with on-device AI, native MapKit, and Siri integration — built for the field.

NEW IN BUILD 11
• Vision OCR Address Scanner — point your camera at a property sign or address; Apple's Vision framework recognizes the text on-device and fills the form for you. No typing.
• Native MapKit View — tap "Open in Maps" on any report to see the property on a full-screen native Apple Maps view with Standard / Satellite / Hybrid, 3-D buildings, and one-tap Directions.
• Siri Shortcuts — "Hey Siri, analyze a property with PropertyDNA" or "show my saved reports" — works from the lock screen, AirPods, or CarPlay.
• Home Screen Quick Actions — long-press the app icon for one-tap Analyze, Saved Reports, Dashboard, or Heat Map.
• Spotlight Search — your saved reports appear in iOS Spotlight when you pull down on the home screen. Find a property without opening the app.

CARRIED OVER
• Native bottom tab bar with haptic feedback
• Offline reports saved to your device automatically
• "Use my location" for one-tap form prefill
• Native share sheet for any report
• Offline banner when you lose signal

WHY THIS MATTERS
The fight isn't between buyer and home — it's between buyer and information. PropertyDNA puts institutional-grade intelligence in your pocket so you walk into every showing knowing more than the agent across the table.

## Promotional Text (≤170 chars)

On-device Vision OCR, native MapKit, Siri shortcuts, offline reports, Spotlight search — PropertyDNA is the native iOS app for buyers and sellers in the field.

## App Review Notes (private — Apple reviewer only)

PROPERTYDNA BUILD 11 — RESPONSE TO 4.2 REJECTION OF BUILD 10

Apple's prior note on Build 10 stated that "push notifications, Core Location, or sharing do not provide a robust enough experience." We agree, and Build 11 adds substantial native iOS code — not webview features — to address this directly. Each of the items below is implemented in native Swift in the App target, not in JavaScript:

1. VISION OCR ADDRESS SCANNER — On the Analyze form, tap the "Scan" button next to the address field. A full-screen native AVCaptureSession opens with a yellow targeting reticle. Apple's Vision framework (VNRecognizeTextRequest) runs on-device — no network, no third-party SDK — and detects U.S. street addresses in real time. When a match is recognized the camera dismisses and the address fills the form. Source: VisionScannerCoordinator.swift, VisionScannerViewController.swift.

2. NATIVE MAPKIT VIEW — On any report with coordinates, tap "Open in Maps". A full-screen MKMapView opens with Apple's native map tiles, 3-D buildings, segmented Standard/Satellite/Hybrid selector, and a Directions button that hands off to Apple Maps for routing. This replaces the web Leaflet map for a genuinely native experience. Source: NativeMapPresenter.swift.

3. SIRI SHORTCUTS via APP INTENTS — Four AppIntent declarations (Analyze Property, Saved Reports, Dashboard, Heat Map) registered via PropertyDNAShortcuts (iOS 16 AppShortcutsProvider). They appear in the Shortcuts app and Siri suggestions. Test: "Hey Siri, analyze a property with PropertyDNA." Source: PropertyAppIntents.swift.

4. HOME SCREEN QUICK ACTIONS — Four UIApplicationShortcutItems declared in Info.plist (Analyze, Saved, Dashboard, Heat Map). Long-press the app icon to invoke. Source: QuickActionsHandler.swift, AppDelegate.swift.

5. CORE SPOTLIGHT INDEXING — Reports the user views are indexed via CSSearchableIndex with the address as title and DNA score in the description. Pull down on the iOS home screen, type a property address, and the saved report appears in Spotlight results. Tapping the result deep-links into the app. Source: SpotlightIndexer.swift.

DEMO CREDENTIALS
Apple ID: ar_user235@icloud.com (worked in Build 8 review)
Email magic-link: any valid email — link arrives via Resend.

HOW TO VERIFY THE NATIVE FEATURES
- Vision Scanner: Open Analyze → tap "Scan" → point at any address on paper or sign → it autofills.
- MapKit: Generate any report → scroll to "Sales Activity Map" → tap "Open in Maps".
- Siri: Hold the side button → "Analyze a property with PropertyDNA" → opens to /analyze.
- Quick Actions: Long-press the home screen icon.
- Spotlight: View a report (any) → exit to home screen → pull down → type the address.

The native Swift source files for these features are in the App target alongside AppDelegate.swift. They are not webview wrappers.

Thank you for your time.

## Resolution Center Reply (paste in ASC UI)

Thank you for the previous review.

Build 11 adds substantial native iOS code in direct response to the 4.2 feedback. The following features are implemented in native Swift in the App target — not in the web layer:

1. VISION OCR ADDRESS SCANNER — Apple Vision framework runs on-device text recognition through AVCaptureSession to scan property addresses from signs or paper. The reviewer can test this by opening the Analyze form and tapping "Scan" next to the address field.

2. NATIVE MAPKIT VIEW — Replaces the web map with a real MKMapView (Apple Maps tiles, 3-D buildings, satellite/hybrid toggle, native Directions). Tap "Open in Maps" on any report with coordinates.

3. SIRI SHORTCUTS — Four AppIntent declarations registered with AppShortcutsProvider (iOS 16). "Hey Siri, analyze a property with PropertyDNA" opens the app to the analyze form.

4. HOME SCREEN QUICK ACTIONS — Long-press the app icon for one-tap Analyze, Saved Reports, Dashboard, Heat Map.

5. CORE SPOTLIGHT INDEXING — Saved reports appear in iOS Spotlight pull-down search by address.

These are not features that could be implemented as a web page. Vision text recognition runs on the device's Neural Engine; MapKit is Apple's native map renderer; AppIntents requires iOS 16's compile-time intent metadata; UIApplicationShortcutItems is a Home Screen iOS surface; Core Spotlight indexes into the iOS-system database.

Thank you for your time. We appreciate the careful review.
