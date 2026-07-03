#!/usr/bin/env node
/**
 * data-quality.js — REAL data-quality audit against Supabase (PostgREST).
 *
 * Counts, via exact PostgREST count queries (Prefer: count=exact, HEAD +
 * Range: 0-0), how many rows are missing key fields:
 *   - property_master.tax_assessed_value IS NULL
 *   - property_master.latitude IS NULL
 *   - property_reports.report_data IS NULL
 * plus the total row counts for context.
 *
 * Requires SUPABASE_SERVICE_KEY (RLS-bypassing) — without it, RLS silently
 * zeroes counts, which would be a fabricated "all clean" result. So if the key
 * is absent this prints NOT WIRED YET and exits non-zero. Numbers are never
 * fabricated: any query error is reported as-is.
 */
"use strict";

const https = require("https");
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, notWired } = require("./_lib");

if (!SUPABASE_SERVICE_KEY) {
  notWired("needs SUPABASE_SERVICE_KEY", [
    "Set SUPABASE_SERVICE_KEY (the service_role key) in the environment.",
    "Without it PostgREST RLS zeroes counts, which would fake a clean result.",
    `Would query counts against ${SUPABASE_URL}/rest/v1 for:`,
    "property_master (total, tax_assessed_value IS NULL, latitude IS NULL)",
    "property_reports (total, report_data IS NULL)",
  ]);
}

/**
 * Exact row count via PostgREST Content-Range header.
 * Returns { count:number|null, status, error? }. Never fabricates.
 */
function countRows(table, filterQS = "") {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?select=*${filterQS}`);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "HEAD",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
      (res) => {
        const cr = res.headers["content-range"] || "";
        const total = cr.includes("/") ? cr.split("/")[1] : null;
        res.on("data", () => {});
        res.on("end", () => {
          if (res.statusCode >= 400) {
            resolve({ count: null, status: res.statusCode, error: `HTTP ${res.statusCode}` });
          } else {
            resolve({ count: total && total !== "*" ? Number(total) : null, status: res.statusCode });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ count: null, status: 0, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ count: null, status: 0, error: "timeout" }); });
    req.end();
  });
}

(async () => {
  console.log(`[data-quality] counting against ${SUPABASE_URL}/rest/v1\n`);

  const checks = [
    { label: "property_master total",             table: "property_master", filter: "" },
    { label: "property_master tax_assessed_value NULL", table: "property_master", filter: "&tax_assessed_value=is.null" },
    { label: "property_master latitude NULL",     table: "property_master", filter: "&latitude=is.null" },
    { label: "property_reports total",            table: "property_reports", filter: "" },
    { label: "property_reports report_data NULL", table: "property_reports", filter: "&report_data=is.null" },
  ];

  let hadError = false;
  const rows = [];
  for (const c of checks) {
    const r = await countRows(c.table, c.filter);
    if (r.error) { hadError = true; rows.push([c.label, `ERROR (${r.error})`]); }
    else rows.push([c.label, r.count == null ? "n/a" : Number(r.count).toLocaleString()]);
  }

  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [label, val] of rows) console.log(`  ${label.padEnd(w)}  ${String(val).padStart(12)}`);

  if (hadError) {
    console.error("\nFAIL: one or more count queries errored (see above). Not fabricating numbers.");
    process.exit(1);
  }
  console.log("\nOK — data-quality counts retrieved from live Supabase.");
  process.exit(0);
})();
