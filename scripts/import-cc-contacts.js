/**
 * Import Constant Contact export CSV into PropertyDNA
 * - Active contacts → campaigns + campaign_contacts
 * - Unsubscribed    → campaign_unsubscribes (global suppression list)
 *
 * Usage: node scripts/import-cc-contacts.js
 */
const fs    = require('fs');
const https = require('https');
const path  = require('path');

const CSV_PATH    = '/Users/danstuart/Downloads/contact_export_1133265722821_050126_111419.csv';
const SUPA_URL    = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY    = process.env.SUPABASE_SERVICE_KEY;
const CAMPAIGN_NAME = 'Constant Contact Database — Imported 2026-05-01';

if (!SUPA_KEY) { console.error('Set SUPABASE_SERVICE_KEY env var'); process.exit(1); }

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      cells.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function normalizePhone(raw) {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return raw.replace(/^'+/, '').trim();
}

function normalizeName(s) {
  if (!s) return '';
  return s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
const raw   = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
const lines = raw.split(/\r?\n/).filter(l => l.trim());
const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());

console.log(`\nTotal rows: ${lines.length - 1}`);

// Column indices
const COL = {
  email:  headers.indexOf('email address'),
  first:  headers.indexOf('first name'),
  last:   headers.indexOf('last name'),
  company:headers.indexOf('company'),
  status: headers.indexOf('email status'),
  mobile: headers.indexOf('phone - mobile'),
  home:   headers.indexOf('phone - home'),
  work:   headers.indexOf('phone - work'),
  other:  headers.indexOf('phone - other'),
  addr:   headers.indexOf('street address line 1 - home'),
  city:   headers.indexOf('city - home'),
  state:  headers.indexOf('state/province - home'),
  zip:    headers.indexOf('zip/postal code - home'),
  lists:  headers.indexOf('email lists'),
  notes:  headers.indexOf('notes'),
  tags:   headers.indexOf('tags'),
};

const active       = [];
const unsubscribed = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const c     = parseLine(lines[i]);
  const email = (c[COL.email] || '').toLowerCase().trim();
  if (!email || !email.includes('@')) continue;

  const status = (c[COL.status] || '').trim();

  if (status === 'Unsubscribed') {
    unsubscribed.push({ email });
    continue;
  }
  if (status !== 'Active') continue; // skip No Permissions Set, Temporary Hold etc.

  const phone = normalizePhone(c[COL.mobile] || c[COL.home] || c[COL.work] || c[COL.other] || '');

  active.push({
    first_name:    normalizeName(c[COL.first] || ''),
    last_name:     normalizeName(c[COL.last]  || ''),
    email,
    phone,
    address:       (c[COL.addr]  || '').trim(),
    city:          normalizeName(c[COL.city]  || ''),
    state:         (c[COL.state] || 'CA').trim().toUpperCase().slice(0, 2),
    zip:           (c[COL.zip]   || '').trim().slice(0, 5),
    brokerage:     (c[COL.company] || '').trim(),
    metadata:      {
      tags:  (c[COL.tags]  || '').trim() || undefined,
      lists: (c[COL.lists] || '').trim() || undefined,
      notes: (c[COL.notes] || '').slice(0, 300).trim() || undefined,
    },
  });
}

console.log(`Active:       ${active.length}`);
console.log(`Unsubscribed: ${unsubscribed.length}`);
console.log(`Skipped:      ${lines.length - 1 - active.length - unsubscribed.length}`);

// ── Supabase helpers ──────────────────────────────────────────────────────────
function supaPost(endpoint, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'neccpdfhmfnvyjgyrysy.supabase.co',
      path: `/rest/v1/${endpoint}`,
      method: 'POST',
      headers: {
        apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Prefer: 'return=representation',
        ...extra,
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function supaUpsert(table, rows) {
  const payload = JSON.stringify(rows);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'neccpdfhmfnvyjgyrysy.supabase.co',
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // 1. Create campaign
  console.log('\n→ Creating campaign...');
  const campRes = await supaPost('campaigns', {
    name: CAMPAIGN_NAME, type: 'general', status: 'draft',
    subject: 'The Stuart Team Weekly — Coachella Valley Market Intelligence',
    template: 'homeowner', total_contacts: active.length,
    created_by: 'cc_import',
  });
  const campaignId = campRes.data?.[0]?.id || campRes.data?.id;
  if (!campaignId) {
    console.error('Failed to create campaign:', JSON.stringify(campRes.data));
    process.exit(1);
  }
  console.log(`  Campaign ID: ${campaignId}`);

  // 2. Import active contacts in chunks of 200
  console.log(`\n→ Importing ${active.length} active contacts...`);
  const CHUNK = 200;
  let imported = 0;
  for (let i = 0; i < active.length; i += CHUNK) {
    const chunk = active.slice(i, i + CHUNK).map(c => ({
      ...c, campaign_id: campaignId, status: 'pending',
    }));
    const res = await supaUpsert('campaign_contacts', chunk);
    if (res.status >= 400) {
      console.error(`  Chunk ${i}–${i+CHUNK} error: HTTP ${res.status}`);
    } else {
      imported += chunk.length;
      process.stdout.write(`\r  ${imported}/${active.length} imported...`);
    }
  }
  console.log(`\n  ✓ ${imported} active contacts imported`);

  // 3. Add unsubscribes to global suppression list
  console.log(`\n→ Adding ${unsubscribed.length} unsubscribes to suppression list...`);
  let unsubDone = 0;
  for (let i = 0; i < unsubscribed.length; i += CHUNK) {
    const chunk = unsubscribed.slice(i, i + CHUNK);
    const res = await supaUpsert('campaign_unsubscribes', chunk);
    if (res.status < 400) unsubDone += chunk.length;
    process.stdout.write(`\r  ${Math.min(i+CHUNK, unsubscribed.length)}/${unsubscribed.length} processed...`);
  }
  console.log(`\n  ✓ ${unsubDone} emails added to suppression list`);

  // 4. Summary
  console.log('\n' + '='.repeat(50));
  console.log('IMPORT COMPLETE');
  console.log(`  Campaign:     ${CAMPAIGN_NAME}`);
  console.log(`  Campaign ID:  ${campaignId}`);
  console.log(`  Active:       ${imported}`);
  console.log(`  Suppressed:   ${unsubDone}`);
  console.log(`  View at:      thepropertydna.com/outreach`);
  console.log('='.repeat(50) + '\n');
}

run().catch(err => { console.error(err); process.exit(1); });
