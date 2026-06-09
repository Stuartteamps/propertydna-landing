/**
 * Closes the CAN-SPAM gap: anyone who unsubscribed via our website
 * (campaign_unsubscribes table) gets removed from the Constant Contact list so
 * they never receive another CC newsletter.
 *
 * Uses CC bulk activity endpoint /v3/activities/remove_list_memberships —
 * accepts up to 5,000 email_addresses per call. Runs weekly via cron + can
 * be invoked manually.
 */
const https = require('https');

const CC_API     = 'api.cc.email';
const CC_LIST_ID = '662ac8de-4599-11f1-8c5f-02420a320003';
const SUPA       = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY;

function supa(path) {
  return new Promise((resolve) => {
    const u = new URL(SUPA + path);
    https.get({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers:  { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function ccPost(token, path, payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: CC_API,
      path,
      method:   'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    req.write(body); req.end();
  });
}

exports.handler = async () => {
  // 1. Get all unsubscribed emails
  // PostgREST defaults to 1,000 rows. Bump high so we get the full 3K+ list in one shot.
  const rows = await supa('/rest/v1/campaign_unsubscribes?select=email&order=created_at.desc&limit=50000') || [];
  const emails = Array.from(new Set(rows.map(r => (r.email || '').toLowerCase()).filter(Boolean)));
  if (emails.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, removed: 0, reason: 'no unsubscribes' }) };
  }

  // 2. Get a fresh CC access token from oauth_tokens
  const tokens = await supa('/rest/v1/oauth_tokens?select=access_token&provider=eq.constant_contact');
  const ccToken = tokens && tokens[0] ? tokens[0].access_token : null;
  if (!ccToken) {
    return { statusCode: 503, body: JSON.stringify({ error: 'no CC token in oauth_tokens — re-authorize via cc-oauth-start' }) };
  }

  // 3. CC bulk-removal accepts up to 5,000 email_addresses per call. Batch.
  const BATCH = 4500;
  let totalAttempted = 0;
  const responses = [];
  for (let i = 0; i < emails.length; i += BATCH) {
    const slice = emails.slice(i, i + BATCH);
    const res = await ccPost(ccToken, '/v3/activities/remove_list_memberships', {
      source:          { contact_ids: [], list_ids: [CC_LIST_ID] },
      list_ids:        [CC_LIST_ID],
      email_addresses: slice,
    });
    responses.push({ batch: i / BATCH, status: res.status, sliceSize: slice.length, response: typeof res.data === 'object' ? res.data : String(res.data).slice(0, 200) });
    totalAttempted += slice.length;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok:               responses.every(r => r.status < 300),
      total_attempted:  totalAttempted,
      batches:          responses.length,
      cc_list_id:       CC_LIST_ID,
      first_response:   responses[0],
    }, null, 2),
  };
};
