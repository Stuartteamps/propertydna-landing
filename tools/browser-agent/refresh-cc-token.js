#!/usr/bin/env node
/**
 * PropertyDNA — CC Token Auto-Refresh
 *
 * Uses refresh_token grant — no browser, no Playwright, just HTTP.
 * Runs every 23h via launchd cron.
 *
 * Manual run: node tools/browser-agent/refresh-cc-token.js
 */

const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const { execSync } = require('child_process');

const CREDS_FILE   = path.join(__dirname, '.cc-creds.json');
const LOG_FILE     = path.join(__dirname, 'refresh.log');
const CLIENT_ID    = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SEC   = 'UCMY_HNPbhCRENfCi_uK8g';
const NETLIFY_SITE = 'thepropertydna';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function refreshToken(refreshTok) {
  return new Promise((resolve, reject) => {
    const body  = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshTok)}`;
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
    execSync(
      `netlify env:set ${key} "${value.replace(/"/g, '\\"')}" --site ${NETLIFY_SITE} --force`,
      { stdio: 'pipe', timeout: 30000 }
    );
    return true;
  } catch (e) {
    log(`netlify env:set failed: ${e.message.slice(0, 100)}`);
    return false;
  }
}

(async () => {
  log('=== CC token refresh starting ===');

  if (!fs.existsSync(CREDS_FILE)) {
    log('ERROR: .cc-creds.json not found');
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  if (!creds.refresh_token) {
    log('ERROR: No refresh_token in creds file');
    process.exit(1);
  }

  log('Using refresh_token grant (no browser needed)...');
  const { status, data } = await refreshToken(creds.refresh_token);

  if (status !== 200 || !data.access_token) {
    log(`ERROR: Token refresh failed: ${status} ${JSON.stringify(data)}`);
    process.exit(1);
  }

  log(`New access_token obtained (expires in ${data.expires_in}s)`);

  // If CC rotates the refresh token, save the new one
  if (data.refresh_token && data.refresh_token !== creds.refresh_token) {
    creds.refresh_token = data.refresh_token;
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
    log('Refresh token rotated — saved new one');
    setNetlifyEnv('CC_REFRESH_TOKEN', data.refresh_token);
  }

  const ok = setNetlifyEnv('CC_ACCESS_TOKEN', data.access_token);
  if (ok) {
    log('CC_ACCESS_TOKEN updated in Netlify ✓');
  } else {
    log(`Manual set needed: CC_ACCESS_TOKEN=${data.access_token.slice(0, 30)}...`);
  }

  log('=== CC token refresh complete ===\n');
  process.exit(0);

})().catch(e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
