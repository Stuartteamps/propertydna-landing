#!/usr/bin/env node
/**
 * agents-status.js — reachability status for every deployed agent endpoint.
 *
 * Each PropertyDNA agent is a Netlify function that answers OPTIONS with 200
 * (CORS preflight) and runs its real work on an authenticated POST. To report
 * status WITHOUT triggering heavy agent runs, this probes each endpoint with a
 * lightweight OPTIONS request and reports reachable Y/N + HTTP status.
 *
 * Prints a table and exits 0 only if every endpoint is reachable, else 1.
 * (Use `agents:run` to actually invoke agents, `agents:health` for the
 * pipeline health-check endpoint.)
 */
"use strict";

const { BASE_URL, httpRequest } = require("./_lib");

// The real deployed agent endpoints (all under /.netlify/functions/).
const AGENTS = [
  "market-agent",
  "steward-agent",
  "historian-agent",
  "growth-agent",
  "connector-agent",
  "social-agent",
  "advocate-agent",
  "ambassador-agent",
];

(async () => {
  console.log(`[agents-status] probing ${AGENTS.length} agent endpoints at ${BASE_URL}\n`);

  const results = await Promise.all(
    AGENTS.map(async (name) => {
      const url = `${BASE_URL}/.netlify/functions/${name}`;
      const res = await httpRequest("OPTIONS", url, { timeoutMs: 12000 });
      // OPTIONS 200/204 = deployed & reachable. Any HTTP response also proves
      // the function exists; only network errors / 404 mean unreachable.
      const reachable = res.status > 0 && res.status !== 404;
      return {
        name,
        reachable,
        status: res.status || (res.error || "ERR"),
        ms: res.ms,
      };
    })
  );

  const rows = results.map((r) => [r.name, r.reachable ? "Y" : "N", r.status, `${r.ms}ms`]);
  require("./_lib").printTable(["agent", "reachable", "http", "latency"], rows);

  const down = results.filter((r) => !r.reachable);
  console.log(`\n${results.length - down.length}/${results.length} agent endpoints reachable.`);
  if (down.length) {
    console.error(`UNREACHABLE: ${down.map((d) => d.name).join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
})();
