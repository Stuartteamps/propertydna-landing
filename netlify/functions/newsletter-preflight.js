// newsletter-preflight — runs every Wednesday morning. Health-checks the CC
// OAuth token in Supabase. If close to expiry, kicks off auto-refresh. If
// missing or refresh fails, emails Dan with the one-click re-auth URL.
//
// Cron: "0 14 * * 3" (Wed 14:00 UTC = 7 AM PDT) — 33 hours before send.

const https = require('https');
const db    = require('./_supabase');
const alert = require('./_alert');

const CC_PROVIDER = 'constant_contact';
const SITE        = 'https://thepropertydna.com';

function decodeJwtExp(token) {
  try {
    const payload = token.split('.')[1];
    const padded  = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch { return null; }
}

async function loadToken() {
  try {
    const rows = await db.from('oauth_tokens')
      .select('access_token,refresh_token,expires_at,updated_at')
      .eq('provider', CC_PROVIDER)
      .limit(1)
      .get();
    return rows?.[0] || null;
  } catch (err) {
    return { error: err.message };
  }
}

function triggerRefresh() {
  // Invoke auto-refresh-cc-token in-band. Same Netlify project, internal hop.
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'thepropertydna.com',
      path: '/.netlify/functions/auto-refresh-cc-token',
      method: 'POST',
      headers: { 'Content-Length': 0, 'User-Agent': 'newsletter-preflight/1.0' },
    }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    req.end();
  });
}

exports.handler = async () => {
  const startedAt = new Date().toISOString();
  console.log('[newsletter-preflight] starting', startedAt);

  const token = await loadToken();
  const reauthUrl = `${SITE}/.netlify/functions/cc-oauth-start?key=${process.env.INTERNAL_API_KEY || ''}`;

  // 1. Token missing entirely → critical alert
  if (!token || token.error || !token.access_token) {
    console.error('[newsletter-preflight] no CC token in oauth_tokens');
    await alert.send({
      level:   'critical',
      subject: 'CC token MISSING — newsletter will fall back to Resend on Thursday',
      body:    `The <code>oauth_tokens</code> row for Constant Contact is empty.<br>
                Without it, Thursday's newsletter cron will fall back to Resend from
                <code>hello@mail.thepropertydna.com</code> which has historically landed in junk.<br><br>
                <strong>Action required:</strong> visit the URL below in your browser and
                authorize PropertyDNA in Constant Contact. Takes 30 seconds.<br><br>
                <a href="${reauthUrl}" style="color:#E8B84B;background:#1f1a15;padding:12px 22px;text-decoration:none;border-radius:3px">→ Re-authorize CC</a>`,
      context: { token, reauthUrl },
    });
    db.kpi('newsletter_preflight', null, { status: 'critical', reason: 'no_cc_token' });
    return { statusCode: 200, body: JSON.stringify({ status: 'critical', alert: 'sent' }) };
  }

  // 2. Token present — check freshness
  const expMs   = token.expires_at ? new Date(token.expires_at).getTime() : decodeJwtExp(token.access_token);
  const nowMs   = Date.now();
  const hoursLeft = expMs ? Math.round((expMs - nowMs) / 3600000) : null;

  console.log('[newsletter-preflight] token hours until expiry:', hoursLeft);

  // Cron fires Thursday ~33h after this preflight. If we have <40h, refresh now.
  if (hoursLeft !== null && hoursLeft < 40) {
    console.log('[newsletter-preflight] refreshing token (only', hoursLeft, 'h left)');
    const refresh = await triggerRefresh();
    if (refresh.status !== 200) {
      await alert.send({
        level:   'critical',
        subject: 'CC token refresh FAILED — manual re-auth required',
        body:    `Auto-refresh returned status ${refresh.status}. Thursday's send will fall back to Resend (likely junk).<br><br>
                  <a href="${reauthUrl}" style="color:#E8B84B;background:#1f1a15;padding:12px 22px;text-decoration:none">→ Re-authorize CC</a>`,
        context: { refresh, hoursLeft, reauthUrl },
      });
      db.kpi('newsletter_preflight', null, { status: 'critical', reason: 'refresh_failed', hoursLeft, refresh });
      return { statusCode: 200, body: JSON.stringify({ status: 'critical', refresh }) };
    }
    console.log('[newsletter-preflight] refresh ok');
  }

  // 3. All good — silent success (no email needed)
  db.kpi('newsletter_preflight', null, { status: 'healthy', hoursLeft, expires_at: token.expires_at });
  console.log('[newsletter-preflight] healthy');
  return { statusCode: 200, body: JSON.stringify({ status: 'healthy', hoursLeft, expires_at: token.expires_at }) };
};
