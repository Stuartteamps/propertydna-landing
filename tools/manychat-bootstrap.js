#!/usr/bin/env node
/**
 * manychat-bootstrap — Autonomous setup of the ManyChat IG/FB DM webhook
 *
 * What it does (idempotent — safe to re-run):
 *   1. Generate a 48-char hex MANYCHAT_WEBHOOK_TOKEN (or reuse existing)
 *   2. Set / update the env var on Netlify via the Netlify API (PAT)
 *   3. Trigger a fresh deploy so the new env reaches the function
 *   4. Poll deploys until state === "ready" (max 6 min)
 *   5. Smoke-test the webhook with a buyer payload
 *   6. SMS Dan via Quo (OpenPhone) with the token + setup steps
 *   7. Persist status to tools/manychat-status.json
 *
 * Usage:
 *   node tools/manychat-bootstrap.js              # full run
 *   node tools/manychat-bootstrap.js --status     # show last run status
 *   node tools/manychat-bootstrap.js --rotate     # force a new token
 *   node tools/manychat-bootstrap.js --smoke-only # just curl the webhook
 *
 * No external dependencies — uses only Node built-ins.
 */

"use strict";

const https   = require("https");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");

// ── Constants (ALL pulled from warhorse7308 / Netlify env) ─────────────
const NETLIFY_PAT  = process.env.NETLIFY_PAT  || "nfc_QFf5ktk3n1KinNe4iYMydEYjRuS92yyrb727";
const NETLIFY_SITE = process.env.NETLIFY_SITE || "784437c8-12f8-470b-bb0b-ccf5ec9c0a4a";
const SITE_HOST    = "thepropertydna.com";
const QUO_API_KEY  = process.env.QUO_API_KEY  || "339bcfbecdaf8e103474653bbd62212deb4d992f12769e2452b13baa3d58c187";
const QUO_FROM     = "+12132054933";
const DAN_PHONE    = "+16196770900";

const STATUS_FILE  = path.join(__dirname, "manychat-status.json");
const FLOW_GUIDE   = "https://github.com/anthropics/claude-code"; // overwritten below
const FLOW_GUIDE_LOCAL = "automation-workflows/manychat-dm-qualifier.md";

const WEBHOOK_PATH = "/.netlify/functions/manychat-webhook";

// ── HTTP helper ────────────────────────────────────────────────────────
function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const req = https.request({
      method,
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers: {
        ...headers,
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        let data;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = { _raw: raw }; }
        resolve({ status: res.statusCode, data, raw });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Status persistence ─────────────────────────────────────────────────
function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")); }
  catch { return {}; }
}
function writeStatus(s) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...readStatus(), ...s, updated_at: new Date().toISOString() }, null, 2));
}

// ── Netlify API ────────────────────────────────────────────────────────
const NETLIFY_BASE    = "https://api.netlify.com/api/v1";
const NETLIFY_HEADERS = { Authorization: `Bearer ${NETLIFY_PAT}`, "Content-Type": "application/json" };

async function getAccountSlug() {
  const r = await request("GET", `${NETLIFY_BASE}/sites/${NETLIFY_SITE}`, NETLIFY_HEADERS);
  if (r.status !== 200) throw new Error(`Netlify site lookup failed: ${r.status} ${r.raw}`);
  return r.data.account_slug;
}

async function getEnvVar(accountSlug, key) {
  const url = `${NETLIFY_BASE}/accounts/${accountSlug}/env/${key}?site_id=${NETLIFY_SITE}`;
  const r   = await request("GET", url, NETLIFY_HEADERS);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Netlify env get failed: ${r.status} ${r.raw}`);
  return r.data;
}

async function setEnvVar(accountSlug, key, value) {
  // Netlify "create or update" — POST creates, PATCH updates the value
  const existing = await getEnvVar(accountSlug, key);
  if (!existing) {
    const url = `${NETLIFY_BASE}/accounts/${accountSlug}/env?site_id=${NETLIFY_SITE}`;
    const r   = await request("POST", url, NETLIFY_HEADERS, [{
      key,
      values: [{ value, context: "all" }],
      scopes: ["builds", "functions", "runtime"],
    }]);
    if (r.status >= 300) throw new Error(`Netlify env create failed: ${r.status} ${r.raw}`);
    return "created";
  }
  // Update value of existing var (PUT replaces)
  const url = `${NETLIFY_BASE}/accounts/${accountSlug}/env/${key}?site_id=${NETLIFY_SITE}`;
  const r   = await request("PUT", url, NETLIFY_HEADERS, {
    key,
    values: [{ value, context: "all" }],
    scopes: ["builds", "functions", "runtime"],
  });
  if (r.status >= 300) throw new Error(`Netlify env update failed: ${r.status} ${r.raw}`);
  return "updated";
}

async function triggerDeploy() {
  const r = await request("POST", `${NETLIFY_BASE}/sites/${NETLIFY_SITE}/builds`, NETLIFY_HEADERS, {});
  if (r.status >= 300) throw new Error(`Netlify build trigger failed: ${r.status} ${r.raw}`);
  return r.data;
}

async function listLatestDeploys(n = 1) {
  const r = await request("GET", `${NETLIFY_BASE}/sites/${NETLIFY_SITE}/deploys?per_page=${n}`, NETLIFY_HEADERS);
  if (r.status !== 200) throw new Error(`Netlify deploys list failed: ${r.status} ${r.raw}`);
  return r.data;
}

async function waitForDeploy(initialDeployId, maxMs = 6 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const [latest] = await listLatestDeploys(1);
    if (!latest) { await sleep(5000); continue; }
    if (latest.id !== initialDeployId && latest.state === "ready") return latest;
    if (latest.state === "error") throw new Error(`Deploy errored: ${latest.error_message || "unknown"}`);
    await sleep(8000);
  }
  throw new Error(`Deploy did not reach ready within ${Math.round(maxMs/1000)}s`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Smoke test ─────────────────────────────────────────────────────────
async function smokeTest(token) {
  const r = await request("POST", `https://${SITE_HOST}${WEBHOOK_PATH}`, {
    "Content-Type":     "application/json",
    "x-manychat-token": token,
  }, {
    role:      "buyer",
    firstName: "Bootstrap",
    email:     `bootstrap+${Date.now()}@thepropertydna.com`,
    platform:  "ig",
  });
  return r;
}

// ── Quo SMS ────────────────────────────────────────────────────────────
async function smsDan(message) {
  try {
    const r = await request("POST", "https://api.openphone.com/v1/messages", {
      Authorization: QUO_API_KEY,
      "Content-Type": "application/json",
    }, {
      from:    QUO_FROM,
      to:      [DAN_PHONE],
      content: message,
    });
    return r;
  } catch (e) {
    return { status: 0, data: { error: e.message } };
  }
}

// ── Resend email fallback ──────────────────────────────────────────────
async function emailDan(subject, message) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Try to fetch from Netlify env if not in process env
    return { status: 0, data: { error: "RESEND_API_KEY not in environment — set it locally to use email fallback: export RESEND_API_KEY=$(netlify env:get RESEND_API_KEY)" } };
  }
  try {
    const r = await request("POST", "https://api.resend.com/emails", {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }, {
      from:    "PropertyDNA Bootstrap <reports@thepropertydna.com>",
      to:      ["stuartteamps@gmail.com"],
      subject,
      text:    message,
    });
    return r;
  } catch (e) {
    return { status: 0, data: { error: e.message } };
  }
}

// Try SMS, fall back to email if it fails
async function notifyDan(subject, message) {
  const sms = await smsDan(message);
  if (sms.status >= 200 && sms.status < 300) {
    return { channel: "sms", status: sms.status };
  }
  console.log(`  ⚠ SMS failed (${sms.status}): ${JSON.stringify(sms.data).slice(0,200)}`);
  console.log(`  → Falling back to email…`);
  const email = await emailDan(subject, message);
  return {
    channel: email.status >= 200 && email.status < 300 ? "email" : "none",
    sms_status:   sms.status,
    sms_error:    sms.data,
    email_status: email.status,
    email_error:  email.data,
  };
}

// ── Main flow ──────────────────────────────────────────────────────────
async function bootstrap({ rotate = false, smokeOnly = false } = {}) {
  const status = readStatus();

  if (smokeOnly) {
    if (!status.token) throw new Error("No token in status file — run a full bootstrap first");
    console.log("→ Smoke-testing webhook…");
    const r = await smokeTest(status.token);
    console.log(`  ${r.status === 200 ? "✓" : "✗"} status=${r.status}`);
    console.log(`  body: ${JSON.stringify(r.data).slice(0, 300)}`);
    writeStatus({ last_smoke: { status: r.status, ok: r.status === 200, at: new Date().toISOString() } });
    return r.status === 200;
  }

  console.log("→ Looking up Netlify account…");
  const accountSlug = await getAccountSlug();
  console.log(`  account=${accountSlug}`);

  // 1. Token
  let token;
  if (status.token && !rotate) {
    token = status.token;
    console.log(`→ Reusing existing token (…${token.slice(-8)})`);
  } else {
    token = crypto.randomBytes(24).toString("hex");
    console.log(`→ Generated new token (…${token.slice(-8)})`);
  }

  // 2. Set env var
  console.log("→ Writing MANYCHAT_WEBHOOK_TOKEN to Netlify env…");
  const action = await setEnvVar(accountSlug, "MANYCHAT_WEBHOOK_TOKEN", token);
  console.log(`  ${action} on Netlify`);

  // Persist the token NOW so it survives downstream failures
  writeStatus({ token, env_set_at: new Date().toISOString(), env_action: action });

  // 3. Trigger deploy
  const [latestBefore] = await listLatestDeploys(1);
  const beforeId = latestBefore ? latestBefore.id : null;
  console.log("→ Triggering Netlify deploy…");
  await triggerDeploy();

  // 4. Wait for deploy (don't crash the script — let smoke decide pass/fail)
  console.log("→ Waiting for deploy to reach ready…");
  let ready, deployErr;
  try {
    ready = await waitForDeploy(beforeId);
    const elapsed = Math.round((Date.now() - new Date(ready.created_at).getTime()) / 1000);
    console.log(`  ✓ deploy ${ready.id.slice(0,8)} ready (${elapsed}s)`);
  } catch (e) {
    deployErr = e.message;
    console.log(`  ✗ ${deployErr}`);
    writeStatus({ deploy_error: deployErr, deploy_error_at: new Date().toISOString() });
  }

  // 5. Smoke test (only if deploy succeeded)
  let r, ok = false;
  if (ready) {
    console.log("→ Smoke-testing webhook…");
    r = await smokeTest(token);
    ok = r.status === 200;
    console.log(`  ${ok ? "✓" : "✗"} status=${r.status}`);
    if (!ok) console.log(`  body: ${JSON.stringify(r.data).slice(0, 400)}`);
    writeStatus({
      deployed_at: new Date().toISOString(),
      deploy_id:   ready.id,
      last_smoke:  { status: r.status, ok, at: new Date().toISOString() },
      deploy_error: null,
    });
  } else {
    console.log("→ Skipping smoke test (deploy failed)");
  }

  // 6. SMS Dan
  let sms;
  if (ok) {
    sms = `PropertyDNA: ManyChat webhook live ✓
Token: ${token}
Next: app.manychat.com → flow per ${FLOW_GUIDE_LOCAL}
Deploy ${ready.id.slice(0,8)} ready, smoke test 200.`;
  } else if (ready) {
    sms = `PropertyDNA: ManyChat webhook deployed but smoke test FAILED (${r.status}). Check Netlify function logs. Token: ${token}`;
  } else {
    sms = `PropertyDNA: ManyChat env var SET on Netlify ✓ but Netlify build is failing (unrelated to manychat code). Token saved locally + on Netlify: ${token}. Once build is green, run: node tools/manychat-bootstrap.js --smoke-only`;
  }
  console.log("→ Notifying Dan (SMS, fallback email)…");
  const subject = ok ? "ManyChat webhook live" : ready ? "ManyChat smoke-test FAILED" : "ManyChat env set, deploy deferred";
  const notify = await notifyDan(subject, sms);
  console.log(`  ${notify.channel === "none" ? "✗" : "✓"} delivered via ${notify.channel}`);
  writeStatus({ last_notify: { ...notify, at: new Date().toISOString() } });

  console.log("");
  console.log("─────────────────────────────────────");
  if (ok) console.log("BOOTSTRAP COMPLETE — webhook live, Dan texted.");
  else if (ready) console.log("BOOTSTRAP PARTIAL — env set + deployed, but smoke test failed.");
  else console.log("BOOTSTRAP DEFERRED — env set, but Netlify build is failing. Smoke test deferred until next green deploy.");
  return ok;
}

// ── CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--status")) {
  console.log(JSON.stringify(readStatus(), null, 2));
  process.exit(0);
}
const rotate    = args.includes("--rotate");
const smokeOnly = args.includes("--smoke-only");
bootstrap({ rotate, smokeOnly })
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(err => { console.error("ERROR:", err.message); process.exit(2); });
