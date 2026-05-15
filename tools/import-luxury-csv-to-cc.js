#!/usr/bin/env node
/**
 * import-luxury-csv-to-cc.js
 *
 * Reads a CSV of skip-traced luxury contacts and bulk-imports to Constant Contact
 * with a "Luxury Absentee" segment tag. Uses CC token from Supabase oauth_tokens.
 *
 * CC's import endpoint dedupes by email — existing rows update, new rows insert.
 *
 * Usage:
 *   node tools/import-luxury-csv-to-cc.js              # dry run, prints count
 *   node tools/import-luxury-csv-to-cc.js --execute    # actually uploads
 *   CSV_PATH=path/to/file.csv node tools/import-luxury-csv-to-cc.js
 */

const fs   = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_REF = 'neccpdfhmfnvyjgyrysy';
const CC_LIST_ID  = '662ac8de-4599-11f1-8c5f-02420a320003'; // PropertyDNA — All Contacts (added to this list too)
const DEDICATED_LIST_NAME = 'Luxury Absentee 2026-05';      // separate targeted list
const TAG_NAME    = 'Luxury Absentee 2026-05';
const EXECUTE     = process.argv.includes('--execute');
const CSV_PATH    = process.env.CSV_PATH ||
  'tools/gmail-cleanup/contacts/burn_tracerfy/MASTER_luxury_contacts_2026-05-15.csv';

// ── Credentials ──────────────────────────────────────────────────────────────
function getSupabaseToken() {
  const raw = execSync(
    'security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null'
  ).toString().trim();
  return Buffer.from(raw.replace('go-keyring-base64:', ''), 'base64').toString('utf8');
}

function postJson(host, path, headers, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: host, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      },
      (res) => {
        let raw = ''; res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, data: raw }); }
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    req.write(data); req.end();
  });
}

function getJson(host, path, headers) {
  return new Promise((resolve) => {
    const req = https.request({ hostname: host, path, method: 'GET', headers }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    req.end();
  });
}

async function getCCToken(sbpToken) {
  if (process.env.CC_TOKEN) return process.env.CC_TOKEN;
  const res = await postJson('api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` },
    { query: "select access_token from oauth_tokens where provider='constant_contact'" });
  if (res.status >= 300 || !res.data?.[0]?.access_token) {
    throw new Error(`Could not get CC token (status ${res.status}): ${JSON.stringify(res.data).slice(0, 200)}`);
  }
  return res.data[0].access_token;
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const fields = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (fields[i] || '').trim());
    return obj;
  });
}

// ── Get or create a dedicated CC list ────────────────────────────────────────
async function getOrCreateList(ccToken) {
  const search = await getJson('api.cc.email', `/v3/contact_lists?include_count=false&limit=500`,
    { Authorization: `Bearer ${ccToken}` });
  if (search.status === 200 && Array.isArray(search.data?.lists)) {
    const existing = search.data.lists.find(l => l.name === DEDICATED_LIST_NAME);
    if (existing) { console.log(`  Reusing list "${DEDICATED_LIST_NAME}": ${existing.list_id}`); return existing.list_id; }
  }
  const create = await postJson('api.cc.email', `/v3/contact_lists`,
    { Authorization: `Bearer ${ccToken}` },
    { name: DEDICATED_LIST_NAME, description: 'Skip-traced luxury absentee owners — Greenwich/Miami burn 2026-05-15' });
  if (create.status === 201 && create.data?.list_id) {
    console.log(`  Created list "${DEDICATED_LIST_NAME}": ${create.data.list_id}`);
    return create.data.list_id;
  }
  console.warn(`  Could not create list: ${create.status} ${JSON.stringify(create.data).slice(0,200)}`);
  return null;
}

// ── Get or create the tag ────────────────────────────────────────────────────
async function getOrCreateTag(ccToken) {
  // Search for existing tag
  const search = await getJson('api.cc.email', `/v3/contact_tags?include_count=false`,
    { Authorization: `Bearer ${ccToken}` });
  if (search.status === 200 && Array.isArray(search.data?.tags)) {
    const existing = search.data.tags.find(t => t.name === TAG_NAME);
    if (existing) return existing.tag_id;
  }
  // Create new tag
  const create = await postJson('api.cc.email', `/v3/contact_tags`,
    { Authorization: `Bearer ${ccToken}` },
    { name: TAG_NAME });
  if (create.status === 201 && create.data?.tag_id) return create.data.tag_id;
  console.warn('  Could not create tag:', create.status, JSON.stringify(create.data).slice(0,200));
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN (pass --execute to upload)'}`);
  console.log(`csv:  ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`parsed ${rows.length} rows from CSV`);

  const withEmail = rows.filter(r => r.email && r.email.includes('@'));
  console.log(`with email: ${withEmail.length}`);

  if (!EXECUTE) {
    console.log('\ndry run — sample rows:');
    withEmail.slice(0, 3).forEach(r =>
      console.log(`  ${r.email}  |  ${r.firstName || ''} ${r.lastName || ''}  |  ${r.city}, ${r.state}`));
    console.log('\nrun with --execute to actually upload to CC');
    return;
  }

  const sbpToken = getSupabaseToken();
  const ccToken  = await getCCToken(sbpToken);
  console.log(`got cc token (${ccToken.length} chars)`);

  const tagId  = await getOrCreateTag(ccToken);
  const listId = await getOrCreateList(ccToken);
  console.log(`tag id:  ${tagId || '(none)'}`);
  console.log(`list id: ${listId || '(none)'}`);

  // CC bulk import endpoint accepts up to 500 per call
  const BATCH = 500;
  let totalAccepted = 0;

  for (let i = 0; i < withEmail.length; i += BATCH) {
    const chunk = withEmail.slice(i, i + BATCH);
    const importBody = {
      import_data: chunk.map(r => ({
        email: r.email.toLowerCase().trim(),
        first_name: (r.firstName || '').slice(0, 50),
        last_name:  (r.lastName  || '').slice(0, 50),
        phone:      r.phone || '',
        street: r.address || '',
        city:   r.city || '',
        state:  r.state || '',
        zip:    r.zip || '',
      })),
      list_ids: listId ? [CC_LIST_ID, listId] : [CC_LIST_ID],
      tag_ids: tagId ? [tagId] : [],
    };

    const res = await postJson('api.cc.email', '/v3/activities/contacts_json_import',
      { Authorization: `Bearer ${ccToken}` },
      importBody);

    if (res.status === 201 || res.status === 202) {
      console.log(`  batch ${Math.floor(i/BATCH)+1}: queued ${chunk.length} contacts (activity ${res.data?.activity_id || '?'})`);
      totalAccepted += chunk.length;
    } else {
      console.error(`  batch ${Math.floor(i/BATCH)+1} FAILED: ${res.status} — ${JSON.stringify(res.data).slice(0,300)}`);
    }
  }

  console.log(`\n✓ imported ${totalAccepted} luxury contacts to CC list ${CC_LIST_ID}`);
  console.log(`  Tagged: ${TAG_NAME}`);
  console.log(`  Next: build segment in CC UI → send campaign`);
}

main().catch(e => { console.error(e); process.exit(1); });
