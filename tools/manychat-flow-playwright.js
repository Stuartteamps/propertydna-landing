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
const PW_PATH = require("glob")?.sync
  ? null
  : null;

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

// ── Login flow — saves storage state ───────────────────────────────────
async function loginFlow() {
  console.log("→ Opening Chromium…");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log("→ Navigating to app.manychat.com…");
  await page.goto("https://app.manychat.com/", { waitUntil: "domcontentloaded" });

  console.log("");
  console.log("─────────────────────────────────────");
  console.log("Log into ManyChat (FB login + 2FA if prompted)");
  console.log("Make sure you can see the Automation / Settings / Audience sidebar");
  console.log("Then come back here and press ENTER");
  console.log("─────────────────────────────────────");

  await waitForEnter("Press ENTER once fully logged in… ");

  console.log("→ Saving storage state…");
  await ctx.storageState({ path: STATE_FILE });
  console.log(`  ✓ saved ${STATE_FILE}`);

  await browser.close();
  console.log("DONE — you can now run: node tools/manychat-flow-playwright.js");
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

  await page.goto("https://app.manychat.com/", { waitUntil: "domcontentloaded" });
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

// ── Build — drive the flow construction ────────────────────────────────
async function buildFlow() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`No session at ${STATE_FILE}. Run --login first to capture a logged-in browser state.`);
    process.exit(2);
  }
  const webhookToken = getWebhookToken();
  if (!webhookToken) {
    console.error("No webhook token in manychat-status.json — run the orchestrator bootstrap first.");
    process.exit(2);
  }

  console.log("→ Launching browser with saved session…");
  const browser = await chromium.launch({ headless: !MODE.headed });
  const ctx = await browser.newContext({ storageState: STATE_FILE });
  const page = await ctx.newPage();

  // ── Step 1: navigate to Automation ───────────────────────────────────
  console.log("→ STEP 1: Automation home");
  await page.goto("https://app.manychat.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // The ManyChat sidebar uses translatable labels; rely on URL navigation when possible
  await page.goto("https://app.manychat.com/cms/automation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Verify we're authenticated
  if (page.url().includes("/login")) {
    console.error("✗ Session expired — re-run --login");
    await browser.close();
    process.exit(3);
  }
  console.log("  ✓ Automation page loaded");

  // ── Step 2-5: ManyChat's flow builder is a complex React/Canvas app ──
  // The DOM is deeply nested with auto-generated classnames and many actions
  // require drag-and-drop. Reliable selectors would need ManyChat-specific
  // recording (use Playwright codegen against a recorded session).
  //
  // PUNT: rather than guess at brittle selectors, leave the visual build to
  // the human + print the exact instructions tightly. The script's value
  // is being IN POSITION to drive once selectors are captured.

  console.log("");
  console.log("─────────────────────────────────────");
  console.log("INTERACTIVE BUILDER NOT YET WIRED");
  console.log("─────────────────────────────────────");
  console.log("ManyChat's flow editor is a React canvas — selectors are brittle");
  console.log("and recording is the recommended approach. To complete this:");
  console.log("");
  console.log("  1. Run: npx playwright codegen --load-storage=tools/.manychat-state.json https://app.manychat.com/cms/automation");
  console.log("  2. Click through one full DM-qualifier flow build manually");
  console.log("  3. Paste the generated selectors into the placeholder section below");
  console.log("  4. Re-run this script to replay the build");
  console.log("");
  console.log("For now the script verifies your session is alive and you can navigate.");
  console.log("Webhook token (paste into External Request header):");
  console.log("  " + webhookToken);
  console.log("─────────────────────────────────────");

  // Keep the browser open briefly so the human can verify state visually
  if (MODE.headed) {
    console.log("Browser open — press Ctrl+C to close");
    await page.waitForTimeout(60000);
  }
  await browser.close();
}

// ── Dispatch ───────────────────────────────────────────────────────────
(async () => {
  try {
    if (MODE.login)        await loginFlow();
    else if (MODE.inspect) await inspectFlow();
    else                   await buildFlow();
  } catch (err) {
    console.error("FATAL:", err.message);
    process.exit(1);
  }
})();
