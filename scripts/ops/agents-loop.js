#!/usr/bin/env node
/**
 * agents-loop.js — run agents-run on a bounded interval with backoff.
 *
 * Wraps runAgents() in a loop with hard safety limits so it can never run away:
 *   - OPS_LOOP_INTERVAL_SEC  base sleep between iterations (default 3600 = 1h)
 *   - OPS_LOOP_MAX           max iterations, then stop (default 24)
 *   - Exponential backoff on failure, capped at 600s (10 min). On success the
 *     backoff resets to the base interval.
 *   - Clear per-iteration logging (index, result, next sleep).
 *   - SIGINT/SIGTERM stop the loop cleanly.
 *
 * Exits 0 if the last iteration succeeded, else 1. Never fakes success — each
 * iteration reflects the real agent HTTP results.
 */
"use strict";

const { runAgents, selectedAgents } = require("./agents-run");

const BASE_INTERVAL_SEC = Math.max(parseInt(process.env.OPS_LOOP_INTERVAL_SEC || "3600", 10) || 3600, 1);
const MAX_ITERATIONS = Math.max(parseInt(process.env.OPS_LOOP_MAX || "24", 10) || 24, 1);
const BACKOFF_CAP_SEC = 600; // 10 minutes hard cap

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let stop = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { console.log(`\n[agents-loop] ${sig} received — stopping after current iteration.`); stop = true; });
}

(async () => {
  const agents = selectedAgents();
  console.log(`[agents-loop] agents=[${agents.join(", ")}] interval=${BASE_INTERVAL_SEC}s maxIterations=${MAX_ITERATIONS} backoffCap=${BACKOFF_CAP_SEC}s`);

  let lastSuccess = false;
  let backoffSec = BASE_INTERVAL_SEC;
  let consecutiveFailures = 0;

  for (let i = 1; i <= MAX_ITERATIONS && !stop; i++) {
    const startedAt = new Date().toISOString();
    console.log(`\n===== iteration ${i}/${MAX_ITERATIONS} @ ${startedAt} =====`);

    let anyFailure = true;
    try {
      const out = await runAgents(agents);
      anyFailure = out.anyFailure;
    } catch (e) {
      console.error(`[agents-loop] iteration ${i} threw: ${e.message}`);
    }

    lastSuccess = !anyFailure;

    if (anyFailure) {
      consecutiveFailures++;
      // Exponential backoff from the base interval, capped.
      backoffSec = Math.min(BASE_INTERVAL_SEC * Math.pow(2, consecutiveFailures), BACKOFF_CAP_SEC);
      console.log(`[agents-loop] iteration ${i} had failures (${consecutiveFailures} in a row) — backoff ${backoffSec}s`);
    } else {
      consecutiveFailures = 0;
      backoffSec = BASE_INTERVAL_SEC;
      console.log(`[agents-loop] iteration ${i} OK — next in ${backoffSec}s`);
    }

    if (i >= MAX_ITERATIONS || stop) break;
    // Sleep in 1s slices so a signal stops us promptly.
    const until = Date.now() + backoffSec * 1000;
    while (Date.now() < until && !stop) await sleep(Math.min(1000, until - Date.now()));
  }

  console.log(`\n[agents-loop] stopped. lastIterationSuccess=${lastSuccess}`);
  process.exit(lastSuccess ? 0 : 1);
})();
