#!/usr/bin/env node
/**
 * GA4 Traffic Report — re-auth with analytics.readonly + pull last 30 days
 *
 * Usage:
 *   1. node tools/gbp-setup/ga4-traffic.js                  → opens browser to auth
 *   2. node tools/gbp-setup/ga4-traffic.js "<redirect_url>" → exchanges code + pulls
 *   3. node tools/gbp-setup/ga4-traffic.js report           → pulls using existing token
 */

const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');

const CREDS  = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'))).installed;
const TOKEN_PATH = path.join(__dirname, 'ga4-readonly-tokens.json');

const REDIRECT_URI = 'https://localhost';
const SCOPE        = 'https://www.googleapis.com/auth/analytics.readonly';
const PROPERTY_ID  = '536889299'; // PropertyDNA

const AUTH_URL =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CREDS.client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

function post(host, p, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname: host, path: p, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let r = ''; res.on('data', c => r += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(r) }); } catch { resolve({ s: res.statusCode, d: r }); } });
    });
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

async function exchangeCode(code) {
  const body =
    `client_id=${CREDS.client_id}` +
    `&client_secret=${CREDS.client_secret}` +
    `&code=${encodeURIComponent(code)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&grant_type=authorization_code`;
  const res = await post('oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  if (res.d.access_token) return res.d;
  throw new Error('Token exchange failed: ' + JSON.stringify(res.d).slice(0, 300));
}

async function refreshToken(refresh) {
  const body =
    `client_id=${CREDS.client_id}` +
    `&client_secret=${CREDS.client_secret}` +
    `&refresh_token=${refresh}` +
    `&grant_type=refresh_token`;
  const res = await post('oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  if (res.d.access_token) return res.d.access_token;
  throw new Error('Refresh failed: ' + JSON.stringify(res.d));
}

async function runReport(token, request, label) {
  const res = await post('analyticsdata.googleapis.com', `/v1beta/properties/${PROPERTY_ID}:runReport`,
    { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, request);
  if (res.d.error) { console.log(`\n[${label}] ERROR:`, res.d.error.message); return null; }
  return res.d;
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

async function pullReports() {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error(`No tokens — run without args first.`);
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const access = await refreshToken(tokens.refresh_token);
  console.log('Access token refreshed\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyDNA Traffic Report — Last 30 Days');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Daily breakdown
  const daily = await runReport(access, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  }, 'Daily');

  if (daily?.rows) {
    let totU = 0, totN = 0, totS = 0, totP = 0;
    console.log('Date         Users  New  Sessions  Pageviews  Bounce');
    console.log('───────────────────────────────────────────────────────');
    for (const r of daily.rows) {
      const d  = r.dimensionValues[0].value;
      const u  = +r.metricValues[0].value;
      const n  = +r.metricValues[1].value;
      const s  = +r.metricValues[2].value;
      const p  = +r.metricValues[3].value;
      const b  = parseFloat(r.metricValues[4].value);
      totU += u; totN += n; totS += s; totP += p;
      const date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
      console.log(`${date}  ${String(u).padStart(5)}  ${String(n).padStart(3)}  ${String(s).padStart(8)}  ${String(p).padStart(9)}  ${(b * 100).toFixed(1)}%`);
    }
    console.log('───────────────────────────────────────────────────────');
    console.log(`30-DAY TOTAL: ${fmtNum(totU)} users · ${fmtNum(totN)} new · ${fmtNum(totS)} sessions · ${fmtNum(totP)} pageviews`);
  }

  // 2. Top traffic sources
  console.log('\n\n═══ Top Traffic Sources ═══\n');
  const sources = await runReport(access, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  }, 'Sources');

  if (sources?.rows) {
    console.log('Channel              Source              Sessions  Users  Pageviews');
    console.log('────────────────────────────────────────────────────────────────────');
    for (const r of sources.rows) {
      const ch  = r.dimensionValues[0].value.padEnd(20).slice(0, 20);
      const src = r.dimensionValues[1].value.padEnd(19).slice(0, 19);
      console.log(`${ch} ${src} ${String(r.metricValues[0].value).padStart(8)} ${String(r.metricValues[1].value).padStart(6)} ${String(r.metricValues[2].value).padStart(10)}`);
    }
  }

  // 3. Top pages
  console.log('\n\n═══ Top Pages ═══\n');
  const pages = await runReport(access, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 15,
  }, 'Pages');

  if (pages?.rows) {
    console.log('Path                                       Views  Users   Avg Time');
    console.log('────────────────────────────────────────────────────────────────────');
    for (const r of pages.rows) {
      const path = r.dimensionValues[0].value.padEnd(42).slice(0, 42);
      const v    = String(r.metricValues[0].value).padStart(5);
      const u    = String(r.metricValues[1].value).padStart(5);
      const t    = parseFloat(r.metricValues[2].value);
      const mm   = Math.floor(t / 60); const ss = Math.round(t % 60);
      console.log(`${path}  ${v}  ${u}  ${String(mm).padStart(2)}:${String(ss).padStart(2,'0')}`);
    }
  }

  // 4. Geographic breakdown
  console.log('\n\n═══ Top Cities ═══\n');
  const geo = await runReport(access, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'city' }, { name: 'country' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 10,
  }, 'Geo');

  if (geo?.rows) {
    console.log('City                 Country         Users  Sessions');
    console.log('─────────────────────────────────────────────────────');
    for (const r of geo.rows) {
      const c = (r.dimensionValues[0].value || 'Unknown').padEnd(20).slice(0, 20);
      const co = (r.dimensionValues[1].value || '—').padEnd(15).slice(0, 15);
      console.log(`${c} ${co} ${String(r.metricValues[0].value).padStart(5)}  ${String(r.metricValues[1].value).padStart(8)}`);
    }
  }

  // 5. Devices
  console.log('\n\n═══ Devices ═══\n');
  const devices = await runReport(access, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
  }, 'Devices');

  if (devices?.rows) {
    for (const r of devices.rows) {
      const dev = r.dimensionValues[0].value.padEnd(10);
      console.log(`${dev} ${String(r.metricValues[0].value).padStart(6)} users · ${String(r.metricValues[1].value).padStart(6)} sessions · ${String(r.metricValues[2].value).padStart(7)} pageviews`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  const arg = process.argv[2];

  // Path 3: explicit report command (token already saved)
  if (arg === 'report') {
    await pullReports();
    return;
  }

  // Path 2: code/URL passed in argv — exchange + save + pull
  if (arg) {
    let code = arg;
    try { code = new URL(arg).searchParams.get('code') || arg; } catch { /* code already */ }
    console.log('Exchanging code for readonly token...');
    const tokens = await exchangeCode(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to ga4-readonly-tokens.json\n');
    await pullReports();
    return;
  }

  // Path 1: no args — open browser
  console.log('\n=== GA4 Readonly Auth ===\n');
  console.log('Opening browser to authorize analytics.readonly scope...');
  console.log('If browser does not open, paste this URL manually:\n');
  console.log(AUTH_URL + '\n');
  exec(`open "${AUTH_URL}"`);
  console.log('After approving:');
  console.log('  1. Browser redirects to https://localhost (page will fail — expected)');
  console.log('  2. Copy the FULL redirect URL from your address bar');
  console.log('  3. Run:  node tools/gbp-setup/ga4-traffic.js "PASTED_REDIRECT_URL"\n');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
