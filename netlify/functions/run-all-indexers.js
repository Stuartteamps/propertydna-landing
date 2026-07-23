/**
 * run-all-indexers — the orchestrator that drives every parcel indexer 24/7.
 *
 * WHY THIS EXISTS: each indexer requires POST + x-internal-key, but the Netlify
 * scheduler doesn't send that header — so scheduling the indexers directly just
 * 401'd and nothing ran. Instead this ONE scheduled orchestrator fires each
 * indexer WITH the internal key (which it has in its own env), so their existing
 * auth passes unchanged and no per-indexer edits are needed. Every indexer
 * resumes from its own kpi_events checkpoint and upserts by APN (idempotent), so
 * firing repeatedly simply advances the catch-up toward the full national index.
 *
 * Each indexer is an "agent" with a measurable goal (its county/state parcel
 * total); watch them all via /.netlify/functions/index-progress.
 *
 * Scheduled hourly (netlify.toml) for continuous 24/7 catch-up. Trigger manually
 * to kickstart or burst — phone-friendly GET with ?key=:
 *   /.netlify/functions/run-all-indexers?key=INTERNAL_API_KEY
 *   optional: &batchSize=1000  &only=index-georgia,index-vegas  &spaceMs=0
 */
const https = require("https");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};
const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");

// Every parcel/sold indexer. Fired with no city/county → each auto-resumes from
// its checkpoint (picks the next incomplete target). Add new indexers here.
const INDEXERS = [
  "index-properties", "index-maricopa", "index-lacounty", "index-orangecounty", "index-sandiego",
  "index-vegas", "index-reno", "index-seattle", "index-florida", "index-connecticut",
  "index-newyork", "index-newjersey", "index-virginia", "index-northcarolina", "index-southcarolina",
  "index-georgia", "index-tennessee", "index-massachusetts", "index-maryland", "index-dc",
  "index-coloradoluxury", "index-utahluxury", "index-wyomingluxury", "index-tahoeluxury", "index-luxury",
  "ingest-rivco-parcels", "pull-solds", "pull-solds-rivco",
];

// Fire one indexer, fire-and-forget: it runs to completion in its own Lambda and
// checkpoints to kpi_events regardless of whether we wait. Resolve on response
// or on flush so a slow indexer never blocks the orchestrator's own timeout.
function fire(name, payload) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };
    const body = JSON.stringify(payload);
    const u = new URL(`${APP_BASE}/.netlify/functions/${name}`);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "x-internal-key": process.env.INTERNAL_API_KEY || "" } },
      (res) => { res.on("data", () => {}); res.on("end", () => done({ name, status: res.statusCode })); }
    );
    req.on("error", (e) => done({ name, status: 0, error: e.message }));
    req.on("finish", () => setTimeout(() => done({ name, status: 202, sent: true }), 400));
    req.setTimeout(28000, () => { req.destroy(); done({ name, status: 0, error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const q = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* defaults */ }

  // Netlify cron invocations carry `next_run` and DON'T send the internal key.
  const isScheduled = !!body.next_run;
  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"] || q.key;
  if (!isScheduled && process.env.INTERNAL_API_KEY && key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const batchSize = Math.min(Number(q.batchSize ?? body.batchSize ?? 1000), 2000);
  const only = String(q.only ?? body.only ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = only.length ? INDEXERS.filter((n) => only.includes(n)) : INDEXERS;

  // Fire all in parallel — each runs in its own Lambda; the orchestrator just
  // kicks them off and returns fast.
  const results = await Promise.all(list.map((name) => fire(name, { batchSize })));
  const ok = results.filter((r) => r.status === 200 || r.status === 202).length;

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({ ok: true, scheduled: isScheduled, batchSize, fired: list.length, accepted: ok, results }),
  };
};
