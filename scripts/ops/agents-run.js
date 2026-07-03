#!/usr/bin/env node
/**
 * agents-run.js — invoke a small set of REAL agent endpoints once.
 *
 * POSTs each selected agent (x-internal-key) which triggers its actual run, and
 * reports the HTTP status + a short summary of the returned JSON per agent.
 *
 * Default set is the internal data/compute agents (safe to run repeatedly):
 *   market-agent, steward-agent, historian-agent
 * Override with OPS_AGENTS="a,b,c". (Outreach/social agents are intentionally
 * excluded from the default so a routine run doesn't send messages.)
 *
 * Exits 0 only if every invoked agent returned a success status, else 1.
 * Exported (runAgents) and reused by agents-loop.js. Never fakes success.
 */
"use strict";

const { postFn, printTable } = require("./_lib");

const DEFAULT_AGENTS = ["market-agent", "steward-agent", "historian-agent"];

function selectedAgents() {
  const env = (process.env.OPS_AGENTS || "").trim();
  if (!env) return DEFAULT_AGENTS;
  return env.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Summarize an agent's JSON response into a short string. */
function summarize(data) {
  if (!data || typeof data !== "object") return "";
  const keys = ["ok", "ran", "processed", "written", "updated", "created", "posted", "count", "message"];
  const parts = [];
  for (const k of keys) if (k in data && data[k] != null) parts.push(`${k}=${JSON.stringify(data[k])}`);
  return parts.slice(0, 4).join(" ") || Object.keys(data).slice(0, 4).join(",");
}

/**
 * Invoke each agent once. Returns { results, anyFailure }.
 */
async function runAgents(agents = selectedAgents()) {
  const results = [];
  for (const name of agents) {
    const res = await postFn(name, {}, { timeoutMs: 60000 });
    const success = res.ok && (!res.data || res.data.error == null);
    results.push({
      name,
      success,
      status: res.status || (res.error || "ERR"),
      ms: res.ms,
      summary: success ? summarize(res.data) : (res.data && res.data.error) || res.error || `HTTP ${res.status}`,
    });
    console.log(`[agents-run] ${name}: ${success ? "OK" : "FAIL"} (HTTP ${res.status}, ${res.ms}ms) ${success ? summarize(res.data) : ""}`);
  }
  return { results, anyFailure: results.some((r) => !r.success) };
}

async function main() {
  const agents = selectedAgents();
  console.log(`[agents-run] invoking ${agents.length} agents: ${agents.join(", ")}\n`);

  const { results, anyFailure } = await runAgents(agents);

  console.log("");
  printTable(
    ["agent", "ok", "http", "latency", "summary"],
    results.map((r) => [r.name, r.success ? "Y" : "N", r.status, `${r.ms}ms`, String(r.summary).slice(0, 48)])
  );

  console.log(`\n${results.filter((r) => r.success).length}/${results.length} agents succeeded.`);
  process.exit(anyFailure ? 1 : 0);
}

module.exports = { runAgents, selectedAgents, DEFAULT_AGENTS };

if (require.main === module) {
  main();
}
