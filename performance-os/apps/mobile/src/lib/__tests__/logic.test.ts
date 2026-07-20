import { ApiClient, ApiError } from "../../api/client";
import { fmtHours, fmtNum, mmss, confidenceLabel } from "../format";
import { bandFromScore, colorForScore, readinessLabel } from "../readiness";
import { clampPct, macroProgress, sumItems } from "../nutrition";

describe("readiness helpers", () => {
  test("bandFromScore thresholds", () => {
    expect(bandFromScore(85)).toBe("green");
    expect(bandFromScore(60)).toBe("yellow");
    expect(bandFromScore(40)).toBe("red");
    expect(bandFromScore(null)).toBe("unknown");
  });
  test("color + label follow band", () => {
    expect(colorForScore(90)).toBe("#2FBF71");
    expect(readinessLabel("red")).toMatch(/recovery/i);
    expect(readinessLabel("unknown")).toMatch(/data/i);
  });
});

describe("nutrition helpers", () => {
  test("clampPct clamps to 0..100", () => {
    expect(clampPct(50, 100)).toBe(50);
    expect(clampPct(300, 100)).toBe(100);
    expect(clampPct(10, 0)).toBe(0);
  });
  test("macroProgress computes remaining + pct", () => {
    const rows = macroProgress(
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, fiber_g: 30 },
      { calories: 1000, protein_g: 90, carbs_g: 100, fat_g: 20, fiber_g: 8 },
    );
    const protein = rows.find((r) => r.key === "protein_g")!;
    expect(protein.remaining).toBe(60);
    expect(protein.pct).toBe(60);
  });
  test("sumItems totals food items", () => {
    const totals = sumItems([
      { calories: 200, protein_g: 30, carbohydrates_g: 0, fat_g: 5, fiber_g: 0 },
      { calories: 150, protein_g: 5, carbohydrates_g: 30, fat_g: 1, fiber_g: 4 },
    ]);
    expect(totals.calories).toBe(350);
    expect(totals.carbs_g).toBe(30);
    expect(totals.fiber_g).toBe(4);
  });
});

describe("format helpers", () => {
  test("fmtNum and fmtHours", () => {
    expect(fmtNum(null)).toBe("—");
    expect(fmtNum(1234)).toBe("1,234");
    expect(fmtHours(7.5)).toBe("7h 30m");
  });
  test("mmss and confidenceLabel", () => {
    expect(mmss(75)).toBe("1:15");
    expect(mmss(-5)).toBe("0:00");
    expect(confidenceLabel(0.86)).toBe("High");
    expect(confidenceLabel(0.5)).toBe("Low");
  });
});

describe("ApiClient", () => {
  const okJson = (body: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

  test("attaches bearer token and hits /api base", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return okJson({ score: 72 });
    }) as unknown as typeof fetch;

    const client = new ApiClient(() => "tok123", "http://api.test");
    await client.getReadiness("2026-07-20");
    expect(calls[0].url).toBe("http://api.test/api/readiness?on=2026-07-20");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  test("throws ApiError with detail on non-ok", async () => {
    global.fetch = (() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ detail: "Invalid credentials" }),
      } as Response)) as unknown as typeof fetch;

    const client = new ApiClient(() => null, "http://api.test");
    await expect(client.login("a@b.com", "x")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Invalid credentials",
    });
    expect(new ApiError(500, "boom").status).toBe(500);
  });
});
