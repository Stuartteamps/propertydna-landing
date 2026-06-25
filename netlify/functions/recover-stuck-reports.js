/**
 * recover-stuck-reports — self-healing sweep for the report pipeline.
 *
 * A "stuck" report is a property_reports row still status=pending after n8n
 * should have called save-report back. Root cause is almost always a transient
 * n8n cold-start / timeout during queue-report's fire-and-forget enrichment
 * (see queue-report.js fireN8n) — the row is created and the user already has
 * their view link, but enrichment never completed, so the report sits empty.
 *
 * This endpoint finds those rows and RE-FIRES the exact same n8n enrichment
 * payload. It is SAFE to run repeatedly: save-report.js matches the existing
 * pending row by reportId/viewToken and UPDATES it in place (preserving the
 * emailed view_token), so re-firing never creates duplicate rows.
 *
 * Invoked by the health-monitor routine when its report-queue / n8n checks
 * fail, and can also run on its own light cron. The Supabase service key and
 * n8n URL stay server-side here — the caller only needs the internal key.
 *
 * POST /.netlify/functions/recover-stuck-reports
 *   Headers: x-internal-key: <INTERNAL_API_KEY>
 *   Body (all optional): { minAgeMinutes=8, maxAgeHours=24, limit=25, dryRun=false }
 * Returns: { ok, scanned, stuck, retriggered, dryRun, reports:[...] }
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const N8N_URL = process.env.N8N_WEBHOOK_URL || "https://dillabean.app.n8n.cloud/webhook/homefax/report";
const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");

// Re-fire the n8n enrichment webhook with the SAME payload shape queue-report
// uses. We wait for the response (n8n cold-starts ~18-22s) up to 30s so we can
// report a real status, but a 202/finish is also success — n8n calls back to
// save-report asynchronously regardless.
function fireN8n(payload) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };

    const body = JSON.stringify(payload);
    const url = new URL(N8N_URL);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => done({ status: res.statusCode, completed: true }));
      }
    );
    req.on("error", (e) => done({ status: 0, error: e.message }));
    req.on("finish", () => setTimeout(() => done({ status: 202, sent: true }), 250));
    req.setTimeout(30000, () => { req.destroy(); done({ status: 0, error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // Auth — this endpoint TRIGGERS actions, so enforce the internal key when set.
  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (expectedKey && internalKey !== expectedKey) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* defaults */ }

  const minAgeMinutes = Number(body.minAgeMinutes ?? 8);   // give n8n time to finish normally
  const maxAgeHours   = Number(body.maxAgeHours ?? 24);    // don't resurrect ancient dead rows
  // THROTTLED 2026-06-25: a 25-wide burst overwhelmed the n8n cloud instance +
  // tripped RentCast 429s, crashing the workflow and auto-deactivating it.
  // Small batch + spacing between re-fires so n8n drains gently, never bursts.
  const limit         = Math.min(Number(body.limit ?? 3), 10);   // small batch = no burst (key fix)
  const spaceMs       = Number(body.spaceMs ?? 1500);            // light spacing; stays under fn timeout
  const dryRun        = !!body.dryRun;

  const now = Date.now();
  const olderThan = new Date(now - minAgeMinutes * 60 * 1000).toISOString();
  const newerThan = new Date(now - maxAgeHours * 60 * 60 * 1000).toISOString();

  let rows;
  try {
    // Stuck = pending, old enough that n8n should have called back, but recent
    // enough to be worth recovering. Oldest first.
    rows = await db.from("property_reports")
      .select("id,email,address,city,state,zip,full_address,role,view_token,status,created_at")
      .eq("status", "pending")
      .lte("created_at", olderThan)
      .gte("created_at", newerThan)
      .order("created_at", { ascending: true })
      .limit(limit)
      .get();
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `query failed: ${e.message}` }) };
  }

  const stuck = Array.isArray(rows) ? rows : [];

  if (dryRun) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true, dryRun: true, scanned: stuck.length, stuck: stuck.length, retriggered: 0,
        reports: stuck.map(r => ({ id: r.id, email: r.email, address: r.full_address || r.address, ageMin: Math.round((now - Date.parse(r.created_at)) / 60000) })),
      }),
    };
  }

  const results = [];
  for (const r of stuck) {
    const payload = {
      fullName: "",
      email: r.email,
      phone: "",
      role: r.role || "Buyer",
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      zip: r.zip || "",
      notes: "",
      propertyType: "",
      stripeSessionId: "recovery",
      paid: true,
      viewToken: r.view_token,   // save-report matches the existing row on this → no dupes
      reportId: r.id,
      leadSource: "stuck_report_recovery",
      pageUrl: APP_BASE,
      timestamp: new Date().toISOString(),
    };
    const res = await fireN8n(payload);
    const ok = res && (res.status === 200 || res.status === 202);
    results.push({
      id: r.id,
      email: r.email,
      address: r.full_address || r.address,
      ageMin: Math.round((now - Date.parse(r.created_at)) / 60000),
      retriggered: ok,
      n8nStatus: res?.status ?? 0,
    });
    db.kpi("stuck_report_recovered", r.email, { reportId: r.id, address: r.full_address, n8nStatus: res?.status ?? 0, ok });
    // Space out re-fires so we never burst the n8n cloud instance / RentCast.
    if (spaceMs > 0) await new Promise(rs => setTimeout(rs, spaceMs));
  }

  const retriggered = results.filter(r => r.retriggered).length;
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      dryRun: false,
      scanned: stuck.length,
      stuck: stuck.length,
      retriggered,
      reports: results,
    }),
  };
};
