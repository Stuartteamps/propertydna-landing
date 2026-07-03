#!/usr/bin/env node
/**
 * indexes-build.js — build the Coachella Valley property index for real.
 *
 * POSTs /.netlify/functions/ingest-rivco-parcels (x-internal-key) for every
 * Coachella Valley city, looping each city on its returned `nextOffset` until
 * the source is exhausted (`done`) or a per-city invocation cap is hit (so it
 * can never run away). The ingest function reads geocoded parcels from the
 * Riverside County Assessor CREST service and writes real rows to `properties`.
 *
 * Prints written/existing per city and a grand total. Exits non-zero if the
 * endpoint is unreachable/unauthorized or every city failed. Never fakes writes
 * — it reports exactly what the endpoint returned.
 *
 * Also exported (runIngest) and reused by indexes-refresh.js.
 */
"use strict";

const { postFn, printTable } = require("./_lib");

// The 9 incorporated Coachella Valley cities (must match ingest CITIES keys).
const CV_CITIES = [
  "Palm Springs",
  "Palm Desert",
  "La Quinta",
  "Indio",
  "Cathedral City",
  "Indian Wells",
  "Rancho Mirage",
  "Coachella",
  "Desert Hot Springs",
];

/**
 * Run the ingest for a set of cities.
 * @param {object} opts
 * @param {string[]} opts.cities
 * @param {number} opts.target   in-city parcels to collect per invocation
 * @param {number} opts.maxInvocationsPerCity  hard cap (runaway guard)
 * @param {number} opts.limit    ArcGIS page size
 * @returns {Promise<{rows, totals, anySuccess}>}
 */
async function runIngest({ cities, target, maxInvocationsPerCity, limit = 1000 }) {
  const rows = [];
  const totals = { written: 0, existing: 0, scanned: 0, cities: 0, failed: 0 };
  let anySuccess = false;

  for (const city of cities) {
    let offset = 0;
    let invocations = 0;
    let written = 0, existing = 0, scanned = 0;
    let done = false;
    let lastError = null;

    while (!done && invocations < maxInvocationsPerCity) {
      invocations++;
      const res = await postFn(
        "ingest-rivco-parcels",
        { city, offset, limit, target, maxPages: 8 },
        { timeoutMs: 60000 }
      );

      if (res.status === 401) { lastError = "401 unauthorized (INTERNAL_API_KEY)"; break; }
      if (!res.ok || !res.data || res.data.ok !== true) {
        lastError = res.error || (res.data && (res.data.error || JSON.stringify(res.data).slice(0, 120))) || `HTTP ${res.status}`;
        break;
      }

      const d = res.data;
      written += Number(d.written) || 0;
      existing += Number(d.existing) || 0;
      scanned += Number(d.scanned) || 0;
      anySuccess = true;

      if (d.done || d.nextOffset == null) { done = true; }
      else { offset = Number(d.nextOffset); }
    }

    if (lastError) {
      totals.failed++;
      rows.push([city, "ERR", "ERR", String(lastError).slice(0, 40), invocations]);
      console.error(`[indexes] ${city}: FAILED — ${lastError}`);
    } else {
      totals.written += written;
      totals.existing += existing;
      totals.scanned += scanned;
      totals.cities++;
      rows.push([city, written, existing, done ? "done" : "capped", invocations]);
      console.log(`[indexes] ${city}: +${written} written, ${existing} existing (${scanned} scanned, ${invocations} calls, ${done ? "done" : "capped"})`);
    }
  }

  return { rows, totals, anySuccess };
}

async function main({ target = 2000, maxInvocationsPerCity = 6, label = "build" } = {}) {
  console.log(`[indexes:${label}] ingesting ${CV_CITIES.length} Coachella Valley cities (target=${target}, cap=${maxInvocationsPerCity} calls/city)\n`);

  const { rows, totals, anySuccess } = await runIngest({
    cities: CV_CITIES,
    target,
    maxInvocationsPerCity,
  });

  console.log("");
  printTable(["city", "written", "existing", "state", "calls"], rows);
  console.log(`\nTOTAL: +${totals.written} written, ${totals.existing} existing across ${totals.cities} cities (${totals.failed} failed).`);

  if (!anySuccess) {
    console.error("FAIL: no city ingested successfully — check reachability/auth.");
    process.exit(1);
  }
  process.exit(totals.failed > 0 ? 1 : 0);
}

module.exports = { runIngest, CV_CITIES, main };

if (require.main === module) {
  main({ target: 2000, maxInvocationsPerCity: 6, label: "build" });
}
