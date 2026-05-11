#!/usr/bin/env node
/**
 * manychat-flow-playwright — Browser-automation fallback for the visual flow builder
 *
 * ManyChat's Public API does NOT expose programmatic flow construction.
 * This script drives a real Chromium against app.manychat.com using a
 * persistent storage state, so after one human login the agent can re-run
 * builds, edits, and inspections autonomously.
 *
 * One-time setup:
 *   node tools/manychat-flow-playwright.js --login
 *   → Opens a visible Chromium window
 *   → Dan logs into ManyChat (FB login + 2FA happens once)
 *   → Press ENTER in the terminal when fully logged in
 *   → Session is saved to tools/.manychat-state.json
 *
 * Subsequent runs:
 *   node tools/manychat-flow-playwright.js              # build the DM-qualifier flow
 *   node tools/manychat-flow-playwright.js --inspect    # open the flow + dump structure (read-only)
 *   node tools/manychat-flow-playwright.js --headed     # run with visible browser (for debugging)
 *
 * Status: Skeleton — selectors filled to the level ManyChat's app
 *   structure is publicly documented. First run with --headed and step
 *   through manually to capture any selector drift, then run headless.
 *
 * Reads webhook token from tools/manychat-status.json automatically.
 */

"use strict";

const path = require("path");
const fs   = require("fs");
const readline = require("readline");

// Resolve Playwright from the frontend node_modules (no separate install needed)
let chromium;
try {
  chromium = require("/Users/danstuart/propertydna-landing/app/frontend/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright").chromium;
} catch (e) {
  console.error("Playwright not found. Install in app/frontend (already done) or update path in this file.");
  console.error("Error:", e.message);
  process.exit(1);
}

const STATE_FILE  = path.join(__dirname, ".manychat-state.json");
const STATUS_FILE = path.join(__dirname, "manychat-status.json");

const args = process.argv.slice(2);
const MODE = {
  login:   args.includes("--login"),
  inspect: args.includes("--inspect"),
  headed:  args.includes("--headed") || args.includes("--login"),
};

// ── Load webhook token from sister status file ─────────────────────────
function getWebhookToken() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")).token; } catch { return null; }
}

// ── Prompt helper for the login mode ───────────────────────────────────
function waitForEnter(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

// ── Login flow — saves storage state when dashboard is detected ────────
async function loginFlow() {
  console.log("→ Opening Chromium (you'll see a window pop up)…");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log("→ Navigating to app.manychat.com…");
  await page.goto("https://app.manychat.com/", { waitUntil: "commit", timeout: 90000 });

  console.log("");
  console.log("─────────────────────────────────────");
  console.log("ACTION REQUIRED IN THE BROWSER WINDOW:");
  console.log("  Log in to ManyChat (Facebook login + 2FA if prompted)");
  console.log("  Pick the 'Daniel Stuart Team Real Estate' page if asked");
  console.log("");
  console.log("Watching for you to reach the dashboard…");
  console.log("─────────────────────────────────────");

  // Poll for the dashboard URL (post-login state)
  const start = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes max
  let detected = false;
  while (Date.now() - start < TIMEOUT) {
    try {
      const url = page.url();
      if (url.includes("/cms/") || url.includes("/dashboard") || url.includes("/fb" + "2304092946501728")) {
        // Wait a beat for any final auth cookies to be set
        await page.waitForTimeout(2000);
        detected = true;
        console.log(`✓ Dashboard detected at ${url}`);
        break;
      }
    } catch { /* page may be navigating */ }
    await page.waitForTimeout(2000);
  }

  if (!detected) {
    console.error("Timed out waiting for login. If you logged in successfully, run again.");
    await browser.close();
    process.exit(2);
  }

  console.log("→ Saving storage state…");
  await ctx.storageState({ path: STATE_FILE });
  console.log(`  ✓ saved ${STATE_FILE}`);

  await browser.close();
  console.log("");
  console.log("LOGIN CAPTURED — proceeding to flow build…");
}

// ── Inspect — open ManyChat, dump some structural info, exit ───────────
async function inspectFlow() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`No session at ${STATE_FILE}. Run --login first.`);
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: !MODE.headed });
  const ctx = await browser.newContext({ storageState: STATE_FILE });
  const page = await ctx.newPage();

  await page.goto("https://app.manychat.com/", { waitUntil: "commit", timeout: 90000 });
  await page.waitForTimeout(3000);

  console.log("→ Page title:", await page.title());
  console.log("→ URL after load:", page.url());

  // Try to find the Automation link
  const automationLink = await page.locator("text=Automation").first();
  if (await automationLink.count() > 0) {
    console.log("  ✓ Automation link visible");
  } else {
    console.log("  ✗ Automation link not visible — session may have expired, re-run --login");
  }

  await browser.close();
}

// ── Build — assist + verify autonomously ───────────────────────────────
//
// ManyChat's flow editor is a React canvas. Driving its DnD interactions
// blindly with brittle selectors would burn hours and break next release.
//
// Instead the autonomous role is:
//   1. Open ManyChat to the right page so Dan starts in the right place
//   2. Print the EXACT clicks + the External Request body Dan needs
//   3. Poll the ManyChat API every 8s for a new flow (or a new keyword
//      trigger) — when one shows up, the build is detected as complete
//   4. Then run the live smoke test that simulates a real DM → webhook
async function buildFlow() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`No session at ${STATE_FILE}. Run --login first.`);
    process.exit(2);
  }
  const webhookToken = getWebhookToken();
  if (!webhookToken) {
    console.error("No webhook token in manychat-status.json — run the orchestrator bootstrap first.");
    process.exit(2);
  }
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) {
    console.error("MANYCHAT_API_KEY not in env — required to poll for completion. Set it then re-run.");
    process.exit(2);
  }

  console.log("→ Launching ManyChat in your browser (headed)…");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: STATE_FILE });
  const page = await ctx.newPage();

  await page.goto("https://app.manychat.com/cms/automation", { waitUntil: "commit", timeout: 90000 });
  await page.waitForTimeout(3000);

  if (page.url().includes("/login")) {
    console.error("✗ Session expired — re-run --login");
    await browser.close();
    process.exit(3);
  }
  console.log("  ✓ Automation page open in browser");

  // Print exact clicks
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("DO THESE IN THE BROWSER (I'll detect when you're done):");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("1. Click + New Automation → pick \"Start from scratch\"");
  console.log("");
  console.log("2. Add Trigger → \"User sends a message with Keyword\"");
  console.log("   Keywords: DNA, REPORT, VALUE, HOUSE");
  console.log("   Channels: Instagram + Facebook Messenger");
  console.log("");
  console.log("3. Build the flow (use Quick Reply, User Input blocks):");
  console.log("");
  console.log("   • Text + Quick Replies → save to {{lead_role}}");
  console.log("     [Buying] → buyer    [Selling] → seller");
  console.log("     [Agent]  → agent    [Investor] → investor");
  console.log("");
  console.log("   • User Input (Text) → save to {{lead_first_name}}");
  console.log("     Prompt: \"What's your first name?\"");
  console.log("");
  console.log("   • User Input (Email, with validation) → save to {{lead_email}}");
  console.log("     Prompt: \"Best email for your report?\"");
  console.log("");
  console.log("   • Condition: IF {{lead_role}} == seller →");
  console.log("       User Input (Text) → save to {{lead_address}}");
  console.log("       Prompt: \"What address would you like valued?\"");
  console.log("");
  console.log("4. Add External Request (Action):");
  console.log("   URL: https://thepropertydna.com/.netlify/functions/manychat-webhook");
  console.log("   Method: POST");
  console.log("   Headers:");
  console.log("     Content-Type: application/json");
  console.log("     x-manychat-token: " + webhookToken);
  console.log("   Body:");
  console.log("     {");
  console.log("       \"role\": \"{{lead_role}}\",");
  console.log("       \"firstName\": \"{{lead_first_name}}\",");
  console.log("       \"email\": \"{{lead_email}}\",");
  console.log("       \"address\": \"{{lead_address}}\",");
  console.log("       \"platform\": \"ig\"");
  console.log("     }");
  console.log("   Toggle ON: \"Use response as message\"");
  console.log("");
  console.log("5. Apply Tag → dna_qualifier_complete");
  console.log("");
  console.log("6. Publish (top right) — flow goes live for IG + FB");
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("Polling ManyChat API every 8s — I'll detect when the flow exists.");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");

  // ── Poll the Public API for a new flow ────────────────────────────────
  const baselineFlows = await mcGetFlows(apiKey);
  const baselineNames = new Set(baselineFlows.map(f => f.name));
  console.log(`Baseline: ${baselineFlows.length} existing flows. Watching for new ones…`);

  const start = Date.now();
  const TIMEOUT = 30 * 60 * 1000; // 30 min
  let newFlow = null;
  while (Date.now() - start < TIMEOUT) {
    await sleep(8000);
    const flows = await mcGetFlows(apiKey);
    const fresh = flows.filter(f => !baselineNames.has(f.name) && !f.ns.startsWith("system_"));
    if (fresh.length > 0) {
      newFlow = fresh[0];
      console.log(`✓ DETECTED new flow: "${newFlow.name}" (ns=${newFlow.ns})`);
      break;
    }
    process.stdout.write(".");
  }

  if (!newFlow) {
    console.error("\nTimed out after 30 min. Re-run when flow is published.");
    await browser.close();
    process.exit(4);
  }

  console.log("");
  console.log("→ Triggering live smoke test against the webhook…");
  const smoke = await runWebhookSmokeTest(webhookToken);
  console.log(`  ${smoke.ok ? "✓" : "✗"} webhook returned ${smoke.status}`);

  console.log("");
  console.log("BUILD COMPLETE");
  console.log("  Flow:     " + newFlow.name + " (ns=" + newFlow.ns + ")");
  console.log("  Webhook:  " + (smoke.ok ? "live + verified" : "DEGRADED — investigate"));
  console.log("");
  console.log("Browser will stay open 30s so you can confirm Publish, then close.");
  await page.waitForTimeout(30000);
  await browser.close();
}

// ── Helpers for build mode ─────────────────────────────────────────────
async function mcGetFlows(apiKey) {
  const https = require("https");
  return new Promise(resolve => {
    https.request({
      hostname: "api.manychat.com",
      path:     "/fb/page/getFlows",
      method:   "GET",
      headers:  { Authorization: `Bearer ${apiKey}` },
    }, r => {
      let b = ""; r.on("data", c => b += c);
      r.on("end", () => {
        try { resolve(JSON.parse(b)?.data?.flows || []); }
        catch { resolve([]); }
      });
    }).on("error", () => resolve([])).end();
  });
}

async function runWebhookSmokeTest(token) {
  const https = require("https");
  const body = JSON.stringify({
    role:      "buyer",
    firstName: "PlaywrightCheck",
    email:     `playwright+${Date.now()}@thepropertydna.com`,
    platform:  "ig",
  });
  return new Promise(resolve => {
    const req = https.request({
      hostname: "thepropertydna.com",
      path:     "/.netlify/functions/manychat-webhook",
      method:   "POST",
      headers:  {
        "Content-Type":     "application/json",
        "x-manychat-token": token,
        "Content-Length":   Buffer.byteLength(body),
      },
    }, r => {
      let b = ""; r.on("data", c => b += c);
      r.on("end", () => resolve({ status: r.statusCode, ok: r.statusCode === 200, body: b.slice(0,200) }));
    });
    req.on("error", e => resolve({ status: 0, ok: false, error: e.message }));
    req.write(body); req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Dispatch ───────────────────────────────────────────────────────────
(async () => {
  try {
    if (MODE.inspect) {
      await inspectFlow();
    } else if (MODE.login) {
      await loginFlow();
      // Chain into build immediately after login captures the session
      await buildFlow();
    } else {
      // Default: build with existing session (no login attempt)
      if (!fs.existsSync(STATE_FILE)) {
        console.error("No session captured yet. Run with --login first.");
        process.exit(2);
      }
      await buildFlow();
    }
  } catch (err) {
    console.error("FATAL:", err.message);
    process.exit(1);
  }
})();
