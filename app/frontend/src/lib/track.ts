// Centralized GA4 event helper.
//
// The global `window.pdnaTrack` is defined in index.html and forwards to
// gtag() (respecting the `__pdnaSkipGA` opt-out). Historically each caller
// re-implemented the same `window.pdnaTrack?.(...)` try/catch inline
// (PropertyForm.tsx, etc.). This module is the single typed entry point so
// new instrumentation is consistent and greppable.
//
// Never pass PII (email, full address, name) as event params — GA4 forbids it
// and it is a privacy risk. Pass only coarse, non-identifying signals.

type TrackParams = Record<string, string | number | boolean | undefined | null>;

interface PdnaWindow {
  pdnaTrack?: (name: string, params?: TrackParams) => void;
}

/**
 * Fire a GA4 event. Safe to call anywhere — no-ops if analytics is disabled,
 * blocked, or not yet loaded. Never throws.
 */
export function track(name: string, params?: TrackParams): void {
  try {
    (window as unknown as PdnaWindow).pdnaTrack?.(name, params);
  } catch {
    /* analytics must never break the app */
  }
}
