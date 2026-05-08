#!/usr/bin/env node
/**
 * One-time setup: opens a real browser window, you log into CC manually,
 * then saves your session cookies for use by the headless auto-refresh cron.
 *
 * Run once (or whenever your session expires):
 *   node tools/browser-agent/save-cc-session.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const SESSION_FILE = path.join(__dirname, '.cc-session.json');

(async () => {
  const AUTH_URL =
    'https://authz.constantcontact.com/oauth2/default/v1/authorize' +
    '?client_id=f626272f-4940-42e3-b0d6-d4ffc0366337' +
    '&redirect_uri=https%3A%2F%2Flocalhost' +
    '&response_type=code' +
    '&scope=contact_data+campaign_data' +
    '&state=pdna_session_save';

  console.log('\n=== CC Session Saver ===');
  console.log('A browser window will open showing the CC/Okta login.');
  console.log('Log in with: stuartteamps@gmail.com / #1Slugger#1');
  console.log('The script finishes automatically once you authorize.\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Navigate directly to the OAuth URL — this hits Okta, which is what needs the session
  console.log('→ Opening OAuth auth URL (this is where the real session lives)...');
  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  console.log('→ Please log in. Waiting for redirect to localhost (up to 2 min)...\n');

  // Wait for the localhost redirect — means user logged in and approved the app
  await page.waitForURL(/localhost/, { timeout: 120000 }).catch(() => {});

  // Capture auth code from the redirect URL while we're here
  const redirectUrl = page.url();
  const codeMatch = redirectUrl.match(/[?&]code=([^&]+)/);
  if (codeMatch) {
    console.log('→ Auth code captured! Exchanging for token...');
    const code = decodeURIComponent(codeMatch[1]);

    // Exchange immediately so we start with a fresh token
    const https = require('https');
    const body = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=https%3A%2F%2Flocalhost`;
    const creds = Buffer.from('f626272f-4940-42e3-b0d6-d4ffc0366337:UCMY_HNPbhCRENfCi_uK8g').toString('base64');
    const tokenData = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'authz.constantcontact.com', path: '/oauth2/default/v1/token', method: 'POST',
        headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
      req.on('error', () => resolve({}));
      req.write(body); req.end();
    });

    if (tokenData.access_token) {
      const { execSync } = require('child_process');
      try {
        execSync(`netlify env:set CC_ACCESS_TOKEN "${tokenData.access_token}" --site thepropertydna --force`, { stdio: 'pipe' });
        console.log('✓ CC_ACCESS_TOKEN updated in Netlify');
      } catch { console.log('  (update Netlify manually if needed)'); }
    }
  }

  // Save the full session state — crucially includes Okta cookies on identity.constantcontact.com
  const state = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state), { mode: 0o600 });

  const domains = [...new Set(state.cookies.map(c => c.domain))];
  console.log(`\n✓ Session saved — ${state.cookies.length} cookies across: ${domains.join(', ')}`);
  console.log('✓ Headless auto-refresh will now use these Okta session cookies');
  console.log('\nTest: node tools/browser-agent/refresh-cc-token.js\n');

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
