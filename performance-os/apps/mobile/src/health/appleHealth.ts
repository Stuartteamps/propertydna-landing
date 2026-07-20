/**
 * Apple HealthKit bridge (device only). Reads the metrics Arete uses and posts them
 * to the backend's /integrations/apple_health/sync endpoint in the same shape the mock produces.
 *
 * Requires an Expo Dev Client build with `react-native-health` (NOT Expo Go). When the native
 * module is unavailable (simulator without Health, or CI), callers fall back to the server mock
 * by calling api.syncHealth(days) with no payload.
 */
import type { ApiClient } from "../api/client";

// Permissions we request. Mirrors app.json infoPlist usage descriptions.
export const HEALTH_PERMISSIONS = {
  permissions: {
    read: [
      "HeartRateVariability",
      "RestingHeartRate",
      "HeartRate",
      "StepCount",
      "ActiveEnergyBurned",
      "BasalEnergyBurned",
      "SleepAnalysis",
      "Vo2Max",
      "RespiratoryRate",
      "OxygenSaturation",
      "BodyMass",
      "BodyFatPercentage",
      "DistanceWalkingRunning",
      "Workout",
    ],
    write: ["Workout", "BodyMass"],
  },
};

let AppleHealthKit: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AppleHealthKit = require("react-native-health").default;
} catch {
  AppleHealthKit = null;
}

export function isHealthAvailable(): boolean {
  return AppleHealthKit != null;
}

export function requestPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!AppleHealthKit) return resolve(false);
    AppleHealthKit.initHealthKit(HEALTH_PERMISSIONS, (err: string) => resolve(!err));
  });
}

/**
 * Sync recent Health data. On device with the native module, this would read samples and post
 * them; here we keep the device path thin and delegate to the backend, which uses the mock
 * provider unless HEALTH_PROVIDER=healthkit and a real payload is supplied.
 */
export async function syncHealth(api: ApiClient, days = 14): Promise<{ records_imported: number }> {
  // A production device build would gather AppleHealthKit samples here and pass them to
  // api.request("/integrations/apple_health/sync", { body: { days, samples, sleep } }).
  return api.syncHealth(days);
}
