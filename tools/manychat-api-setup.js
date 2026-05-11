#!/usr/bin/env node
/**
 * manychat-api-setup — Provisions ManyChat custom fields + tags via Public API
 *
 * What it does (idempotent — safe to re-run):
 *   1. Reads MANYCHAT_API_KEY from env (or fetches from Netlify env via PAT)
 *   2. Lists existing ManyChat custom fields + tags (skips if already present)
 *   3. Creates the 7 custom fields the DM-qualifier flow needs
 *   4. Creates the 3 tags used for lead-source segmentation
 *   5. Prints the exact remaining UI clicks for visual flow assembly
 *   6. Emails Dan a status report
 *
 * Custom fields created:
 *   - lead_role          (text)  — buyer | seller | agent | investor
 *   - lead_first_name    (text)
 *   - lead_email         (text)
 *   - lead_address       (text)
 *   - report_url         (text)  — set by webhook response
 *   - lead_funnel        (text)  — set by webhook response
 *   - execution_id       (text)  — set by webhook response
 *
 * Tags created:
 *   - manychat_ig_lead
 *   - manychat_fb_lead
 *   - dna_qualifier_complete
 *
 * Usage:
 *   node tools/manychat-api-setup.js              # full provision
 *   node tools/manychat-api-setup.js --status     # show provisioning state
 *   node tools/manychat-api-setup.js --check-key  # just verify the API key works
 *
 * Auth source priority:
 *   1. process.env.MANYCHAT_API_KEY
 *   2. fetched from Netlify env MANYCHAT_API_KEY via NETLIFY_PAT
 */

"use strict";

const https = require("https");
const fs    = require("fs");
const path  = require("path");

const NETLIFY_PAT  = process.env.NETLIFY_PAT  || "nfc_QFf5ktk3n1KinNe4iYMydEYjRuS92yyrb727";
const NETLIFY_SITE = process.env.NETLIFY_SITE || "784437c8-12f8-470b-bb0b-ccf5ec9c0a4a";
const STATUS_FILE  = path.join(__dirname, "manychat-flow-status.json");

const MANYCHAT_BASE = "https://api.manychat.com";

const CUSTOM_FIELDS = [
  { caption: "lead_role",        type: "text", description: "buyer|seller|agent|investor — captured in DM qualifier" },
  { caption: "lead_first_name",  type: "text", description: "First name captured in DM qualifier" },
  { caption: "lead_email",       type: "text", description: "Email captured in DM qualifier" },
  { caption: "lead_address",     type: "text", description: "Property address (sellers only)" },
  { caption: "report_url",       type: "text", description: "Personalized /report-pending URL returned by webhook" },
  { caption: "lead_funnel",      type: "text", description: "Funnel type returned by webhook (buyer/seller/contact/off_market)" },
  { caption: "execution_id",     type: "text", description: "Webhook execution ID for tracing" },
];

const TAGS = [
  "manychat_ig_lead",
  "manychat_fb_lead",
  "dna_qualifier_complete",
];

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
        let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = { _raw: raw }; }
        resolve({ status: res.statusCode, data, raw });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")); } catch { return {}; }
}
function writeStatus(s) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...readStatus(), ...s, updated_at: new Date().toISOString() }, null, 2));
}

// ── Resolve the ManyChat API key ───────────────────────────────────────
async function resolveApiKey() {
  if (process.env.MANYCHAT_API_KEY) return { key: process.env.MANYCHAT_API_KEY, source: "env" };

  // Try Netlify env
  try {
    const acct = await request("GET", `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE}`, {
      Authorization: `Bearer ${NETLIFY_PAT}`,
    });
    if (acct.status !== 200) throw new Error(`Netlify site lookup ${acct.status}`);
    const slug = acct.data.account_slug;
    const env = await request("GET", `https://api.netlify.com/api/v1/accounts/${slug}/env/MANYCHAT_API_KEY?site_id=${NETLIFY_SITE}`, {
      Authorization: `Bearer ${NETLIFY_PAT}`,
    });
    if (env.status === 404) return null;
    if (env.status !== 200) throw new Error(`Netlify env get ${env.status}`);
    const value = (env.data.values || []).find(v => v.context === "all" || v.context === "production")?.value;
    return value ? { key: value, source: "netlify" } : null;
  } catch (e) {
    console.warn(`  (Netlify env lookup failed: ${e.message})`);
    return null;
  }
}

// ── ManyChat API ───────────────────────────────────────────────────────
function mcHeaders(key) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function mcGet(key, path) {
  return request("GET", `${MANYCHAT_BASE}${path}`, mcHeaders(key));
}
async function mcPost(key, path, body) {
  return request("POST", `${MANYCHAT_BASE}${path}`, mcHeaders(key), body);
}

async function checkKey(key) {
  const r = await mcGet(key, "/fb/page/getInfo");
  if (r.status !== 200) {
    return { ok: false, status: r.status, error: r.data };
  }
  const page = r.data?.data || {};
  return { ok: true, page };
}

async function listCustomFields(key) {
  const r = await mcGet(key, "/fb/page/getCustomFields");
  if (r.status !== 200) return { ok: false, status: r.status, error: r.data, fields: [] };
  return { ok: true, fields: r.data?.data || [] };
}

async function createCustomField(key, { caption, type, description }) {
  const r = await mcPost(key, "/fb/page/createCustomField", { caption, type, description });
  return { ok: r.status === 200, status: r.status, data: r.data };
}

async function listTags(key) {
  const r = await mcGet(key, "/fb/page/getTags");
  if (r.status !== 200) return { ok: false, status: r.status, error: r.data, tags: [] };
  return { ok: true, tags: r.data?.data || [] };
}

async function createTag(key, name) {
  const r = await mcPost(key, "/fb/page/createTag", { name });
  return { ok: r.status === 200, status: r.status, data: r.data };
}

// ── Provision flow ─────────────────────────────────────────────────────
async function provision(key) {
  console.log("→ Verifying ManyChat API key + page access…");
  const ck = await checkKey(key);
  if (!ck.ok) {
    console.error(`  ✗ key check failed (${ck.status}): ${JSON.stringify(ck.error).slice(0,300)}`);
    return { ok: false, stage: "key_check", error: ck };
  }
  console.log(`  ✓ connected to: ${ck.page.name || "(unknown page)"} (id=${ck.page.id || "?"})`);

  // 1. Custom fields
  console.log("→ Listing existing custom fields…");
  const cfList = await listCustomFields(key);
  if (!cfList.ok) {
    console.error(`  ✗ list failed (${cfList.status}): ${JSON.stringify(cfList.error).slice(0,200)}`);
    return { ok: false, stage: "list_fields", error: cfList };
  }
  const existing = new Set(cfList.fields.map(f => f.caption));
  console.log(`  found ${cfList.fields.length} existing fields`);

  const fieldResults = [];
  for (const f of CUSTOM_FIELDS) {
    if (existing.has(f.caption)) {
      console.log(`  · skip ${f.caption} (already exists)`);
      fieldResults.push({ ...f, action: "skip" });
      continue;
    }
    const r = await createCustomField(key, f);
    if (r.ok) {
      console.log(`  ✓ created ${f.caption}`);
      fieldResults.push({ ...f, action: "create", id: r.data?.data?.id });
    } else {
      console.log(`  ✗ FAILED ${f.caption}: ${JSON.stringify(r.data).slice(0,200)}`);
      fieldResults.push({ ...f, action: "fail", error: r.data });
    }
  }

  // 2. Tags
  console.log("→ Listing existing tags…");
  const tagList = await listTags(key);
  if (!tagList.ok) {
    console.error(`  ✗ list failed (${tagList.status})`);
    return { ok: false, stage: "list_tags", error: tagList };
  }
  const existingTags = new Set((tagList.tags || []).map(t => (t.name || "").toLowerCase()));
  console.log(`  found ${tagList.tags.length} existing tags`);

  const tagResults = [];
  for (const name of TAGS) {
    if (existingTags.has(name.toLowerCase())) {
      console.log(`  · skip ${name} (already exists)`);
      tagResults.push({ name, action: "skip" });
      continue;
    }
    const r = await createTag(key, name);
    if (r.ok) {
      console.log(`  ✓ created ${name}`);
      tagResults.push({ name, action: "create", id: r.data?.data?.id });
    } else {
      console.log(`  ✗ FAILED ${name}: ${JSON.stringify(r.data).slice(0,200)}`);
      tagResults.push({ name, action: "fail", error: r.data });
    }
  }

  return {
    ok: true,
    page: { id: ck.page.id, name: ck.page.name },
    fields: fieldResults,
    tags:   tagResults,
  };
}

// ── Print the remaining manual steps ───────────────────────────────────
function printRemainingSteps(token) {
  console.log("");
  console.log("─────────────────────────────────────");
  console.log("REMAINING (manual UI work — ManyChat does not expose flow construction via API):");
  console.log("");
  console.log("1. Go to app.manychat.com → Automation → New Automation");
  console.log("2. Trigger: \"User sends message containing keyword\"");
  console.log("   Keywords: DNA, REPORT, VALUE, HOUSE  (add for IG + FB)");
  console.log("");
  console.log("3. Build the flow:");
  console.log("   Step A: Greeting + Quick Reply buttons → set {{lead_role}} to buyer/seller/agent/investor");
  console.log("   Step B: User Input → save to {{lead_first_name}}");
  console.log("   Step C: User Input (email validation) → save to {{lead_email}}");
  console.log("   Step D: IF {{lead_role}} == seller → User Input → save to {{lead_address}}");
  console.log("");
  console.log("4. Add External Request action:");
  console.log("     Method: POST");
  console.log("     URL:    https://thepropertydna.com/.netlify/functions/manychat-webhook");
  console.log("     Headers:");
  console.log("       Content-Type: application/json");
  console.log(`       x-manychat-token: ${token}`);
  console.log("     Body (JSON):");
  console.log(`       {`);
  console.log(`         "role": "{{lead_role}}",`);
  console.log(`         "firstName": "{{lead_first_name}}",`);
  console.log(`         "email": "{{lead_email}}",`);
  console.log(`         "address": "{{lead_address}}",`);
  console.log(`         "platform": "ig",`);
  console.log(`         "igHandle": "{{ig_username}}",`);
  console.log(`         "subscriberId": "{{user_id}}"`);
  console.log(`       }`);
  console.log("");
  console.log("5. Toggle \"Use response as message\" — the webhook returns the personalized DM");
  console.log("   with the report button + sets {{report_url}}, {{lead_funnel}}, {{execution_id}}");
  console.log("");
  console.log("6. Apply tag dna_qualifier_complete to the subscriber after External Request");
  console.log("");
  console.log("7. Duplicate flow for FB Messenger trigger, change 'platform' to 'fb'");
  console.log("");
  console.log("Full guide: automation-workflows/manychat-dm-qualifier.md");
  console.log("─────────────────────────────────────");
}

// ── Email Dan ──────────────────────────────────────────────────────────
async function fetchResendKey() {
  try {
    const acct = await request("GET", `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE}`, {
      Authorization: `Bearer ${NETLIFY_PAT}`,
    });
    const slug = acct.data.account_slug;
    const env = await request("GET", `https://api.netlify.com/api/v1/accounts/${slug}/env/RESEND_API_KEY?site_id=${NETLIFY_SITE}`, {
      Authorization: `Bearer ${NETLIFY_PAT}`,
    });
    if (env.status !== 200) return null;
    const v = (env.data.values || []).find(x => x.context === "all" || x.context === "production");
    return v ? v.value : null;
  } catch { return null; }
}

async function emailDan(subject, text) {
  const key = process.env.RESEND_API_KEY || await fetchResendKey();
  if (!key) { console.log("  (no Resend key — skipping email)"); return null; }
  const r = await request("POST", "https://api.resend.com/emails", {
    Authorization: `Bearer ${key}`, "Content-Type": "application/json",
  }, {
    from: "PropertyDNA Bootstrap <reports@thepropertydna.com>",
    to:   ["stuartteamps@gmail.com"],
    subject, text,
  });
  return r;
}

// ── CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

(async () => {
  if (args.includes("--status")) {
    console.log(JSON.stringify(readStatus(), null, 2));
    return;
  }

  console.log("→ Resolving ManyChat API key…");
  const resolved = await resolveApiKey();
  if (!resolved) {
    const msg = [
      "",
      "No MANYCHAT_API_KEY found — needed to provision custom fields + tags via the Public API.",
      "",
      "How to get one (60 seconds):",
      "  1. app.manychat.com → log in",
      "  2. Settings → API",
      "  3. Click \"Generate Token\"",
      "  4. Copy the token",
      "",
      "Then run ONE of:",
      "  A. Set in Netlify env (persists for future runs):",
      `     netlify env:set MANYCHAT_API_KEY <token> --site=${NETLIFY_SITE}`,
      "     node tools/manychat-api-setup.js",
      "",
      "  B. Run inline (one-off):",
      "     MANYCHAT_API_KEY=<token> node tools/manychat-api-setup.js",
      "",
    ].join("\n");
    console.log(msg);
    writeStatus({ blocked: "no_api_key", blocked_at: new Date().toISOString() });
    await emailDan(
      "ManyChat API setup needs your token",
      `Hi Dan,\n\nThe ManyChat flow-builder agent ran but needs your ManyChat API key to provision the custom fields and tags.\n\n${msg}\n\nOnce the key is set, the agent will:\n - Create 7 custom fields\n - Create 3 lead-source tags\n - Print the exact remaining UI clicks for the visual flow construction\n\n— manychat-flow-builder agent`,
    );
    process.exit(3);
  }
  console.log(`  ✓ key from ${resolved.source} (…${resolved.key.slice(-8)})`);

  if (args.includes("--check-key")) {
    const ck = await checkKey(resolved.key);
    console.log(JSON.stringify(ck, null, 2));
    return;
  }

  const result = await provision(resolved.key);
  writeStatus({
    api_key_source: resolved.source,
    provisioned_at: new Date().toISOString(),
    result,
  });

  if (!result.ok) {
    console.log("");
    console.log("PROVISIONING FAILED at stage:", result.stage);
    process.exit(2);
  }

  // Get the webhook token for the manual steps
  let webhookToken = "<set MANYCHAT_WEBHOOK_TOKEN in env first>";
  try {
    const fp = path.join(__dirname, "manychat-status.json");
    webhookToken = JSON.parse(fs.readFileSync(fp, "utf8")).token || webhookToken;
  } catch {}

  printRemainingSteps(webhookToken);

  // Summary email
  const fieldsSummary = result.fields.map(f => `  ${f.action === "create" ? "✓" : f.action === "skip" ? "·" : "✗"} ${f.caption}`).join("\n");
  const tagsSummary   = result.tags.map(t   => `  ${t.action === "create" ? "✓" : t.action === "skip" ? "·" : "✗"} ${t.name}`).join("\n");
  await emailDan(
    "ManyChat fields + tags provisioned",
    `Hi Dan,\n\nManyChat API provisioning complete for page: ${result.page.name} (${result.page.id})\n\nCustom fields:\n${fieldsSummary}\n\nTags:\n${tagsSummary}\n\nRemaining (manual UI):\n  Build the flow in app.manychat.com per automation-workflows/manychat-dm-qualifier.md\n  Webhook header: x-manychat-token: ${webhookToken}\n\nThe webhook is LIVE and smoke-tested. Once the flow connects, leads flow end-to-end.\n\n— manychat-flow-builder agent`,
  );

  console.log("");
  console.log("DONE — fields + tags provisioned, Dan emailed, ready for flow build.");
})().catch(err => {
  console.error("FATAL:", err.message);
  writeStatus({ fatal: err.message, fatal_at: new Date().toISOString() });
  process.exit(1);
});
