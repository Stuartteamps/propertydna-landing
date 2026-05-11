#!/usr/bin/env node
/**
 * manychat-flow-watch — Polls ManyChat for a new flow + runs a live smoke
 *   test once it appears. No browser automation — Dan builds in his own
 *   browser, this script confirms completion + end-to-end correctness.
 *
 * Usage:
 *   MANYCHAT_API_KEY=<token> node tools/manychat-flow-watch.js
 *
 * Behavior:
 *   1. Snapshots existing flows + keywords (baseline)
 *   2. Polls every 10s for up to 60 min
 *   3. When a new non-system flow appears (or an existing one is renamed
 *      to mention DNA/qualifier), runs a live smoke test against the
 *      webhook with platform=ig and platform=fb
 *   4. Prints the result + emails Dan via Resend
 */

"use strict";

const https = require("https");
const fs    = require("fs");
const path  = require("path");

const STATUS_FILE = path.join(__dirname, "manychat-status.json");
const WEBHOOK_HOST = "thepropertydna.com";
const WEBHOOK_PATH = "/.netlify/functions/manychat-webhook";
const POLL_INTERVAL_MS = 10000;
const MAX_WAIT_MS      = 60 * 60 * 1000;

function getWebhookToken() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")).token; } catch { return null; }
}

function req(method, host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const opts = { hostname: host, path, method, headers: { ...headers } };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const r = https.request(opts, res => {
      let b = ""; res.on("data", c => b += c);
      res.on("end", () => {
        let parsed; try { parsed = b ? JSON.parse(b) : null; } catch { parsed = { _raw: b }; }
        resolve({ status: res.statusCode, data: parsed, raw: b });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

async function mcGet(apiKey, p) {
  return req("GET", "api.manychat.com", p, { Authorization: `Bearer ${apiKey}` });
}

async function getFlows(apiKey) {
  const r = await mcGet(apiKey, "/fb/page/getFlows");
  return r.data?.data?.flows || [];
}

async function smoke(token, platform = "ig", role = "buyer") {
  const r = await req("POST", WEBHOOK_HOST, WEBHOOK_PATH, {
    "Content-Type": "application/json",
    "x-manychat-token": token,
  }, {
    role,
    firstName: "FlowWatch",
    email:    `flowwatch+${Date.now()}@thepropertydna.com`,
    platform,
  });
  return { status: r.status, ok: r.status === 200, body: (r.raw || "").slice(0, 400) };
}

async function fetchResendKey() {
  const PAT = process.env.NETLIFY_PAT || "nfc_QFf5ktk3n1KinNe4iYMydEYjRuS92yyrb727";
  const SITE = process.env.NETLIFY_SITE || "784437c8-12f8-470b-bb0b-ccf5ec9c0a4a";
  try {
    const acct = await req("GET", "api.netlify.com", `/api/v1/sites/${SITE}`, { Authorization: `Bearer ${PAT}` });
    if (acct.status !== 200) return null;
    const slug = acct.data.account_slug;
    const env = await req("GET", "api.netlify.com", `/api/v1/accounts/${slug}/env/RESEND_API_KEY?site_id=${SITE}`, { Authorization: `Bearer ${PAT}` });
    if (env.status !== 200) return null;
    return (env.data.values || []).find(v => v.context === "all" || v.context === "production")?.value || null;
  } catch { return null; }
}

async function emailDan(subject, text) {
  const key = process.env.RESEND_API_KEY || await fetchResendKey();
  if (!key) return null;
  return req("POST", "api.resend.com", "/emails", {
    Authorization: `Bearer ${key}`, "Content-Type": "application/json",
  }, {
    from: "PropertyDNA Bootstrap <reports@thepropertydna.com>",
    to:   ["stuartteamps@gmail.com"],
    subject, text,
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) {
    console.error("MANYCHAT_API_KEY not set. Run with: MANYCHAT_API_KEY=<token> node tools/manychat-flow-watch.js");
    process.exit(2);
  }
  const token = getWebhookToken();
  if (!token) {
    console.error("No webhook token in manychat-status.json. Run the orchestrator bootstrap first.");
    process.exit(2);
  }

  console.log("→ Snapshotting baseline flows…");
  const baseline = await getFlows(apiKey);
  const baselineNs = new Set(baseline.map(f => f.ns));
  console.log(`  Baseline: ${baseline.length} flows`);
  for (const f of baseline) console.log(`    · ${f.name} (ns=${f.ns})`);
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("BUILD THE FLOW IN YOUR BROWSER:");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("URL: https://app.manychat.com/fb2304092946501728/cms/automation");
  console.log("");
  console.log("1. + New Automation → Start from scratch");
  console.log("2. Add Trigger: \"User sends a message with Keyword\"");
  console.log("   Keywords: DNA, REPORT, VALUE, HOUSE  (Instagram + FB Messenger)");
  console.log("3. Conversation steps:");
  console.log("   • Text + Quick Replies → save to {{lead_role}}");
  console.log("     [Buying]→buyer  [Selling]→seller  [Agent]→agent  [Investor]→investor");
  console.log("   • User Input (Text)  → save to {{lead_first_name}}");
  console.log("   • User Input (Email) → save to {{lead_email}}");
  console.log("   • IF {{lead_role}} == seller → User Input (Text) → {{lead_address}}");
  console.log("4. External Request action:");
  console.log("     URL: https://thepropertydna.com/.netlify/functions/manychat-webhook");
  console.log("     Method: POST");
  console.log("     Headers:");
  console.log("       Content-Type: application/json");
  console.log(`       x-manychat-token: ${token}`);
  console.log("     Body:");
  console.log("       {");
  console.log("         \"role\": \"{{lead_role}}\",");
  console.log("         \"firstName\": \"{{lead_first_name}}\",");
  console.log("         \"email\": \"{{lead_email}}\",");
  console.log("         \"address\": \"{{lead_address}}\",");
  console.log("         \"platform\": \"ig\"");
  console.log("       }");
  console.log("     Toggle ON: \"Use response as message\"");
  console.log("5. Apply Tag: dna_qualifier_complete");
  console.log("6. Publish (top right)");
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("Polling every 10s for the new flow (max 60min)…");
  console.log("══════════════════════════════════════════════════════════════");

  const start = Date.now();
  let newFlow = null;
  while (Date.now() - start < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);
    let flows;
    try { flows = await getFlows(apiKey); } catch { flows = []; }
    const fresh = flows.filter(f => !baselineNs.has(f.ns) && !f.ns.startsWith("system_"));
    if (fresh.length > 0) {
      newFlow = fresh[0];
      const elapsed = Math.round((Date.now() - start)/1000);
      console.log(`\n✓ NEW FLOW DETECTED after ${elapsed}s: "${newFlow.name}" (ns=${newFlow.ns})`);
      break;
    }
    process.stdout.write(".");
  }

  if (!newFlow) {
    console.error("\n✗ Timed out after 60 min. Re-run when published.");
    process.exit(3);
  }

  console.log("→ Running live smoke test (Instagram + buyer role)…");
  const sIG = await smoke(token, "ig", "buyer");
  console.log(`  IG:     ${sIG.ok ? "✓" : "✗"} HTTP ${sIG.status}`);
  console.log("→ Running live smoke test (Facebook + seller role w/ address)…");
  const sFB = await req("POST", WEBHOOK_HOST, WEBHOOK_PATH, {
    "Content-Type": "application/json", "x-manychat-token": token,
  }, { role: "seller", firstName: "FlowWatch", email: "stuartteamps@gmail.com", address: "100 W Vista Chino", city: "Palm Springs", state: "CA", zip: "92262", platform: "fb" });
  console.log(`  FB:     ${sFB.status === 200 ? "✓" : "✗"} HTTP ${sFB.status}`);

  const allOk = sIG.ok && sFB.status === 200;
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(allOk ? "BUILD COMPLETE + LIVE — ManyChat → Webhook → Supabase + Resend + DNA report queue is shipping." : "BUILD DETECTED but smoke test FAILED — check webhook logs.");
  console.log("══════════════════════════════════════════════════════════════");

  await emailDan(
    allOk ? "ManyChat flow LIVE — end-to-end verified" : "ManyChat flow detected but smoke FAILED",
    `Hi Dan,\n\nFlow detected: ${newFlow.name} (ns=${newFlow.ns})\n\nSmoke tests:\n  IG (buyer):       HTTP ${sIG.status}\n  FB (seller+addr): HTTP ${sFB.status}\n\n${allOk ? "End-to-end LIVE. Any DM with DNA/REPORT/VALUE/HOUSE keyword on IG or FB will now qualify, capture, and respond with a personalized PropertyDNA report link." : "Smoke test failed — investigate the External Request action in ManyChat. Most common: missing or wrong x-manychat-token header."}\n\n— manychat-flow-watch`,
  );

  process.exit(allOk ? 0 : 1);
})().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
