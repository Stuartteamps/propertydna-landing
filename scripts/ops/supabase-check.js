#!/usr/bin/env node
/**
 * supabase-check.js — verify the live property index is populated.
 *
 * Hits the REAL public endpoint GET /.netlify/functions/index-stats (which
 * counts property_master server-side with the service key). Asserts HTTP 200
 * and total > 0, then prints the property count and a per-state summary.
 *
 * Exit 0 when healthy, 1 otherwise. Never fabricates numbers.
 */
"use strict";

const { getFn } = require("./_lib");

(async () => {
  console.log("[supabase-check] GET /.netlify/functions/index-stats");
  const res = await getFn("index-stats", { timeoutMs: 20000 });

  if (res.status !== 200) {
    console.error(`FAIL: index-stats returned HTTP ${res.status}${res.error ? " (" + res.error + ")" : ""}`);
    process.exit(1);
  }

  const d = res.data || {};
  const total = Number(d.total);
  if (!Number.isFinite(total) || total <= 0) {
    console.error(`FAIL: index-stats total is not > 0 (got ${JSON.stringify(d.total)}).`);
    process.exit(1);
  }

  console.log(`OK (${res.ms}ms) — property_master total: ${total.toLocaleString()}`);
  if (Number.isFinite(Number(d.reports))) console.log(`Lifetime property_reports: ${Number(d.reports).toLocaleString()}`);
  if (Number.isFinite(Number(d.markets))) console.log(`Live markets: ${d.markets}`);

  const states = Array.isArray(d.states) ? d.states : [];
  if (states.length) {
    console.log("\nPer-state summary:");
    for (const s of states) {
      const c = s.count == null ? "n/a" : Number(s.count).toLocaleString();
      console.log(`  ${String(s.state).padEnd(3)} ${String(s.name).padEnd(16)} ${String(c).padStart(10)}`);
    }
  }

  console.log(`\ncomputedAt: ${d.computedAt || "unknown"}${d.cached ? " (cached)" : ""}`);
  process.exit(0);
})();
