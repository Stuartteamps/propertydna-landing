#!/usr/bin/env node
/**
 * Syncs skip-traced contacts to Constant Contact with segment tags.
 * Requires CC_ACCESS_TOKEN in env or .env file.
 *
 * Usage:
 *   CC_ACCESS_TOKEN=xxx node sync-cc-contacts.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ACCESS_TOKEN = process.env.CC_ACCESS_TOKEN;
const CC_API_BASE  = 'https://api.cc.email/v3';

// Existing CC list IDs (created 2026-05-01)
const LISTS = {
  all:     '662ac8de-e7c9-4e30-b64e-fbc1e6b76e3f',
  warm:    '6686218e-...',
  agents:  '66dc9866-...',
};

// Source CSV → CC list name + tag mapping
const SKIP_TRACE_SEGMENTS = [
  {
    csv:  'needs_skiptracing_movie_colony_occupied_2026-05-01.csv',
    list: 'PropertyDNA — Movie Colony Occupied',
    tags: ['Skip-Traced', 'Movie-Colony', 'Owner-Occupied', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_movie_colony_absentee_2026-05-01.csv',
    list: 'PropertyDNA — Movie Colony Absentee',
    tags: ['Skip-Traced', 'Movie-Colony', 'Absentee-Owner', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_ps_multifamily_2026-05-01.csv',
    list: 'PropertyDNA — PS Multifamily',
    tags: ['Skip-Traced', 'Multifamily', 'Investor', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_ps_commercial_2026-05-01.csv',
    list: 'PropertyDNA — PS Commercial',
    tags: ['Skip-Traced', 'Commercial', 'Investor', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_oasis_palmdesert_2026-05-01.csv',
    list: 'PropertyDNA — Oasis Palm Desert',
    tags: ['Skip-Traced', 'Absentee-Owner', 'Palm-Desert'],
  },
  {
    csv:  'needs_skiptracing_ps_homes_2026-05-01.csv',
    list: 'PropertyDNA — PS Homes',
    tags: ['Skip-Traced', 'Homeowner', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_quincy_farm_2026-05-01.csv',
    list: 'PropertyDNA — Quincy Farm',
    tags: ['Skip-Traced', 'Absentee-Owner', 'Palm-Springs'],
  },
  {
    csv:  'needs_skiptracing_el_cajon_2026-05-01.csv',
    list: 'PropertyDNA — El Cajon Distressed',
    tags: ['Skip-Traced', 'Distressed', 'El-Cajon'],
  },
];

const RESULTS_DIR = path.join(__dirname, '../gmail-cleanup/contacts/skip_trace_results');

function log(msg)  { console.log(`[CC-SYNC] ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m✓ ${msg}\x1b[0m`); }
function fail(msg) { console.log(`\x1b[31m✗ ${msg}\x1b[0m`); }
function info(msg) { console.log(`\x1b[33m→ ${msg}\x1b[0m`); }

function ccReq(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.cc.email',
      path: `/v3${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
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

async function ensureList(name) {
  // Check if list exists
  const lists = await ccReq('GET', '/contact_lists?limit=100');
  if (lists.status === 200) {
    const existing = (lists.data.lists || []).find(l => l.name === name);
    if (existing) return existing.list_id;
  }
  // Create it
  const created = await ccReq('POST', '/contact_lists', { name, favorite: false });
  if (created.status === 201) {
    ok(`Created CC list: ${name}`);
    return created.data.list_id;
  }
  fail(`Could not create list: ${name} — ${JSON.stringify(created.data).slice(0, 100)}`);
  return null;
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  }).filter(r => r.email && r.email.includes('@'));
}

async function upsertContact(contact, listId, tags) {
  const payload = {
    email_address: { address: contact.email.toLowerCase(), permission_to_send: 'implicit' },
    first_name: contact.firstName || '',
    last_name:  contact.lastName  || '',
    phone_numbers: contact.phone ? [{ phone_number: contact.phone, kind: 'home' }] : [],
    street_addresses: contact.address ? [{
      kind: 'home',
      street: contact.address,
      city:  contact.city || '',
      state: contact.state || 'CA',
      postal_code: contact.zip || '',
      country: 'USA',
    }] : [],
    list_memberships: [listId, LISTS.all].filter(Boolean),
    taggings: tags,
    custom_fields: [
      { custom_field_id: 'source', value: contact.source || 'skip-traced' },
    ].filter(f => f.value),
  };

  return ccReq('POST', '/contacts/sign_up_form', payload);
}

async function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!ACCESS_TOKEN) {
    fail('CC_ACCESS_TOKEN not set. Run setup-cc.js first.');
    fail('Or: CC_ACCESS_TOKEN=your_token node sync-cc-contacts.js');
    process.exit(1);
  }

  // Verify token works
  const me = await ccReq('GET', '/account/summary');
  if (me.status !== 200) {
    fail(`CC API auth failed: ${me.status} — token may be expired. Re-run setup-cc.js`);
    process.exit(1);
  }
  ok(`Connected to CC account: ${me.data.physical_address?.company_name || 'PropertyDNA'}`);

  let totalPushed = 0;
  let totalLists  = 0;

  for (const seg of SKIP_TRACE_SEGMENTS) {
    const csvPath = path.join(RESULTS_DIR, seg.csv);
    if (!fs.existsSync(csvPath)) {
      info(`Skipping ${seg.csv} — file not found`);
      continue;
    }

    log(`\nProcessing: ${seg.list}`);
    const contacts = readCsv(csvPath);
    info(`${contacts.length} contacts with email`);

    // Create or find the CC list
    const listId = await ensureList(seg.list);
    if (!listId) continue;
    totalLists++;

    // Push contacts in batches (CC sign_up_form is per-contact)
    let pushed = 0;
    for (const c of contacts) {
      const r = await upsertContact(c, listId, seg.tags);
      if (r.status === 201 || r.status === 200) {
        pushed++;
      } else if (r.status === 409) {
        pushed++; // already exists — updated
      } else {
        // Rate limit or error — back off
        if (r.status === 429) {
          info('Rate limit hit — waiting 5s...');
          await pause(5000);
        }
      }
      if (pushed % 50 === 0) info(`  ${pushed}/${contacts.length} pushed...`);
      await pause(50); // ~20 req/sec to stay under CC rate limits
    }

    ok(`${seg.list}: ${pushed}/${contacts.length} contacts synced`);
    totalPushed += pushed;
  }

  console.log('\n\x1b[32m══════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[32m✓ CC SYNC COMPLETE: ${totalPushed} contacts across ${totalLists} lists\x1b[0m`);
  console.log('\x1b[32m══════════════════════════════════════════════════\x1b[0m');
  console.log('View in Constant Contact → Contacts → Lists');
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
