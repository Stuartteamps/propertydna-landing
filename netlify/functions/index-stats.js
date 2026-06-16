/**
 * index-stats.js — public, accurate, live index counts for the site.
 *
 * The landing page used an anon-key Supabase query that RLS silently zeroed
 * (→ stale fallbacks) and filtered by 2-letter state codes while the data has
 * mixed formats ('CA' AND 'California'), so it undercounted badly. This runs
 * server-side with the SERVICE key (RLS bypassed) and counts exactly, handling
 * both state formats. Result cached in warm-instance memory for 1 hour.
 *
 * GET /.netlify/functions/index-stats  (no auth — counts aren't sensitive)
 *   → { total, states: [{state,name,region,count}], computedAt }
 */
const https = require("https");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600",
};

const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

/** Exact count via PostgREST Content-Range header (Prefer: count=exact). */
function countRows(filterQS = "", timeoutMs = 7000, table = "property_master") {
  return new Promise((resolve) => {
    const path = `/rest/v1/${table}?select=*${filterQS}`;
    const req = https.request(
      { hostname: new URL(SUPA_URL).hostname, path, method: "HEAD",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "count=exact", Range: "0-0" } },
      (res) => {
        const cr = res.headers["content-range"] || "";
        const total = cr.includes("/") ? cr.split("/")[1] : null;
        res.on("data", () => {}); res.on("end", () => resolve(total && total !== "*" ? Number(total) : null));
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Markets we name on the landing page. Aliases cover both state formats.
const STATES = [
  { state: "AZ", name: "Arizona",       region: "Maricopa County — Scottsdale, Paradise Valley, Phoenix" },
  { state: "CA", name: "California",    region: "Coachella Valley, Greater LA, Bay Area, San Diego" },
  { state: "WA", name: "Washington",    region: "Snohomish County, Greater Seattle" },
  { state: "TX", name: "Texas",         region: "Austin, Dallas-Fort Worth, Houston metros" },
  { state: "CT", name: "Connecticut",   region: "Fairfield County — Greenwich, Westport, Darien" },
  { state: "FL", name: "Florida",       region: "Miami-Dade, statewide FDOR cadastral" },
  { state: "NC", name: "North Carolina",region: "Buncombe, Mecklenburg — expanding" },
  { state: "GA", name: "Georgia",       region: "Metro Atlanta — expanding" },
  { state: "NY", name: "New York",      region: "Manhattan, Westchester — expanding" },
];

let CACHE = null;
let CACHE_AT = 0;

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const now = Date.now();
  if (CACHE && now - CACHE_AT < 3_600_000) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ...CACHE, cached: true }) };
  }

  // Total first (single fast indexed count) — the honest headline number.
  const total = await countRows("");

  // Real lifetime report count (the /accuracy page must show the TRUE number).
  const reports = await countRows("", 6000, "property_reports");

  // Per-state best-effort, in parallel; null on timeout (frontend keeps fallback).
  const states = await Promise.all(
    STATES.map(async (s) => {
      const filt = `&state=in.(${encodeURIComponent(s.state)},${encodeURIComponent(s.name)})`;
      const count = await countRows(filt, 6000);
      return { ...s, count };
    })
  );
  const marketsLive = states.filter((s) => s.count && s.count > 0).length;

  const result = { total, reports, markets: marketsLive, states, computedAt: new Date().toISOString() };
  if (total) { CACHE = result; CACHE_AT = now; }
  return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
};
