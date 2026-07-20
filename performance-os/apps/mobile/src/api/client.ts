// Typed API client. Framework-agnostic (uses global fetch) so it is unit-testable
// without the React Native runtime. Token access is injected via a TokenProvider.

import type { Dashboard, FoodAnalysis, Routine, TokenResponse } from "./types";

export const API_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://localhost:8000";

export type TokenProvider = () => string | null | Promise<string | null>;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export class ApiClient {
  base: string;
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider, base: string = API_BASE) {
    this.base = base.replace(/\/$/, "");
    this.getToken = getToken;
  }

  private async headers(json = true): Promise<Record<string, string>> {
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    const token = await this.getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}/api${path}`, {
      ...opts,
      headers: { ...(await this.headers(!(opts.body instanceof FormData))), ...(opts.headers || {}) },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = (body && (body.detail || body.message)) || detail;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, String(detail));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---- auth ----
  login(email: string, password: string) {
    return this.request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }
  register(email: string, password: string) {
    return this.request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // ---- onboarding / profile ----
  submitOnboarding(payload: Record<string, unknown>) {
    return this.request<{ ok: boolean; onboarded: boolean }>("/profile/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  getProfile() {
    return this.request<Record<string, unknown>>("/profile");
  }

  // ---- dashboard ----
  getDashboard(on?: string) {
    return this.request<Dashboard>(`/dashboard/today${on ? `?on=${on}` : ""}`);
  }

  // ---- meals ----
  async analyzeMeal(file: { uri: string; name?: string; type?: string }, mealType?: string) {
    const form = new FormData();
    // React Native FormData accepts { uri, name, type }.
    form.append("file", { uri: file.uri, name: file.name ?? "meal.jpg", type: file.type ?? "image/jpeg" } as unknown as Blob);
    if (mealType) form.append("meal_type", mealType);
    return this.request<FoodAnalysis>("/meals/analyze", { method: "POST", body: form });
  }
  saveMeal(payload: Record<string, unknown>) {
    return this.request<{ id: string; totals_today: Record<string, number> }>("/meals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  listMeals(on?: string) {
    return this.request<{ meals: unknown[] }>(`/meals${on ? `?on=${on}` : ""}`);
  }

  // ---- workouts ----
  listWorkouts() {
    return this.request<{ workouts: unknown[] }>("/workouts");
  }
  createWorkout(payload: Record<string, unknown>) {
    return this.request<{ id: string; deduped: boolean }>("/workouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  weeklyTraining() {
    return this.request<Record<string, number>>("/workouts/weekly-summary");
  }

  // ---- integrations ----
  connect(provider: "apple_health" | "google_calendar") {
    return this.request(`/integrations/${provider}/connect`, { method: "POST" });
  }
  syncHealth(days = 14) {
    return this.request<{ records_imported: number }>("/integrations/apple_health/sync", {
      method: "POST",
      body: JSON.stringify({ days }),
    });
  }
  importCalendar(days = 7) {
    return this.request<{ events_imported: number; workouts_created: number }>(
      "/integrations/google_calendar/import",
      { method: "POST", body: JSON.stringify({ days }) },
    );
  }
  integrationStatus() {
    return this.request<Record<string, unknown>>("/integrations/status");
  }

  // ---- routine ----
  getRoutine(on?: string) {
    return this.request<Routine>(`/routine/today${on ? `?on=${on}` : ""}`);
  }
  completeRoutine(id: string) {
    return this.request<{ completed: boolean }>(`/routine/${id}/complete`, { method: "POST" });
  }

  // ---- readiness / journal / recovery / labs / trends ----
  getReadiness(on?: string) {
    return this.request<Record<string, unknown>>(`/readiness${on ? `?on=${on}` : ""}`);
  }
  saveJournal(payload: Record<string, unknown>) {
    return this.request<{ id: string }>("/journal", { method: "POST", body: JSON.stringify(payload) });
  }
  logSauna(payload: Record<string, unknown>) {
    return this.request<{ id: string }>("/recovery/sauna", { method: "POST", body: JSON.stringify(payload) });
  }
  logColdPlunge(payload: Record<string, unknown>) {
    return this.request<{ id: string }>("/recovery/cold-plunge", { method: "POST", body: JSON.stringify(payload) });
  }
  trendSeries(metric: string, days = 30) {
    return this.request<{ metric: string; points: { date: string; value: number }[] }>(
      `/trends/series?metric=${metric}&days=${days}`,
    );
  }
  weeklyReport() {
    return this.request<Record<string, unknown>>("/trends/weekly-report");
  }
}
