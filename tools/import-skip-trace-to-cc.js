#!/usr/bin/env node
/**
 * import-skip-trace-to-cc.js
 *
 * Pulls deduped CV-local + CV-absentee skip-traced contacts from Supabase
 * `campaign_contacts` and bulk-imports them into Constant Contact's
 * "PropertyDNA — All Contacts" list (id 662ac8de-...). CC's import endpoint
 * dedupes by email automatically — existing rows are updated, not duplicated.
 *
 * Tags every contact with its source classification (cv_local / cv_absentee
 * / cv_other) so future segmentation is one filter away.
 *
 * Usage:
 *   node tools/import-skip-trace-to-cc.js            # dry run, prints count
 *   node tools/import-skip-trace-to-cc.js --execute  # actually uploads
 */

const https = require('https');
const { execSync } = require('child_process');

const PROJECT_REF = 'neccpdfhmfnvyjgyrysy';
const CC_LIST_ID  = '662ac8de-4599-11f1-8c5f-02420a320003';
const EXECUTE     = process.argv.includes('--execute');

// ── Credentials ──────────────────────────────────────────────────────────────
function getSupabaseToken() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null').toString().trim();
  return Buffer.from(raw.replace('go-keyring-base64:', ''), 'base64').toString('utf8');
}

function postJson(host, path, headers, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    req.write(data); req.end();
  });
}

async function getCCToken(sbpToken) {
  if (process.env.CC_TOKEN) return process.env.CC_TOKEN;
  const res = await postJson('api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` },
    { query: "select access_token from oauth_tokens where provider='constant_contact'" });
  console.log(`[getCCToken] status=${res.status} data_type=${Array.isArray(res.data) ? 'array' : typeof res.data} len=${Array.isArray(res.data) ? res.data.length : 0}`);
  if (res.status !== 200) throw new Error(`Supabase responded ${res.status}: ${JSON.stringify(res.data).slice(0,200)}`);
  if (!res.data?.[0]?.access_token) throw new Error('No CC token in oauth_tokens (query returned: ' + JSON.stringify(res.data).slice(0,200) + ')');
  return res.data[0].access_token;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN (pass --execute to upload)'}`);

  const sbpToken = getSupabaseToken();
  const ccToken  = await getCCToken(sbpToken);
  console.log(`got cc token (${ccToken.length} chars)`);

  // 1. Pull candidates
  const candidatesSql = `
    with cv_cities as (
      select unnest(array['palm springs','cathedral city','rancho mirage','palm desert','indian wells','la quinta','indio','desert hot springs','coachella','thousand palms']) as city
    ),
    campaigns_cv as (
      select id, name from campaigns
      where name ilike '%palm springs%' or name ilike '%coachella%' or name ilike '%cv %' or name ilike '%movie colony%'
         or name ilike '%indian wells%' or name ilike '%rancho mirage%' or name ilike '%palm desert%'
         or name ilike '%la quinta%'    or name ilike '%absentee%'      or name ilike '%cathedral city%'
         or name ilike '%desert hot springs%' or name ilike '%indio%'
    ),
    candidates as (
      select cc.email, cc.first_name, cc.last_name, cc.city, cc.state, cc.zip, cc.address, cc.phone,
             c.name as source_campaign,
             case
               when c.name ilike '%absentee%' then 'cv_absentee'
               when c.name ilike '%movie colony%' then case when c.name ilike '%absentee%' then 'cv_absentee' else 'cv_local' end
               when lower(cc.city) in (select city from cv_cities) then 'cv_local'
               else 'cv_other'
             end as tag
      from campaign_contacts cc
      join campaigns c on c.id = cc.campaign_id
      where cc.email is not null and cc.email <> ''
        and cc.email ilike '%@%.%'
        and cc.status not in ('bounced','unsubscribed')
        and (c.id in (select id from campaigns_cv) or lower(cc.city) in (select city from cv_cities))
    )
    select distinct on (lower(email)) email, first_name, last_name, city, state, zip, address, phone, source_campaign, tag
    from candidates
    order by lower(email), (case when tag='cv_absentee' then 0 when tag='cv_local' then 1 else 2 end);
  `;

  const candRes = await postJson('api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` },
    { query: candidatesSql });
  if (candRes.status >= 300) {
    console.error('Supabase query failed:', candRes.status, candRes.data);
    process.exit(1);
  }
  const rows = candRes.data;
  console.log(`pulled ${rows.length} unique CV-relevant candidates`);
  const byTag = rows.reduce((acc, r) => { acc[r.tag] = (acc[r.tag] || 0) + 1; return acc; }, {});
  console.log('by tag:', byTag);

  if (!EXECUTE) {
    console.log('\ndry run complete — sample rows:');
    rows.slice(0, 3).forEach(r => console.log(`  ${r.email}  |  ${r.first_name || ''} ${r.last_name || ''}  |  ${r.city || ''}  |  ${r.tag}`));
    console.log('\nrun with --execute to actually upload to CC');
    return;
  }

  // 2. Batch + upload via CC's bulk import. CC accepts up to 500 per call.
  const BATCH = 500;
  let totalAccepted = 0, totalRejected = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const importData = slice.map(r => {
      const row = {
        email:       r.email.trim().toLowerCase(),
        first_name:  (r.first_name || '').trim() || undefined,
        last_name:   (r.last_name  || '').trim() || undefined,
        phone:       r.phone ? String(r.phone).replace(/[^\d+]/g, '') || undefined : undefined,
      };
      if (r.address) row.street = r.address;
      if (r.city)    row.city   = r.city;
      if (r.state)   row.state  = r.state;
      if (r.zip)     row.zip    = r.zip;
      // No native tag field in /contacts_json_import — we encode the tag in
      // company_name so the source is visible inside CC even before custom
      // fields are wired up. (Movie Colony Absentee, etc.)
      row.company_name = `PropertyDNA · ${r.tag}`;
      return row;
    });

    const body = {
      import_data: importData,
      list_ids:    [CC_LIST_ID],
    };

    const res = await postJson('api.cc.email', '/v3/activities/contacts_json_import',
      { Authorization: `Bearer ${ccToken}` }, body);

    const accepted = res.data?.activity?.contacts_imported || res.data?.imported || (res.status < 300 ? slice.length : 0);
    const rejected = res.data?.activity?.contacts_rejected || 0;
    totalAccepted += accepted; totalRejected += rejected;
    console.log(`batch ${Math.floor(i/BATCH)+1}/${Math.ceil(rows.length/BATCH)}: status=${res.status} accepted=${accepted} rejected=${rejected}`);
    if (res.status >= 400) {
      console.error('  CC error:', JSON.stringify(res.data).slice(0, 400));
    }
    // Brief pause between batches to be polite
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n── upload complete ──`);
  console.log(`accepted: ${totalAccepted}`);
  console.log(`rejected: ${totalRejected}`);
}

main().catch((err) => { console.error('FATAL:', err.message); process.exit(2); });
