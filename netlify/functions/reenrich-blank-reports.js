/**
 * reenrich-blank-reports — one-off repair sweep for reports with blank details.
 *
 * Reports generated while RentCast was dead AND the property_master/properties
 * fallback couldn't resolve the subject were stored status='completed' with an
 * all-null normalized.property (blank beds/baths/sqft/year/type in the grid).
 * recover-stuck-reports only re-fires status='pending' rows, so these frozen
 * completed rows never self-heal. This endpoint finds them and RE-FIRES the
 * exact enrich-report payload with the row's own reportId + view_token, so
 * save-report UPDATES the row in place — the emailed share link is preserved
 * and no duplicate row is created.
 *
 * SAFE by design:
 *   - Auth: requires x-internal-key = INTERNAL_API_KEY.
 *   - dryRun defaults TRUE — the first call only counts/lists blanks.
 *   - Only rows whose stored details are genuinely blank are re-fired; rows that
 *     already have any detail are skipped (idempotent — re-running never touches
 *     a good report).
 *   - Batched + spaced so we never burst enrich-report / CREST.
 *   - Offset pagination drains the backlog in controlled passes; loop until done.
 *
 * POST /.netlify/functions/reenrich-blank-reports
 *   Headers: x-internal-key: <INTERNAL_API_KEY>
 *   Body (all optional): { scanLimit=100, scanOffset=0, limit=10, spaceMs=1500, dryRun=true }
 * Returns: { ok, dryRun, scanned, blanksFound, retriggered, nextOffset, done, reports:[...] }
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const ENRICH_URL = `${APP_BASE}/.netlify/functions/enrich-report`;

// A value counts as "present" only if it's a real, non-placeholder value. The
// pipeline stores nulls for unknowns, but older rows may carry '' or '—'.
function has(v) {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "—" && s !== "0" && s.toLowerCase() !== "null";
}

// True when a report's stored subject details are effectively empty — the exact
// condition that renders a blank details grid. We treat the report as blank only
// if NONE of the core characteristics are present.
function detailsAreBlank(reportData) {
  let dna = reportData;
  if (typeof dna === "string") { try { dna = JSON.parse(dna); } catch { return false; } }
  if (!dna || typeof dna !== "object") return false;      // no data at all → leave to recover-stuck
  const p = (dna.normalized && dna.normalized.property) || {};
  return !(has(p.beds) || has(p.baths) || has(p.sqft) || has(p.yearBuilt) || has(p.propertyType) || has(p.lotSize));
}

// Re-fire enrichment with the SAME payload shape queue-report uses. enrich-report
// runs to completion in its own Lambda and calls save-report, which matches the
// existing row on viewToken/reportId and UPDATES in place. Resolve on response or
// on flush (202) so a slow enrich never blocks the batch.
function fireEnrichment(payload) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    const body = JSON.stringify(payload);
    const url = new URL(ENRICH_URL);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-internal-key": process.env.INTERNAL_API_KEY || "",
    };
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: "POST", headers },
      (res) => { res.on("data", () => {}); res.on("end", () => done({ status: res.statusCode, completed: true })); }
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
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // Params come from the JSON body (POST) or the query string (GET, so the owner
  // can trigger it straight from a phone browser like the backtest endpoint).
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* defaults */ }
  const q = event.queryStringParameters || {};
  const pick = (k) => (body[k] !== undefined ? body[k] : q[k]);

  // Auth — this endpoint TRIGGERS re-enrichment, so enforce the internal key.
  // Accept it via header OR ?key= (GET convenience).
  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"] || q.key;
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "INTERNAL_API_KEY not configured" }) };
  if (internalKey !== expectedKey) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };

  const scanLimit  = Math.min(Number(pick("scanLimit") ?? 100), 500);  // rows examined per call
  const scanOffset = Math.max(Number(pick("scanOffset") ?? 0), 0);     // pagination cursor
  const limit      = Math.min(Number(pick("limit") ?? 10), 25);        // max re-fires per call (no burst)
  const spaceMs    = Number(pick("spaceMs") ?? 1500);                  // spacing between re-fires
  // SAFE default: count only. Must pass dryRun=false (or 0/no) to actually re-fire.
  const dryRunRaw  = pick("dryRun");
  const dryRun     = dryRunRaw === undefined ? true : !(dryRunRaw === false || dryRunRaw === "false" || dryRunRaw === "0" || dryRunRaw === "no");

  let rows;
  try {
    rows = await db.from("property_reports")
      .select("id,email,address,city,state,zip,full_address,role,view_token,report_data,status,created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(scanLimit)
      .offset(scanOffset)
      .get();
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `query failed: ${e.message}` }) };
  }

  const scanned = Array.isArray(rows) ? rows : [];
  const blanks = scanned.filter((r) => detailsAreBlank(r.report_data));
  const done = scanned.length < scanLimit;              // no more rows past this page
  const nextOffset = scanOffset + scanned.length;

  if (dryRun) {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true, dryRun: true, scanned: scanned.length, blanksFound: blanks.length,
        retriggered: 0, nextOffset, done,
        reports: blanks.slice(0, limit).map((r) => ({ id: r.id, email: r.email, address: r.full_address || r.address })),
      }),
    };
  }

  const toFire = blanks.slice(0, limit);
  const results = [];
  for (const r of toFire) {
    const payload = {
      fullName: "", email: r.email, phone: "", role: r.role || "Buyer",
      address: r.address || "", city: r.city || "", state: r.state || "", zip: r.zip || "",
      notes: "", propertyType: "",
      stripeSessionId: "reenrich", paid: true,
      viewToken: r.view_token,   // save-report matches the existing row on this → no dupes, link preserved
      reportId: r.id,
      leadSource: "blank_report_reenrich",
      pageUrl: APP_BASE, timestamp: new Date().toISOString(),
    };
    const res = await fireEnrichment(payload);
    const ok = res && (res.status === 200 || res.status === 202);
    results.push({ id: r.id, email: r.email, address: r.full_address || r.address, retriggered: ok, enrichStatus: res?.status ?? 0 });
    db.kpi("blank_report_reenriched", r.email, { reportId: r.id, address: r.full_address, enrichStatus: res?.status ?? 0, ok });
    if (spaceMs > 0) await new Promise((rs) => setTimeout(rs, spaceMs));
  }

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: true, dryRun: false,
      scanned: scanned.length, blanksFound: blanks.length,
      retriggered: results.filter((r) => r.retriggered).length,
      nextOffset, done, reports: results,
    }),
  };
};
