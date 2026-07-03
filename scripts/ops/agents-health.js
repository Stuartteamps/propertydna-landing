#!/usr/bin/env node
/**
 * agents-health.js — deep pipeline health via the real health-check endpoint.
 *
 * Calls GET /.netlify/functions/health-check with x-internal-key. That function
 * probes the whole report-delivery chain (env vars, Resend, n8n, save-report,
 * send-report-email, and recent Supabase activity) and returns
 * { healthy, issues, checks }. This prints a table of the checks and the issue
 * list, then exits 0 when healthy, 1 otherwise.
 *
 * If the internal key is wrong the endpoint returns 401 — reported honestly,
 * never treated as success.
 */
"use strict";

const { BASE_URL, INTERNAL_KEY, httpRequest, printTable } = require("./_lib");

(async () => {
  const url = `${BASE_URL}/.netlify/functions/health-check`;
  console.log(`[agents-health] GET ${url}`);
  const res = await httpRequest("GET", url, {
    headers: { "x-internal-key": INTERNAL_KEY },
    timeoutMs: 25000,
  });

  if (res.status === 401) {
    console.error("FAIL: health-check returned 401 Unauthorized — INTERNAL_API_KEY is missing/wrong.");
    process.exit(1);
  }
  if (res.status === 0) {
    console.error(`FAIL: health-check unreachable (${res.error}).`);
    process.exit(1);
  }
  if (!res.data || typeof res.data !== "object") {
    console.error(`FAIL: health-check returned no JSON (HTTP ${res.status}).`);
    process.exit(1);
  }

  const { healthy, issues = [], checks = {}, checked_at } = res.data;

  // Flatten the checks object into a readable table.
  const rows = [];
  for (const [name, val] of Object.entries(checks)) {
    if (val && typeof val === "object" && "ok" in val) {
      rows.push([name, val.ok ? "Y" : "N", val.status ?? "-", val.ms != null ? `${val.ms}ms` : "-"]);
    } else if (name === "env" && val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) rows.push([`env.${k}`, v ? "Y" : "N", "-", "-"]);
    } else {
      rows.push([name, "info", "-", "-"]);
    }
  }
  if (rows.length) printTable(["check", "ok", "status", "latency"], rows);

  if (issues.length) {
    console.log("\nIssues:");
    for (const i of issues) console.log(`  - ${i}`);
  }

  console.log(`\nhealthy: ${healthy} (HTTP ${res.status}, ${res.ms}ms) — checked_at: ${checked_at || "n/a"}`);
  process.exit(healthy ? 0 : 1);
})();
