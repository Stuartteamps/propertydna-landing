#!/usr/bin/env node
/**
 * Tracks which contacts have been emailed today across all CC lists.
 * Future blasts must check this before firing — if contact got an email
 * in the last 24h (or 7 days per Dan's rule), skip them.
 *
 * Stores in Supabase: cc_send_log table
 *   { email, last_sent_at, campaigns_sent_24h, lists_today, last_campaign_id }
 *
 * Usage as library:
 *   const { isRecentlyEmailed, logSend } = require('./cc-dedup-tracker');
 */

const https = require('https');

const SUPA_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPA_KEY) {
  console.error('SUPABASE_SERVICE_KEY env var required');
  process.exit(1);
}

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPA_URL + path);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: d ? JSON.parse(d) : null }); } catch { resolve({ s: res.statusCode, d }); } });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function logSend(email, campaignId, windowHours = 24) {
  const e = (email || '').toLowerCase().trim();
  if (!e || !e.includes('@')) return;
  const now = new Date().toISOString();
  await req('POST', '/rest/v1/cc_send_log',
    { email: e, last_sent_at: now, last_campaign_id: campaignId },
    { Prefer: 'resolution=merge-duplicates,return=minimal' }
  ).catch(() => {});
}

async function getRecentlyEmailed(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await req('GET', `/rest/v1/cc_send_log?select=email&last_sent_at=gte.${since}`).catch(() => ({ d: [] }));
  return new Set((rows.d || []).map(r => (r.email || '').toLowerCase()));
}

async function isRecentlyEmailed(email, hours = 24) {
  const e = (email || '').toLowerCase().trim();
  if (!e) return false;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await req('GET', `/rest/v1/cc_send_log?select=email&email=eq.${encodeURIComponent(e)}&last_sent_at=gte.${since}&limit=1`).catch(() => ({ d: [] }));
  return Array.isArray(rows.d) && rows.d.length > 0;
}

// Initialize: create cc_send_log table if missing
async function init() {
  // Pre-populate from today's CC blast contacts (audit + suppress all who got emails today)
  console.log('Initializing cc_send_log from today\'s 11 blasts...');
  // This requires CC API to enumerate which contacts were in each blasted list.
  // For now, exporting blasted contacts to suppress list manually is the safest path.
  console.log('Use SQL to seed: copy email_address from CC into cc_send_log');
  console.log('Sample SQL: INSERT INTO cc_send_log (email, last_sent_at, last_campaign_id) VALUES (...)');
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'init') init();
  else if (cmd === 'check') {
    const e = process.argv[3];
    isRecentlyEmailed(e).then(r => { console.log(e, '→ recently emailed:', r); process.exit(0); });
  } else if (cmd === 'recent') {
    getRecentlyEmailed(parseInt(process.argv[3] || '24', 10)).then(s => {
      console.log(`${s.size} emails sent in last ${process.argv[3] || '24'}h`);
      process.exit(0);
    });
  } else {
    console.log('Usage: cc-dedup-tracker.js [init|check <email>|recent <hours>]');
  }
}

module.exports = { logSend, getRecentlyEmailed, isRecentlyEmailed };
