# Mobile Build Guide

The mobile app is **Expo + TypeScript + expo-router + NativeWind** in `apps/mobile`, with five
tabs (Today, Nutrition, Training, Trends, Profile). This guide covers building and running it,
including the parts that require a native build.

Prerequisites: Node 22, a Mac with Xcode 15+ for iOS, and the backend running (see
[../SETUP.md](../SETUP.md)).

---

## Expo Go vs. Expo Dev Client

| | Expo Go | Expo Dev Client (custom dev build) |
|-|---------|------------------------------------|
| Install | App Store app | You build & install it |
| Native modules | Only what's bundled in Go | **Any** native module you add |
| HealthKit (`react-native-health`) | ❌ not available | ✅ |
| Camera (`expo-camera`) | ⚠️ limited | ✅ |
| Use it for | Quick JS/UI iteration | Anything touching Health/camera |

**Why HealthKit needs a Dev Client.** HealthKit access is provided by `react-native-health`,
which ships native iOS code and required `Info.plist` usage descriptions + the HealthKit
entitlement. Expo Go is a fixed prebuilt binary and cannot load arbitrary native modules, so
HealthKit simply isn't present there. You must create a **development build** (a custom client
that includes the native module) and install that on the simulator/device.

For pure JavaScript/UI work you can still use Expo Go against the mock backend — HealthKit and
camera features just won't function until you're on a Dev Client.

---

## Configure the API base URL

The app reads `EXPO_PUBLIC_API_URL`.

```bash
cd apps/mobile
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" >> .env
```

- iOS **simulator**: `http://localhost:8000` works.
- **Physical device**: use your Mac's LAN IP (e.g. `http://192.168.1.50:8000`); the phone and the
  backend must be on the same network. In production, use your `https://` API URL.

---

## Option A — Local native build with `expo run:ios`

Builds and installs a Dev Client on a simulator/device from your machine:

```bash
cd apps/mobile
npm install
npx expo run:ios                 # default simulator
npx expo run:ios --device        # a connected iPhone
```

Then start the dev server (if not already running) and open the Dev Client:

```bash
npx expo start --dev-client
```

## Option B — Cloud build with EAS

No local native toolchain juggling; EAS builds in the cloud.

```bash
npm install -g eas-cli           # or use npx eas
eas login
eas build:configure              # creates/updates eas.json (first time)

# Build a development client (internal distribution)
eas build --platform ios --profile development

# Install the resulting build on a registered device/simulator, then:
npx expo start --dev-client
```

Register a physical device for internal distribution:

```bash
eas device:create
```

For **production** builds and TestFlight, see [TESTFLIGHT.md](./TESTFLIGHT.md).

---

## Required iOS usage descriptions (`Info.plist`)

Configure these in `app.json` / `app.config.js` (under `ios.infoPlist`) or the plugin configs.
iOS **rejects the build at runtime** if a capability is used without its description string, and
App Review rejects submissions missing them.

| Key | Capability | Example string |
|-----|------------|----------------|
| `NSHealthShareUsageDescription` | Read HealthKit data | "Performance OS reads your sleep, HRV, heart rate, and activity to calculate readiness and nutrition targets." |
| `NSHealthUpdateUsageDescription` | Write HealthKit data | "Performance OS can save workouts you log back to Apple Health." |
| `NSCameraUsageDescription` | Camera (meal photos) | "Performance OS uses the camera to analyze photos of your meals." |
| `NSPhotoLibraryUsageDescription` | Pick photos | "Performance OS lets you attach food photos from your library." |
| `NSPhotoLibraryAddUsageDescription` | Save to library | "Performance OS can save meal photos to your library." |
| `NSMicrophoneUsageDescription` | Voice journal / voice log | "Performance OS uses the microphone for voice journal entries." |
| `NSUserNotificationsUsageDescription` | Local/push notifications | "Performance OS sends reminders for meals, hydration, workouts, and your morning summary." |

Also required for HealthKit: the **HealthKit entitlement** (`com.apple.developer.healthkit`) and
enabling the HealthKit capability for your App ID in the Apple Developer portal. With
`react-native-health`'s config plugin, add it to the plugins array so `expo prebuild` wires the
entitlement and Info.plist keys.

Example `app.json` sketch:

```jsonc
{
  "expo": {
    "ios": {
      "bundleIdentifier": "app.performanceos.mobile",
      "infoPlist": {
        "NSHealthShareUsageDescription": "…",
        "NSHealthUpdateUsageDescription": "…",
        "NSCameraUsageDescription": "…",
        "NSPhotoLibraryUsageDescription": "…",
        "NSMicrophoneUsageDescription": "…"
      }
    },
    "plugins": [
      "expo-router",
      "expo-camera",
      ["react-native-health", { "healthSharePermission": "…", "healthUpdatePermission": "…" }]
    ]
  }
}
```

> Bundle id placeholder: `app.performanceos.mobile` (also set as `APPLE_BUNDLE_IDENTIFIER` in
> `.env.example`). Change it to your own reverse-DNS id before shipping.

---

## Notes

- The app **cannot be launched in a headless CI container** (no iOS simulator). It typechecks and
  runs Jest component tests there; run it on a Mac/simulator.
- Keep the backend mock-first while developing UI; flip `HEALTH_PROVIDER`/`CALENDAR_PROVIDER` and
  wire the device bridges when testing real sync.

Related: [TESTFLIGHT.md](./TESTFLIGHT.md), [APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md),
[../SETUP.md](../SETUP.md).
