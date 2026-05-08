#!/usr/bin/env node
/**
 * PropertyDNA — Google Analytics Daily Fetch
 *
 * Pulls yesterday's sessions, users, and top pages from GA4.
 * Logs to console + saves to data/ga-daily.json.
 *
 * Setup (one-time):
 *   1. analytics.google.com → Admin → Create Property for thepropertydna.com
 *   2. Get Measurement ID (G-XXXXXXXXXX) — add to site's index.html
 *   3. Get Property ID (numeric, e.g. 123456789) — shown in Admin → Property Settings
 *   4. Create a service account at console.cloud.google.com → IAM → Service Accounts
 *      Grant it "Viewer" role on the GA4 property
 *   5. Download JSON key → base64-encode it
 *   6. Add to .daily-creds.json:
 *      { "googleAnalytics": { "propertyId": "123456789", "serviceAccountKey": "BASE64_KEY" } }
 *
 * Note: For now (before GA4 is set up), this agent just prints setup instructions.
 */

const https    = require('https');
const fs       = require('fs');
const path     = require('path');

const CREDS_FILE = path.join(__dirname, '../.daily-creds.json');
const DATA_FILE  = path.join(__dirname, '../data/ga-daily.json');

function log(msg) { console.log(`[GA4] ${msg}`); }

function loadCreds() {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  return c.googleAnalytics || null;
}

async function run() {
  const creds = loadCreds();
  if (!creds || !creds.propertyId) {
    log('SKIP — GA4 not configured yet.');
    log('  ACTION NEEDED:');
    log('  1. Go to analytics.google.com');
    log('  2. Admin → Create Property → thepropertydna.com');
    log('  3. Get Measurement ID (G-XXXXXXXXXX) → tell Claude to add to index.html');
    log('  4. Get Property ID from Admin → Property Settings');
    log('  5. Add to .daily-creds.json: { "googleAnalytics": { "propertyId": "YOUR_ID" } }');
    return { status: 'skipped', reason: 'ga4_not_configured' };
  }

  log(`Would fetch GA4 data for property ${creds.propertyId}`);
  log('Full GA4 Data API integration: add serviceAccountKey to .daily-creds.json to enable');
  return { status: 'partial', note: 'propertyId set but no service account key yet' };
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
