#!/usr/bin/env node
/**
 * launch-luxury-campaign.js
 *
 * Creates a Constant Contact campaign targeting the "Luxury Absentee 2026-05"
 * tag with the high-end market-intelligence template.
 *
 * Usage:
 *   node tools/launch-luxury-campaign.js                # dry run
 *   node tools/launch-luxury-campaign.js --schedule     # create + schedule send
 *
 * Default behavior is to create the DRAFT only — you review in CC UI and click send.
 */

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_REF = 'neccpdfhmfnvyjgyrysy';
const TAG_NAME    = 'Luxury Absentee 2026-05';
const SCHEDULE    = process.argv.includes('--schedule');

const SUBJECT     = "{{FIRST_NAME}}, your estate's DNA score shifted this quarter";
const FROM_EMAIL  = 'daniel@thepropertydna.com';
const FROM_NAME   = 'Daniel Stuart · PropertyDNA';
const REPLY_TO    = 'stuartteamps@gmail.com';
const TEMPLATE    = fs.readFileSync('tools/email-templates/luxury_market_intelligence.html', 'utf8');

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getSupabaseToken() {
  const raw = execSync('security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null')
    .toString().trim();
  return Buffer.from(raw.replace('go-keyring-base64:', ''), 'base64').toString('utf8');
}

function reqJson(method, host, path, headers, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: host, path, method,
      headers: { 'Content-Type': 'application/json', ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } };
    const req = https.request(opts, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    if (data) req.write(data);
    req.end();
  });
}

async function getCCToken(sbpToken) {
  const r = await reqJson('POST', 'api.supabase.com', `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${sbpToken}` },
    { query: "select access_token from oauth_tokens where provider='constant_contact'" });
  if (r.status >= 300 || !r.data?.[0]?.access_token) {
    throw new Error(`CC token fetch failed (status ${r.status}): ${JSON.stringify(r.data).slice(0,200)}`);
  }
  return r.data[0].access_token;
}

async function getTagSegment(ccToken) {
  // Find our tag
  const tags = await reqJson('GET', 'api.cc.email', '/v3/contact_tags', { Authorization: `Bearer ${ccToken}` });
  const tag = (tags.data?.tags || []).find(t => t.name === TAG_NAME);
  if (!tag) throw new Error(`Tag "${TAG_NAME}" not found in CC. Upload contacts first.`);
  console.log(`  Tag found: ${tag.tag_id} ("${tag.name}")`);
  return tag.tag_id;
}

async function main() {
  console.log(`mode: ${SCHEDULE ? 'CREATE + SCHEDULE' : 'CREATE DRAFT (review in CC UI to send)'}`);

  const sbpToken = getSupabaseToken();
  const ccToken  = await getCCToken(sbpToken);
  console.log(`  Got CC token (${ccToken.length} chars)`);

  const tagId = await getTagSegment(ccToken);

  // Build campaign payload — CC v3 email_campaigns endpoint
  const campaignName = `Luxury Market Intelligence — ${new Date().toISOString().slice(0,10)}`;
  const payload = {
    name: campaignName,
    email_campaign_activities: [{
      format_type: 5, // V3 modern email
      from_name: FROM_NAME,
      from_email: FROM_EMAIL,
      reply_to_email: REPLY_TO,
      subject: SUBJECT,
      html_content: TEMPLATE,
      preheader: "Your address triggered a notable repricing signal — confidential brief enclosed",
    }],
  };

  console.log(`\nCreating campaign: "${campaignName}"`);
  const create = await reqJson('POST', 'api.cc.email', '/v3/emails',
    { Authorization: `Bearer ${ccToken}` }, payload);

  if (create.status >= 300) {
    console.error(`  Campaign create FAILED (${create.status}):`,
      JSON.stringify(create.data).slice(0, 500));
    process.exit(1);
  }
  const campaignId = create.data?.campaign_id;
  const activityId = create.data?.campaign_activities?.[0]?.campaign_activity_id;
  console.log(`  ✓ Campaign created: ${campaignId}`);
  console.log(`  ✓ Activity: ${activityId}`);

  // Add tag-based segment
  if (activityId) {
    const seg = await reqJson('POST', 'api.cc.email',
      `/v3/emails/activities/${activityId}/segments`,
      { Authorization: `Bearer ${ccToken}` },
      { segment_ids: [], tag_ids: [tagId] });
    if (seg.status >= 300) {
      console.warn(`  Segment add warning: ${seg.status} ${JSON.stringify(seg.data).slice(0,200)}`);
    } else {
      console.log(`  ✓ Tagged segment attached`);
    }
  }

  if (!SCHEDULE) {
    console.log(`\nDraft ready. Review at https://app.constantcontact.com/pages/campaigns/email#/campaigns/${campaignId}`);
    console.log(`To schedule immediate send: re-run with --schedule`);
    return;
  }

  // Schedule for immediate send
  console.log(`\nScheduling immediate send...`);
  const sched = await reqJson('POST', 'api.cc.email',
    `/v3/emails/activities/${activityId}/schedules`,
    { Authorization: `Bearer ${ccToken}` },
    { scheduled_date: "0" }); // 0 = send now
  if (sched.status >= 300) {
    console.error(`  Schedule FAILED (${sched.status}):`,
      JSON.stringify(sched.data).slice(0, 500));
    process.exit(1);
  }
  console.log(`  ✓ Scheduled for immediate send`);
  console.log(`\nCampaign live: https://app.constantcontact.com/pages/campaigns/email#/campaigns/${campaignId}`);
}

main().catch(e => { console.error(e); process.exit(1); });
