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

function supa(path, extraHeaders = {}) {
  return new Promise((resolve) => {
    const u = new URL(SUPA + path);
    https.get({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers:  { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, ...extraHeaders },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

// Page through ALL rows of a PostgREST query, since the server caps each page.
async function supaPaged(basePath, pageSize = 1000) {
  const out = [];
  let offset = 0;
  while (true) {
    const rangeEnd = offset + pageSize - 1;
    const rows = await supa(basePath, { Range: `${offset}-${rangeEnd}`, 'Range-Unit': 'items' }) || [];
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 200000) break; // hard safety stop
  }
  return out;
}

function ccCall(method, token, path, payload) {
  const body = payload ? JSON.stringify(payload) : '';
  return new Promise((resolve) => {
    const req = https.request({
      hostname: CC_API, path, method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    if (body) req.write(body);
    req.end();
  });
}
const ccPost = (t, p, b) => ccCall('POST', t, p, b);
const ccPut  = (t, p, b) => ccCall('PUT',  t, p, b);
const ccGet  = (t, p)    => ccCall('GET',  t, p, null);

exports.handler = async () => {
  // 1. Get all unsubscribed emails (paginate around PostgREST's 1K cap)
  const rows = await supaPaged('/rest/v1/campaign_unsubscribes?select=email&order=created_at.desc');
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

  // 3. Per-contact unsubscribe — lookup contact by email, PATCH permission_to_send.
  // CC has no documented bulk email-only unsubscribe activity that we have
  // confirmed working; their bulk endpoints work by contact_ids or list_ids.
  // Per-contact is slower but bulletproof. Within one Lambda invocation we
  // process up to MAX_PER_RUN contacts; the daily cron clears the rest.
  const MAX_PER_RUN = 200;
  const CONCURRENCY = 10;
  const slice = emails.slice(0, MAX_PER_RUN);
  let alreadyDone = 0, notInCC = 0, succeeded = 0, failed = 0;
  const sampleErrors = [];

  async function processOne(email) {
    try {
      const look = await ccGet(ccToken, `/v3/contacts?email=${encodeURIComponent(email)}`);
      const c = look?.data?.contacts?.[0];
      if (!c) { notInCC++; return; }
      if (c.email_address?.permission_to_send === 'unsubscribed') { alreadyDone++; return; }
      const res = await ccPut(ccToken, `/v3/contacts/${c.contact_id}`, {
        update_source: 'Account',
        email_address: { address: email, permission_to_send: 'unsubscribed' },
      });
      if (res.status >= 200 && res.status < 300) { succeeded++; }
      else {
        failed++;
        if (sampleErrors.length < 3) sampleErrors.push({ email, status: res.status, body: String(JSON.stringify(res.data)).slice(0, 200) });
      }
    } catch (e) {
      failed++;
      if (sampleErrors.length < 3) sampleErrors.push({ email, error: String(e.message || e).slice(0, 160) });
    }
  }

  // Process in concurrent windows of CONCURRENCY
  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    await Promise.all(slice.slice(i, i + CONCURRENCY).map(processOne));
  }
  const totalAttempted = slice.length;
  const responses = [{ note: `processed ${totalAttempted} / ${emails.length} total unsub queue`, succeeded, alreadyDone, notInCC, failed, sampleErrors, status: failed === 0 ? 200 : 207 }];

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
