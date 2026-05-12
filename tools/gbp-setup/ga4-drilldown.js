#!/usr/bin/env node
// City × Page drilldown — shows what each suspicious city actually visited
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CREDS  = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'))).installed;
const TOKENS = JSON.parse(fs.readFileSync(path.join(__dirname, 'ga4-readonly-tokens.json')));
const PROPERTY_ID = '536889299';

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

async function refresh() {
  const body = `client_id=${CREDS.client_id}&client_secret=${CREDS.client_secret}&refresh_token=${TOKENS.refresh_token}&grant_type=refresh_token`;
  const r = await post('oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  return r.d.access_token;
}

async function report(token, req) {
  const r = await post('analyticsdata.googleapis.com',
    `/v1beta/properties/${PROPERTY_ID}:runReport`,
    { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, req);
  return r.d;
}

(async () => {
  const token = await refresh();

  // CITY × PAGE breakdown — limited to suspicious cities
  console.log('═══ Suspicious-City Activity Breakdown ═══\n');
  const cityPages = await report(token, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'city' }, { name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      filter: { fieldName: 'city', inListFilter: { values: ['San Jose', 'Des Moines', 'Moses Lake', 'Ashburn', 'Flint Hill', '(not set)'] } }
    },
    orderBys: [{ dimension: { dimensionName: 'city' } }, { metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50,
  });

  if (cityPages.rows) {
    let currentCity = '';
    for (const r of cityPages.rows) {
      const city = r.dimensionValues[0].value;
      const path = r.dimensionValues[1].value;
      const views = r.metricValues[0].value;
      const users = r.metricValues[1].value;
      const dur   = parseFloat(r.metricValues[2].value);
      const mm    = Math.floor(dur / 60); const ss = Math.round(dur % 60);
      if (city !== currentCity) {
        console.log(`\n— ${city.toUpperCase()} —`);
        currentCity = city;
      }
      console.log(`  ${path.padEnd(45).slice(0,45)}  ${views.padStart(4)} views / ${users.padStart(3)} users / ${mm}:${String(ss).padStart(2,'0')}`);
    }
  }

  // Engagement quality by city — separate signal vs noise
  console.log('\n\n═══ Engaged Sessions vs Bounces by City ═══\n');
  const cityEng = await report(token, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'city' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 12,
  });

  if (cityEng.rows) {
    console.log('City                Users  Engaged  Engage%  Avg Time   Likely');
    console.log('────────────────────────────────────────────────────────────────');
    for (const r of cityEng.rows) {
      const city = (r.dimensionValues[0].value || '—').padEnd(18).slice(0,18);
      const u    = +r.metricValues[0].value;
      const e    = +r.metricValues[1].value;
      const er   = parseFloat(r.metricValues[2].value);
      const dur  = parseFloat(r.metricValues[3].value);
      const verdict = er > 0.5 && dur > 20 ? 'REAL'
                    : er > 0.2 ? 'mixed'
                    : (dur < 5 && er < 0.1) ? 'BOT?' : 'low-eng';
      console.log(`${city} ${String(u).padStart(5)}  ${String(e).padStart(7)}  ${(er*100).toFixed(0).padStart(6)}%  ${dur.toFixed(0).padStart(7)}s  ${verdict}`);
    }
  }

  // Bot/spam screening — first-visit referrer
  console.log('\n\n═══ Referrer Sources (deep) ═══\n');
  const refs = await report(token, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'activeUsers' }, { name: 'engagementRate' }],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 15,
  });
  if (refs.rows) {
    console.log('Source                       Medium          Users  Engage%');
    console.log('───────────────────────────────────────────────────────────');
    for (const r of refs.rows) {
      const src = (r.dimensionValues[0].value || '—').padEnd(28).slice(0,28);
      const med = (r.dimensionValues[1].value || '—').padEnd(14).slice(0,14);
      const u   = +r.metricValues[0].value;
      const er  = parseFloat(r.metricValues[1].value);
      console.log(`${src} ${med} ${String(u).padStart(5)}  ${(er*100).toFixed(0).padStart(6)}%`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
})();
