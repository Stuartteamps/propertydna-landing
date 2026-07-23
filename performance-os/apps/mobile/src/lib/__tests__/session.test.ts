import { decideBootstrap } from "../session";

describe("decideBootstrap (audit #10)", () => {
  test("no saved token → no session", () => {
    expect(decideBootstrap(null, null)).toMatchObject({ keepToken: false, reason: "no-token" });
  });

  test("valid /auth/me → keep token, carry onboarded", () => {
    expect(decideBootstrap("tok", { ok: true, onboarded: true })).toEqual({
      keepToken: true, onboarded: true, reason: "valid",
    });
  });

  test("expired token (401) → clear session so app routes to /login (not onboarding)", () => {
    expect(decideBootstrap("tok", { ok: false, status: 401 })).toMatchObject({
      keepToken: false, onboarded: false, reason: "unauthorized",
    });
  });

  test("unknown user (404) → clear session", () => {
    expect(decideBootstrap("tok", { ok: false, status: 404 }).keepToken).toBe(false);
  });

  test("network error → keep token for retry (do not log out)", () => {
    expect(decideBootstrap("tok", null)).toMatchObject({
      keepToken: true, reason: "network-error",
    });
  });

  test("server 500 → keep token (transient), stay cautious on onboarding", () => {
    expect(decideBootstrap("tok", { ok: false, status: 500 })).toMatchObject({
      keepToken: true, reason: "other-error",
    });
  });
});
