#!/usr/bin/env node
/**
 * PropertyDNA — CC Token Auto-Refresh
 *
 * Runs headlessly every 23h via launchd.
 * Uses saved browser session (cookies) to bypass Cloudflare on CC login page.
 *
 * One-time setup:
 *   node tools/browser-agent/save-cc-session.js   ← run this first
 *
 * Manual run / cron:
 *   node tools/browser-agent/refresh-cc-token.js
 */

const { chromium }  = require('playwright');
const https         = require('https');
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');

const SESSION_FILE = path.join(__dirname, '.cc-session.json');
const LOG_FILE     = path.join(__dirname, 'refresh.log');
const CLIENT_ID    = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SEC   = 'UCMY_HNPbhCRENfCi_uK8g';
const REDIRECT_URI = 'https://localhost';
const NETLIFY_SITE = 'thepropertydna';

const AUTH_URL = `https://authz.constantcontact.com/oauth2/default/v1/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=contact_data+campaign_data` +
  `&state=pdna_auto`;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function exchangeToken(code) {
  return new Promise((resolve, reject) => {
    const body = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}`).toString('base64');
    const req = https.request({
      hostname: 'authz.constantcontact.com',
      path: '/oauth2/default/v1/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function setNetlifyEnv(key, value) {
  try {
    execSync(`netlify env:set ${key} "${value.replace(/"/g, '\\"')}" --site ${NETLIFY_SITE} --force`, {
      stdio: 'pipe', timeout: 30000,
    });
    return true;
  } catch (e) {
    log(`netlify env:set failed: ${e.message.slice(0, 100)}`);
    return false;
  }
}

(async () => {
  log('=== CC token refresh starting ===');

  // Require saved session (created by save-cc-session.js)
  if (!fs.existsSync(SESSION_FILE)) {
    log('ERROR: No session found. Run: node tools/browser-agent/save-cc-session.js');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE,  // restore cookies from saved login
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let authCode = null;

  // Navigate to auth URL — CC auto-approves since app is already authorized + cookies are set
  log('Navigating to auth URL with saved session...');
  try {
    const redirectPromise = page.waitForURL(/localhost.*code=/, { timeout: 20000 });
    await page.goto(AUTH_URL, { waitUntil: 'commit', timeout: 20000 }).catch(() => {});
    await redirectPromise;
    const url = page.url();
    const match = url.match(/[?&]code=([^&]+)/);
    if (match) authCode = decodeURIComponent(match[1]);
  } catch {
    // Localhost blocked by browser — read from current URL bar
    const url = page.url();
    const match = url.match(/[?&]code=([^&]+)/);
    if (match) authCode = decodeURIComponent(match[1]);
  }

  // If session expired, we need a re-login — alert and exit
  if (!authCode) {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('okta')) {
      log('ERROR: Session expired. Re-run: node tools/browser-agent/save-cc-session.js');
    } else {
      log(`ERROR: No auth code. Current URL: ${currentUrl.slice(0, 100)}`);
    }
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  if (!authCode) {
    log('ERROR: Could not capture auth code. CC may require re-authorization.');
    log('Run: node tools/browser-agent/setup-cc.js  to re-authorize manually.');
    process.exit(1);
  }

  log(`Auth code captured: ${authCode.slice(0, 15)}...`);

  // Step 3: Exchange for token
  log('Exchanging code for token...');
  const { status, data } = await exchangeToken(authCode);
  if (status !== 200 || !data.access_token) {
    log(`Token exchange failed: ${status} ${JSON.stringify(data)}`);
    process.exit(1);
  }

  const token = data.access_token;
  log(`New token obtained (expires in ${data.expires_in}s)`);

  // Step 4: Update Netlify
  log('Updating Netlify env var...');
  const ok = setNetlifyEnv('CC_ACCESS_TOKEN', token);
  if (ok) {
    log('CC_ACCESS_TOKEN updated in Netlify ✓');
  } else {
    log('Netlify update failed — token printed below for manual set:');
    log(`CC_ACCESS_TOKEN=${token}`);
  }

  log('=== CC token refresh complete ===\n');
  process.exit(0);

})().catch(e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
