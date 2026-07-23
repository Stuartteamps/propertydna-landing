// Pure bootstrap decision: given a saved token and the outcome of GET /auth/me, decide whether
// to keep the session or clear it. Extracted so it's unit-testable without the RN runtime.

export type MeOutcome =
  | { ok: true; onboarded: boolean }
  | { ok: false; status: number | null };

export interface BootstrapDecision {
  keepToken: boolean;
  onboarded: boolean;
  reason: "no-token" | "valid" | "unauthorized" | "network-error" | "other-error";
}

export function decideBootstrap(
  savedToken: string | null,
  me: MeOutcome | null,
): BootstrapDecision {
  if (!savedToken) return { keepToken: false, onboarded: false, reason: "no-token" };
  if (me === null) {
    // Genuine network error — keep the token so the user can retry rather than being logged out.
    return { keepToken: true, onboarded: false, reason: "network-error" };
  }
  if (me.ok) return { keepToken: true, onboarded: me.onboarded, reason: "valid" };
  if (me.status === 401 || me.status === 404) {
    // Expired / revoked / unknown user → clear the dead session so the app routes to /login.
    return { keepToken: false, onboarded: false, reason: "unauthorized" };
  }
  return { keepToken: true, onboarded: false, reason: "other-error" };
}
