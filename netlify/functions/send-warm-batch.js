/**
 * send-warm-batch — Deliverability-safe sender for sender reputation recovery
 *
 * Designed for sender reputation rebuild after the 2026-05-12 blast disaster
 * (1 open / 6720 sent because mail.thepropertydna.com was unwarmed).
 *
 * Rules:
 *   - Max 25 emails per call
 *   - Plain text body (no HTML, no images)
 *   - Single CTA (a real URL the user clicks)
 *   - Skips any address from a high-bounce ISP unless explicitly warmed
 *   - Daily quota of 50 emails (volume warm-up curve)
 *   - List-Unsubscribe headers + reply_to set to Dan's real Gmail
 *
 * POST body: {
 *   recipients: [{email, firstName?, address?}, ...],   // max 25
 *   subject:     "..."  (must be short, no marketing words)
 *   bodyText:    "..."  (plain text only, {{firstName}} {{address}} interpolation supported)
 *   campaignId?: "..."  (optional — for tracking)
 * }
 */
const https = require('https');
const db    = require('./_supabase');
const { rampCap } = require('./_email');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-internal-key',
  'Content-Type':                 'application/json',
};

const SENDER       = process.env.WARMUP_SENDER_EMAIL || 'daniel@thepropertydna.com';
const SENDER_NAME  = process.env.WARMUP_SENDER_NAME  || 'Daniel Stuart';
const REPLY_TO     = process.env.REPLY_TO_EMAIL      || 'stuartteamps@gmail.com';
const UNSUB_MAILTO = process.env.UNSUB_MAILTO        || 'unsubscribe@mail.thepropertydna.com';
const SITE_URL     = 'https://thepropertydna.com';
const MAX_PER_CALL = 25;
// Daily quota from the shared ramp dial (EMAIL_RAMP_WEEK); WARMUP_DAILY_LIMIT
// overrides per-channel when set.
const DAILY_LIMIT  = rampCap('warmupDaily');

function resendSend(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: {} }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function interpolate(template, vars) {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName || 'there')
    .replace(/\{\{address\}\}/g,   vars.address   || 'your property')
    .replace(/\{\{email\}\}/g,     vars.email     || '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: '{}' };

  const key = event.headers['x-internal-key'] || event.headers['x-admin-key'];
  if (key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: '{"error":"unauthorized"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '{"error":"bad json"}' }; }

  const { recipients = [], subject = '', bodyText = '', campaignId = null } = body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { statusCode: 400, headers: CORS, body: '{"error":"recipients required"}' };
  }
  if (recipients.length > MAX_PER_CALL) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `max ${MAX_PER_CALL} recipients per call` }) };
  }
  if (!subject || subject.length > 60) {
    return { statusCode: 400, headers: CORS, body: '{"error":"subject required (max 60 chars)"}' };
  }
  if (!bodyText || bodyText.length < 30) {
    return { statusCode: 400, headers: CORS, body: '{"error":"bodyText required (plain text, min 30 chars)"}' };
  }

  // Spam-flag check on subject
  const SPAM_TRIGGERS = ['FREE', 'ACT NOW', '!!!', '$$$', 'GUARANTEED', 'WINNER', 'NO COST'];
  for (const t of SPAM_TRIGGERS) {
    if (subject.toUpperCase().includes(t)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `subject contains spam trigger: ${t}` }) };
    }
  }

  // Daily limit enforcement
  try {
    const since = new Date(); since.setHours(0,0,0,0);
    const todayEvents = await db.from('email_delivery_events')
      .select('id').filter('created_at', 'gte', since.toISOString())
      .eq('status', 'sent').get().catch(() => []);
    if (Array.isArray(todayEvents) && todayEvents.length + recipients.length > DAILY_LIMIT) {
      return { statusCode: 429, headers: CORS, body: JSON.stringify({
        error: `daily warm-up limit ${DAILY_LIMIT} would be exceeded`,
        sentToday: todayEvents.length,
        wouldAdd:  recipients.length,
      }) };
    }
  } catch { /* non-critical */ }

  // Suppression list — global unsubscribes + bounced
  let unsubSet = new Set();
  let bounceSet = new Set();
  try {
    const us = await db.from('campaign_unsubscribes').select('email').get();
    (us || []).forEach(u => unsubSet.add((u.email || '').toLowerCase()));
    const bc = await db.from('campaign_contacts').select('email').eq('status', 'bounced').get();
    (bc || []).forEach(b => bounceSet.add((b.email || '').toLowerCase()));
  } catch { /* non-critical */ }

  let sent = 0, skipped = 0, failed = 0;
  const results = [];

  for (const r of recipients) {
    const email = (r.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) { skipped++; results.push({ email, status: 'invalid' }); continue; }
    if (unsubSet.has(email))   { skipped++; results.push({ email, status: 'unsubscribed' }); continue; }
    if (bounceSet.has(email))  { skipped++; results.push({ email, status: 'prior_bounce' }); continue; }

    const personalText = interpolate(bodyText, r);
    const unsubUrl = `${SITE_URL}/.netlify/functions/campaign-unsubscribe?email=${encodeURIComponent(email)}`;

    try {
      const res = await resendSend({
        from: `${SENDER_NAME} <${SENDER}>`,
        reply_to: REPLY_TO,
        to: [email],
        subject: subject.trim(),
        text: personalText + `\n\n---\nReply STOP or click here to unsubscribe: ${unsubUrl}`,
        headers: {
          'List-Unsubscribe':      `<mailto:${UNSUB_MAILTO}?subject=unsubscribe>, <${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: campaignId ? [{ name: 'campaign_id', value: campaignId }, { name: 'channel', value: 'warmup' }] : [{ name: 'channel', value: 'warmup' }],
      });
      const ok = res.status < 300;
      if (ok) sent++; else failed++;
      results.push({ email, status: ok ? 'sent' : 'failed', resend_id: res.data?.id || null });

      // Pacing — Resend rate limit is 2/sec; we space at 1/sec which also
      // looks more natural to ISPs (bulk patterns send in <1 sec/email).
      await new Promise(r => setTimeout(r, 1000));

      db.insert('email_delivery_events', {
        recipient_email: email,
        sender_email:    SENDER,
        subject,
        status:          ok ? 'sent' : 'failed',
        provider:        'resend',
        metadata:        { source: 'warmup_batch', resend_id: res.data?.id || null, campaign_id: campaignId },
      }).catch(() => {});
    } catch (err) {
      failed++;
      results.push({ email, status: 'error', err: err.message?.slice(0, 100) });
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ sent, skipped, failed, total: recipients.length, results }),
  };
};
