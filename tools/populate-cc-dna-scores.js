#!/usr/bin/env node
/**
 * populate-cc-dna-scores.js
 *
 * Bulk-populates CC contact custom fields:
 *   - propertydna_score   (e.g. "78")
 *   - propertydna_label   (e.g. "Strong Buy")
 *   - propertydna_city    (e.g. "Indian Wells")
 *
 * CC's /v3/activities/contacts_json_import accepts custom_fields but
 * silently drops them — only PUT /v3/contacts/{id} actually persists.
 * So we lookup-by-email then PUT, with concurrency.
 *
 * Source: campaign_contacts. Personal scores → city-median fallback → default.
 *
 * Usage:
 *   node tools/populate-cc-dna-scores.js                # dry run
 *   node tools/populate-cc-dna-scores.js --execute      # run for real
 *   node tools/populate-cc-dna-scores.js --execute --limit 50  # sample run
 *   node tools/populate-cc-dna-scores.js --execute --concurrency 12
 */

const https = require('https');
const { execSync } = require('child_process');

const PROJECT_REF = 'neccpdfhmfnvyjgyrysy';
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const EXECUTE     = !!args.execute;
const LIMIT       = args.limit ? parseInt(args.limit, 10) : null;
const CONCURRENCY = args.concurrency ? parseInt(args.concurrency, 10) : 8;

const CF = {
  score: '00a4331a-5002-11f1-88f4-02420a320002',
  label: '00ce48a8-5002-11f1-931c-02420a320003',
  city:  '00fa8a62-5002-11f1-b717-02420a320003',
};

const CITY_FALLBACKS = {
  'palm springs':       { score: 74, label: 'Strong Buy' },
  'rancho mirage':      { score: 76, label: 'Strong Buy' },
  'indian wells':       { score: 78, label: 'Strong Buy' },
  'palm desert':        { score: 71, label: 'Buy' },
  'la quinta':          { score: 72, label: 'Buy' },
  'indio':              { score: 68, label: 'Buy' },
  'cathedral city':     { score: 67, label: 'Buy' },
  'desert hot springs': { score: 64, label: 'Hold' },
  'coachella':          { score: 63, label: 'Hold' },
  'thousand palms':     { score: 65, label: 'Hold' },
  'coachella valley':   { score: 71, label: 'Buy' },
};
const DEFAULT_FALLBACK = { score: 70, label: 'Buy' };

function deriveLabel(score) {
  if (score >= 75) return 'Strong Buy';
  if (score >= 65) return 'Buy';
  if (score >= 55) return 'Hold';
  return 'Caution';
}

function getSupabaseToken() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null').toString().trim();
  return Buffer.from(raw.replace('go-keyring-base64:', ''), 'base64').toString('utf8');
}

function httpJson(method, host, path, headers, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (data) reqHeaders['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({ hostname: host, path, method, headers: reqHeaders }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    if (data) req.write(data);
    req.end();
  });
}

async function getCCToken(sbpToken) {
  if (process.env.CC_TOKEN) return process.env.CC_TOKEN;
  const res = await httpJson('POST', 'api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` },
    { query: "select access_token from oauth_tokens where provider='constant_contact'" });
  if (res.status >= 300 || !res.data?.[0]?.access_token) throw new Error('No CC token: ' + res.status);
  return res.data[0].access_token;
}

async function poolMap(items, n, fn, onProgress) {
  let next = 0, done = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = { error: e.message }; }
      done++;
      if (onProgress && done % 25 === 0) onProgress(done, items.length);
    }
  }));
  return results;
}

async function main() {
  console.log(`mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}  concurrency=${CONCURRENCY}${LIMIT ? `  limit=${LIMIT}` : ''}`);
  const sbpToken = getSupabaseToken();
  const ccToken  = await getCCToken(sbpToken);

  // 1. Pull source data
  const sql = `
    with per_contact as (
      select distinct on (lower(email)) lower(email) email,
        neighborhood_score, score_label, coalesce(city, '') as city, first_name, last_name
      from campaign_contacts
      where email is not null and email <> '' and status not in ('bounced','unsubscribed')
      order by lower(email),
        (case when neighborhood_score is not null then 0 else 1 end),
        (case when city is not null and city <> '' then 0 else 1 end)
    )
    select * from per_contact;
  `;
  const r = await httpJson('POST', 'api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` }, { query: sql });
  if (r.status >= 300) throw new Error('supabase: ' + r.status);
  let rows = r.data;
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`source: ${rows.length} contacts`);

  // 2. Enrich
  let p=0,c=0,d=0;
  const enriched = rows.map(r => {
    const cityKey = (r.city || '').toLowerCase().trim();
    let score, label, city;
    if (r.neighborhood_score != null) {
      score = r.neighborhood_score;
      label = r.score_label || deriveLabel(score);
      city  = r.city && r.city.trim() ? r.city.trim() : 'Coachella Valley';
      p++;
    } else if (cityKey && CITY_FALLBACKS[cityKey]) {
      score = CITY_FALLBACKS[cityKey].score;
      label = CITY_FALLBACKS[cityKey].label;
      city  = r.city.trim();
      c++;
    } else {
      score = DEFAULT_FALLBACK.score;
      label = DEFAULT_FALLBACK.label;
      city  = 'Coachella Valley';
      d++;
    }
    return { email: r.email, first_name: r.first_name, last_name: r.last_name, score, label, city };
  });
  console.log(`coverage: personal=${p}  city_fallback=${c}  default=${d}`);

  if (!EXECUTE) {
    enriched.slice(0, 3).forEach(r => console.log(`  ${r.email}  →  ${r.score}/${r.label}/${r.city}`));
    console.log('\n--execute to run for real');
    return;
  }

  // 3. Per-contact PUT (lookup → update) with concurrency
  let updated = 0, notFound = 0, errors = 0;
  await poolMap(enriched, CONCURRENCY, async (r) => {
    // 3a. Lookup contact_id by email
    const lookup = await httpJson('GET', 'api.cc.email',
      `/v3/contacts?email=${encodeURIComponent(r.email)}`,
      { Authorization: `Bearer ${ccToken}` });
    if (lookup.status >= 300 || !lookup.data?.contacts?.[0]) { notFound++; return; }
    const c = lookup.data.contacts[0];

    // 3b. PUT with new custom fields (merge with existing)
    const put = await httpJson('PUT', 'api.cc.email', `/v3/contacts/${c.contact_id}`,
      { Authorization: `Bearer ${ccToken}` },
      {
        email_address: c.email_address,
        first_name:    c.first_name || r.first_name,
        last_name:     c.last_name  || r.last_name,
        update_source: 'Account',
        custom_fields: [
          { custom_field_id: CF.score, value: String(r.score) },
          { custom_field_id: CF.label, value: r.label },
          { custom_field_id: CF.city,  value: r.city  },
        ],
      });
    if (put.status >= 300) { errors++; if (errors < 5) console.warn(`  err ${r.email}: ${put.status}`); return; }
    updated++;
  }, (done, total) => {
    process.stdout.write(`\rprogress: ${done}/${total}  updated=${updated}  notFound=${notFound}  errors=${errors}     `);
  });

  console.log(`\n\n── DONE ──`);
  console.log(`updated:  ${updated}`);
  console.log(`notFound: ${notFound}`);
  console.log(`errors:   ${errors}`);
}

main().catch((err) => { console.error('\nFATAL:', err.message); process.exit(2); });
