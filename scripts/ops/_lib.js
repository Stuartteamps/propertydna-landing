/**
 * _lib.js — shared zero-dependency helpers for the PropertyDNA ops scripts.
 *
 * No npm deps. Uses Node's built-in https module so it runs anywhere Node does.
 * Every ops script hits a REAL deployed endpoint and reports actual results.
 * CRITICAL: never fake success. If something can't be verified, the caller
 * must print a clear "NOT WIRED YET: <what's needed>" and exit non-zero.
 */
"use strict";

const https = require("https");

// Base URL of the live deployment. Override with OPS_BASE_URL for staging/local.
const BASE_URL = (process.env.OPS_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");

// Internal API key for protected Netlify functions.
// Falls back to the known production key for local dev convenience — override
// via INTERNAL_API_KEY in real environments.
const INTERNAL_KEY =
  process.env.INTERNAL_API_KEY ||
  "271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"; // local-dev fallback

// Supabase (only used by data-quality.js; service key is required there).
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

/**
 * Perform an HTTPS request and parse JSON. Never throws for HTTP errors —
 * resolves with { ok, status, data, ms, error } so callers can report reality.
 */
function httpRequest(method, urlStr, { headers = {}, body = null, timeoutMs = 25000 } = {}) {
  const url = new URL(urlStr);
  const payload = body == null ? null : (typeof body === "string" ? body : JSON.stringify(body));
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PropertyDNA-Ops/1.0",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let data;
          try { data = raw ? JSON.parse(raw) : null; } catch { data = { _raw: raw.slice(0, 300) }; }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            data,
            ms: Date.now() - start,
          });
        });
      }
    );
    req.on("error", (e) => resolve({ ok: false, status: 0, error: e.message, ms: Date.now() - start }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, status: 0, error: "timeout", ms: timeoutMs }); });
    if (payload) req.write(payload);
    req.end();
  });
}

/** GET a Netlify function by name (no leading slash needed). */
function getFn(name, opts = {}) {
  return httpRequest("GET", `${BASE_URL}/.netlify/functions/${name}`, opts);
}

/** POST a Netlify function by name, with the internal key header attached. */
function postFn(name, body, opts = {}) {
  return httpRequest("POST", `${BASE_URL}/.netlify/functions/${name}`, {
    ...opts,
    body: body || {},
    headers: { "x-internal-key": INTERNAL_KEY, ...(opts.headers || {}) },
  });
}

/** Print a "NOT WIRED YET" message and exit non-zero. Never fake success. */
function notWired(message, details = []) {
  console.error(`\nNOT WIRED YET: ${message}`);
  for (const d of details) console.error(`  - ${d}`);
  process.exit(1);
}

/** Render a simple fixed-width table to stdout. */
function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? "").length)));
  const fmt = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ");
  console.log(fmt(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(fmt(r));
}

module.exports = {
  BASE_URL,
  INTERNAL_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  httpRequest,
  getFn,
  postFn,
  notWired,
  printTable,
};
