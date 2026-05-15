/**
 * send-cc-blast — Targeted Constant Contact campaign sender
 *
 * Resend's shared-IP reputation is too damaged for our cold subdomain to
 * recover via warm-up (0 opens / 39 delivered through daniel@thepropertydna).
 * CC has proven inbox-grade deliverability (newsletters arriving fine).
 *
 * This function programmatically creates + schedules a CC campaign:
 *   1. Creates a new CC email campaign with provided subject + HTML
 *   2. Schedules immediate send ("scheduled_date":"0") to the given list_ids
 *
 * POST body: {
 *   subject:      "...",        (required, <60 chars)
 *   html:         "...",        (required, full HTML body)
 *   listIds:      ["uuid",...], (required, CC list IDs)
 *   campaignName?:"..."         (optional, defaults to subject + timestamp)
 *   replyTo?:     "...",        (optional, defaults to stuartteamps@gmail.com)
 *   fromEmail?:   "...",        (optional, defaults to Dan)
 *   fromName?:    "..."         (optional)
 * }
 */
const https = require('https');
const db    = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type':                 'application/json',
};

const CC_API = 'api.cc.email';

function apiPost(hostname, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
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
    req.write(body);
    req.end();
  });
}

async function loadCcToken() {
  try {
    const rows = await db.from('oauth_tokens')
      .select('access_token,expires_at')
      .eq('provider', 'constant_contact').limit(1).get();
    if (rows?.[0]?.access_token) return rows[0].access_token;
  } catch { /* fall through */ }
  return process.env.CC_ACCESS_TOKEN || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: '{}' };

  const key = event.headers['x-internal-key'];
  if (key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"bad json"}' }; }

  const {
    subject,
    html,
    listIds,
    campaignName,
    replyTo  = 'stuartteamps@gmail.com',
    fromEmail = 'reports@thepropertydna.com',
    fromName  = 'Daniel Stuart | Stuart Team',
  } = body;

  if (!subject || subject.length > 70)             return { statusCode: 400, headers: CORS, body: '{"error":"subject required (max 70 chars)"}' };
  if (!html || html.length < 100)                  return { statusCode: 400, headers: CORS, body: '{"error":"html required (min 100 chars)"}' };
  if (!Array.isArray(listIds) || !listIds.length)  return { statusCode: 400, headers: CORS, body: '{"error":"listIds required"}' };

  const token = await loadCcToken();
  if (!token) return { statusCode: 500, headers: CORS, body: '{"error":"no CC token"}' };

  // 1. Create campaign with lists embedded in the activity
  const name = campaignName || `${subject.slice(0,40)} - ${Date.now()}`;
  const create = await apiPost(CC_API, '/v3/emails', token, {
    name,
    contact_list_ids: listIds,
    email_campaign_activities: [{
      format_type: 5,
      from_name:    fromName,
      from_email:   fromEmail,
      reply_to_email: replyTo,
      subject,
      html_content: html,
      permalink_name: '',
      contact_list_ids: listIds,
    }],
  });

  if (create.status !== 201 && create.status !== 200) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({
      error: 'CC campaign creation failed',
      details: create.data,
    }) };
  }

  const activityId = create.data?.campaign_activities?.[0]?.campaign_activity_id;
  const campaignId = create.data?.campaign_id;
  if (!activityId) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'no activity id', data: create.data }) };

  // 2. Schedule send — POST to /v3/emails/activities/{activity_id}/schedules
  const sched = await apiPost(CC_API,
    `/v3/emails/activities/${activityId}/schedules`,
    token,
    { scheduled_date: '0' }   // immediate
  );

  // Log it (kpi is fire-and-forget, doesn't return a promise)
  try {
    db.kpi('cc_blast_sent', null, {
      campaignId, activityId, subject, listIds, sched_status: sched.status,
    });
  } catch { /* ignore */ }

  const ok = sched.status === 201 || sched.status === 200;

  return {
    statusCode: ok ? 200 : 502,
    headers: CORS,
    body: JSON.stringify({
      ok,
      campaignId,
      activityId,
      schedule: sched.data,
      schedule_http: sched.status,
      message: ok ? 'Campaign created and scheduled. CC will send shortly.' : 'Created but schedule failed — manual send from CC dashboard.',
    }),
  };
};
