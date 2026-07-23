/**
 * ops-weekly-metrics — B-06
 *
 * Internal-only weekly funnel snapshot pulled STRAIGHT from Supabase.
 * NEVER fabricates numbers: any stage that only exists in GA4 (unique
 * visitors, landing views, report_viewed, purchase, return visits, share
 * clicks) is reported as the literal string "UNKNOWN — GA4 only". Any
 * Supabase table that is missing / errors degrades that single metric to
 * "UNKNOWN" instead of crashing the whole function.
 *
 * GET /.netlify/functions/ops-weekly-metrics?key=INTERNAL_API_KEY[&days=7]
 *   (or header x-internal-key: INTERNAL_API_KEY)
 *
 * Auth fails CLOSED: if INTERNAL_API_KEY is not set in the environment the
 * endpoint returns 401 for everyone.
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

const GA4_ONLY = "UNKNOWN — GA4 only";
const UNKNOWN = "UNKNOWN";

// KPI event names emitted server-side (see queue-report.js / enrich-report.js /
// get-reports.js). Only these come from Supabase; everything else is GA4.
const KPI_EVENTS = [
  "report_queued",
  "report_engine_completed",
  "report_insufficient_data",
  "dashboard_login",
];

// A payment row counts as a real conversion only once Stripe has confirmed it.
// verify-payment.js / stripe-webhook.js write status "paid".
const PAID_STATUS = "paid";

/**
 * Run a db query; on ANY failure (missing table, network, etc.) return null so
 * the caller can degrade that one metric to "UNKNOWN" rather than throwing.
 */
async function safeRows(runner) {
  try {
    const rows = await runner();
    return Array.isArray(rows) ? rows : null;
  } catch (err) {
    console.warn("[ops-weekly-metrics]", err && err.message ? err.message : String(err));
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // ── Auth — fail closed ────────────────────────────────────────────────
  const headers = event.headers || {};
  const q = event.queryStringParameters || {};
  const key = headers["x-internal-key"] || headers["X-Internal-Key"] || q.key;
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  // ── Window ────────────────────────────────────────────────────────────
  const days = Math.min(Math.max(parseInt(q.days || "7", 10) || 7, 1), 365);
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  // ── kpi_events (server-side funnel counters) ──────────────────────────
  const kpiRows = await safeRows(() =>
    db.from("kpi_events")
      .select("event_type")
      .gte("created_at", sinceIso)
      .in("event_type", KPI_EVENTS)
      .get()
  );
  let kpiCounts = null;
  if (kpiRows) {
    kpiCounts = {};
    for (const name of KPI_EVENTS) kpiCounts[name] = 0;
    for (const r of kpiRows) {
      if (r && Object.prototype.hasOwnProperty.call(kpiCounts, r.event_type)) {
        kpiCounts[r.event_type] += 1;
      }
    }
  }
  const kpiOf = (name) => (kpiCounts ? kpiCounts[name] : UNKNOWN);

  // ── property_reports (totals + status breakdown) ──────────────────────
  const reportRows = await safeRows(() =>
    db.from("property_reports")
      .select("status")
      .gte("created_at", sinceIso)
      .get()
  );
  let reports;
  if (reportRows) {
    const byStatus = {};
    for (const r of reportRows) {
      const s = (r && r.status) || "unknown";
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    reports = { total: reportRows.length, byStatus };
  } else {
    reports = { total: UNKNOWN, byStatus: UNKNOWN };
  }

  // ── payments (paid conversions + revenue) ─────────────────────────────
  const paymentRows = await safeRows(() =>
    db.from("payments")
      .select("amount,currency,status")
      .gte("created_at", sinceIso)
      .eq("status", PAID_STATUS)
      .get()
  );
  let payments;
  if (paymentRows) {
    let cents = 0;
    let currency = null;
    for (const p of paymentRows) {
      const amt = Number(p && p.amount);
      if (Number.isFinite(amt)) cents += amt;
      if (!currency && p && p.currency) currency = p.currency;
    }
    payments = {
      paidConversions: paymentRows.length,
      revenue: Math.round(cents) / 100, // Stripe amounts are integer minor units
      currency: currency || "usd",
    };
  } else {
    payments = { paidConversions: UNKNOWN, revenue: UNKNOWN, currency: UNKNOWN };
  }

  // ── subscriptions (currently active) ──────────────────────────────────
  // "Active subs" is a point-in-time count of live subscriptions, not a
  // windowed count, so it is filtered on status only (matches check-usage.js).
  const subRows = await safeRows(() =>
    db.from("subscriptions")
      .select("id")
      .eq("status", "active")
      .get()
  );
  const activeSubscriptions = subRows ? subRows.length : UNKNOWN;

  // New subscriptions created within the window (windowed, complementary).
  const newSubRows = await safeRows(() =>
    db.from("subscriptions")
      .select("id")
      .eq("status", "active")
      .gte("created_at", sinceIso)
      .get()
  );
  const newSubscriptions = newSubRows ? newSubRows.length : UNKNOWN;

  // ── Report completion rate (only if the underlying rows exist) ────────
  let reportCompletionRate = UNKNOWN;
  const queued = kpiOf("report_queued");
  const completed = kpiOf("report_engine_completed");
  if (typeof queued === "number" && typeof completed === "number" && queued > 0) {
    reportCompletionRate = Math.round((completed / queued) * 1000) / 1000;
  }

  // ── Funnel mapping (docs/founder-os/06-metrics-baseline.md) ───────────
  // Stages that are GA4-only are NEVER invented — they stay GA4_ONLY.
  const funnel = {
    "1_impression_landing": GA4_ONLY, // page_view — GA4
    "2_address_search_start": GA4_ONLY, // form_started / avm_result — GA4
    "3_valid_match": GA4_ONLY, // avm_result{matched} — GA4
    "4_report_requested": kpiOf("report_queued"), // server proxy: report_queued
    "5_report_generated": kpiOf("report_engine_completed"), // server: report_engine_completed
    "6_report_viewed_activation": GA4_ONLY, // report_viewed — GA4
    "7_save_account": kpiOf("dashboard_login"), // server proxy: dashboard_login
    "8_payment": payments.paidConversions, // payments table
    "9_return_visit": GA4_ONLY, // GA returning-user — GA4
    "10_referral_share": GA4_ONLY, // share_click — GA4
  };

  const body = {
    ok: true,
    generatedAt: now.toISOString(),
    window: { days, since: sinceIso, until: now.toISOString() },
    funnel,
    metrics: {
      kpiEvents: kpiCounts || UNKNOWN,
      reportCompletionRate,
      reports,
      payments,
      subscriptions: {
        active: activeSubscriptions,
        newInWindow: newSubscriptions,
      },
    },
    notes: [
      "Values sourced only from Supabase. 'UNKNOWN — GA4 only' stages require GA4 (G-S09N9KX1D6) and are never fabricated here.",
      "'UNKNOWN' means the underlying Supabase table was unavailable or held no rows to compute the metric.",
      "report_completion_rate = report_engine_completed / report_queued over the window (kpi_events).",
    ],
  };

  return { statusCode: 200, headers: CORS, body: JSON.stringify(body, null, 2) };
};
