#!/usr/bin/env node
/**
 * PropertyDNA — Constant Contact OAuth Setup Automation
 *
 * Automates:
 *   1. Opens CC V3 developer portal in a real browser (you log in once)
 *   2. Extracts / regenerates the client secret from your app
 *   3. Exchanges the auth code for access + refresh tokens
 *   4. Sets CC_ACCESS_TOKEN + CC_REFRESH_TOKEN in Netlify env
 *   5. Activates the n8n weekly newsletter workflow
 *
 * Usage:
 *   cd tools/browser-agent && npm install && node setup-cc.js
 */

const { chromium } = require('playwright');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const CC_CLIENT_ID    = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CC_REDIRECT_URI = 'https://localhost';
const CC_AUTH_URL     = `https://authz.constantcontact.com/oauth2/default/v1/authorize?client_id=${CC_CLIENT_ID}&redirect_uri=${encodeURIComponent(CC_REDIRECT_URI)}&response_type=code&scope=contact_data+campaign_data&state=pdna2026`;
const CC_TOKEN_URL    = 'https://authz.constantcontact.com/oauth2/default/v1/token';
const CC_DEV_PORTAL   = 'https://v3.developer.constantcontact.com/login/index.html';

const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID || '';
const NETLIFY_TOKEN   = process.env.NETLIFY_TOKEN   || '';
const N8N_WORKFLOW_ID = 'uswrWxe5penQ6pbu';
const N8N_BASE        = 'https://dillabean.app.n8n.cloud/api/v1';
const N8N_API_KEY     = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlOTJlZTM2NS1hOTRlLTRjYjctOGU2Mi1hNDRlMGRiYjRhYTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGEwYWFjODQtMDZiYi00NzY1LTlhZjItYmU1NTM2YzMyOTIzIiwiaWF0IjoxNzc3NTkwNjMyLCJleHAiOjE3ODAxMjQ0MDB9.nXfImu2-7GRaWRwWduMkoAWDyikEvirFKNkmSY_CP0U';

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) { console.log(`\n[CC-SETUP] ${msg}`); }
function ok(msg)  { console.log(`\x1b[32m✓ ${msg}\x1b[0m`); }
function err(msg) { console.log(`\x1b[31m✗ ${msg}\x1b[0m`); }
function info(msg){ console.log(`\x1b[33m→ ${msg}\x1b[0m`); }

function req(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function exchangeToken(clientId, clientSecret, code) {
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body  = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(CC_REDIRECT_URI)}`;
  return req('POST', CC_TOKEN_URL, body, {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

async function setNetlifyEnvVar(key, value) {
  if (!NETLIFY_SITE_ID || !NETLIFY_TOKEN) {
    info(`Netlify not configured — set manually: ${key}=${value.slice(0, 20)}...`);
    return false;
  }
  const r = await req('PATCH',
    `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/env`,
    { [key]: value },
    { Authorization: `Bearer ${NETLIFY_TOKEN}` }
  );
  return r.status === 200;
}

async function activateN8nWorkflow() {
  const r = await req('PATCH',
    `${N8N_BASE}/workflows/${N8N_WORKFLOW_ID}`,
    { active: true },
    { 'X-N8N-API-KEY': N8N_API_KEY }
  );
  return r.status === 200;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    channel: undefined, // uses Playwright's bundled Chromium (headed)
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // ── Step 1: Navigate to CC dev portal ────────────────────────────────────
  log('Opening Constant Contact V3 Developer Portal...');
  info('Please log in with your Constant Contact credentials.');
  info('The script will wait for you to be on the app dashboard.');

  await page.goto(CC_DEV_PORTAL);

  // Wait for the user to log in — watch for URL change away from login page
  info('Waiting for you to log in (up to 2 minutes)...');
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('login'),
      { timeout: 120000, polling: 1000 }
    );
    ok('Login detected!');
  } catch {
    info('Login timeout — continuing anyway...');
  }
  await page.waitForTimeout(2000);

  // ── Step 2: Find the app and get/generate secret ──────────────────────────
  log('Looking for your app with client ID: ' + CC_CLIENT_ID);

  let clientSecret = null;

  // Try to find the app row containing the client ID
  try {
    await page.waitForTimeout(2000);
    const pageText = await page.textContent('body');

    if (pageText.includes(CC_CLIENT_ID)) {
      ok('Found your app on the page!');

      // Look for a "Generate Secret" or "Show Secret" button
      const revealBtn = page.locator('button, a').filter({ hasText: /generate|secret|reveal|show|regenerate/i }).first();
      if (await revealBtn.isVisible({ timeout: 3000 })) {
        info('Clicking secret reveal/generate button...');
        await revealBtn.click();
        await page.waitForTimeout(1500);
      }

      // Try to read the secret from the page
      const secretInput = page.locator('input[type="text"], input[type="password"], .secret, [class*="secret"]').first();
      if (await secretInput.isVisible({ timeout: 3000 })) {
        clientSecret = await secretInput.inputValue();
        if (clientSecret && clientSecret.length > 10) {
          ok(`Client secret extracted: ${clientSecret.slice(0, 8)}...`);
        }
      }
    }
  } catch (e) {
    info('Auto-extraction failed — will prompt manually.');
  }

  // Fallback: ask Dan to copy the secret manually
  if (!clientSecret || clientSecret.length < 10) {
    info('\n──────────────────────────────────────────────');
    info('Could not auto-extract the secret.');
    info('Please:');
    info('  1. Find your app in the portal (client ID: ' + CC_CLIENT_ID + ')');
    info('  2. Click "Generate New Secret" or "Reveal Secret"');
    info('  3. Copy the secret value');
    info('  4. Come back here and type/paste it:');
    info('──────────────────────────────────────────────');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    clientSecret = await new Promise(resolve => {
      rl.question('\nPaste your CC Client Secret here: ', answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!clientSecret || clientSecret.length < 5) {
    err('No client secret provided. Exiting.');
    await browser.close();
    process.exit(1);
  }

  ok(`Client secret ready: ${clientSecret.slice(0, 8)}...`);

  // ── Step 3: Generate auth code ────────────────────────────────────────────
  log('Opening OAuth authorization URL...');
  info('This will redirect to https://localhost — the browser will show an error. That is expected.');
  info('Copy the full URL from the address bar when it redirects.');

  await page.goto(CC_AUTH_URL);

  let authCode = null;

  // Watch for the redirect to localhost
  try {
    await page.waitForURL('https://localhost/**', { timeout: 30000 });
    const redirectUrl = page.url();
    const match = redirectUrl.match(/[?&]code=([^&]+)/);
    if (match) {
      authCode = decodeURIComponent(match[1]);
      ok(`Auth code captured automatically: ${authCode.slice(0, 15)}...`);
    }
  } catch {
    // Browser can't load localhost — read from address bar text or ask
    info('Browser blocked localhost redirect (expected). Reading URL...');
    try {
      const currentUrl = page.url();
      const match = currentUrl.match(/[?&]code=([^&]+)/);
      if (match) {
        authCode = decodeURIComponent(match[1]);
        ok(`Auth code from URL: ${authCode.slice(0, 15)}...`);
      }
    } catch {}
  }

  if (!authCode) {
    info('\nCould not auto-capture the auth code.');
    info('Please look at your browser address bar — the URL should look like:');
    info('  https://localhost/?code=XXXXXXXX&state=pdna2026');
    info('Copy the code= value and paste it here:');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    authCode = await new Promise(resolve => {
      rl.question('\nPaste the auth code here: ', answer => {
        rl.close();
        resolve(answer.trim().replace(/^code=/, ''));
      });
    });
  }

  if (!authCode) {
    err('No auth code. Exiting.');
    await browser.close();
    process.exit(1);
  }

  // ── Step 4: Exchange for tokens ───────────────────────────────────────────
  log('Exchanging auth code for tokens...');
  await browser.close();

  const tokenRes = await exchangeToken(CC_CLIENT_ID, clientSecret, authCode);
  if (tokenRes.status !== 200) {
    err(`Token exchange failed: ${JSON.stringify(tokenRes.data)}`);
    process.exit(1);
  }

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  ok(`Access token: ${access_token.slice(0, 20)}...`);
  ok(`Refresh token: ${refresh_token.slice(0, 20)}...`);
  info(`Expires in: ${expires_in}s (~${Math.round(expires_in / 3600)}h)`);

  // ── Step 5: Save tokens ───────────────────────────────────────────────────
  log('Saving tokens...');

  console.log('\n\x1b[36m══════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[36mADD THESE TO NETLIFY ENV VARS:\x1b[0m');
  console.log(`\x1b[33mCC_ACCESS_TOKEN\x1b[0m=${access_token}`);
  console.log(`\x1b[33mCC_REFRESH_TOKEN\x1b[0m=${refresh_token}`);
  console.log(`\x1b[33mCC_CLIENT_ID\x1b[0m=${CC_CLIENT_ID}`);
  console.log(`\x1b[33mCC_CLIENT_SECRET\x1b[0m=${clientSecret}`);
  console.log('\x1b[36m══════════════════════════════════════════════════\x1b[0m\n');

  // Try Netlify API (needs NETLIFY_SITE_ID + NETLIFY_TOKEN env vars)
  if (NETLIFY_SITE_ID && NETLIFY_TOKEN) {
    const vars = { CC_ACCESS_TOKEN: access_token, CC_REFRESH_TOKEN: refresh_token,
                   CC_CLIENT_SECRET: clientSecret };
    for (const [k, v] of Object.entries(vars)) {
      const set = await setNetlifyEnvVar(k, v);
      set ? ok(`Netlify env: ${k} set`) : err(`Netlify env: ${k} failed`);
    }
  } else {
    info('NETLIFY_SITE_ID / NETLIFY_TOKEN not set — copy the values above to Netlify manually.');
    info('Netlify → Site → Environment Variables → Add variable');
  }

  // ── Step 6: Activate n8n workflow ─────────────────────────────────────────
  log('Activating n8n weekly newsletter workflow...');
  const activated = await activateN8nWorkflow();
  activated ? ok('n8n workflow activated!') : err('n8n activation failed — activate manually in n8n dashboard');

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n\x1b[32m══════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[32m✓ CONSTANT CONTACT OAUTH COMPLETE\x1b[0m');
  console.log('\x1b[32m══════════════════════════════════════════════════\x1b[0m');
  info('Next: run the CC contact sync to push skip-traced contacts to CC lists');
  info('Command: node tools/browser-agent/sync-cc-contacts.js');

})().catch(e => {
  console.error('\n[FATAL]', e.message);
  process.exit(1);
});
