/**
 * auto-refresh-cc-token — Refreshes CC access token every Wednesday 11:59 PM PST
 *
 * Scheduled: netlify.toml "59 7 * * 4" (Thu 07:59 UTC = Wed 11:59 PM PST)
 *
 * Reads CC_REFRESH_TOKEN from env, gets a new access token from CC,
 * then updates CC_ACCESS_TOKEN in Netlify env via Netlify API.
 *
 * One-time setup needed:
 *   1. Run: node tools/refresh-cc-token.js  (gets refresh_token with offline_access scope)
 *   2. Set NETLIFY_PAT in Netlify env (User Settings → Applications → Personal access tokens)
 */

const https   = require('https');
const db      = require('./_supabase');

const CC_SITE_ID    = '784437c8-12f8-470b-bb0b-ccf5ec9c0a4a';
const CLIENT_ID     = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SECRET = 'UCMY_HNPbhCRENfCi_uK8g';
// Persist tokens in Supabase rather than Netlify env. Netlify env vars are
// shared across every Lambda function and AWS imposes a 4KB ceiling on the
// combined K=V pairs — a 1.2KB CC JWT was burning ~30% of that budget.
const STORE_IN_SUPABASE = (process.env.OAUTH_STORE || 'supabase') !== 'netlify_env';

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
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

function patch(hostname, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname, path, method: 'PATCH',
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

async function refreshCCToken(refreshToken) {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body  = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
  const res   = await post(
    'authz.constantcontact.com',
    '/oauth2/default/v1/token',
    {
      'Authorization':  `Basic ${creds}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body
  );
  if (!res.data?.access_token) {
    throw new Error(`CC token refresh failed: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  }
  return res.data;
}

async function updateNetlifyEnv(netlifyPat, key, value) {
  const res = await patch(
    'api.netlify.com',
    `/api/v1/sites/${CC_SITE_ID}/env/${key}`,
    netlifyPat,
    { value }
  );
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Netlify env update failed: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  }
  return res.data;
}

async function loadRefreshToken() {
  if (STORE_IN_SUPABASE) {
    try {
      const rows = await db.from('oauth_tokens').select('refresh_token').eq('provider', 'constant_contact').limit(1).get();
      if (rows?.[0]?.refresh_token) return rows[0].refresh_token;
    } catch { /* table may not exist yet, fall through */ }
  }
  return process.env.CC_REFRESH_TOKEN || null;
}

async function persistTokens(tokens) {
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
  if (STORE_IN_SUPABASE) {
    await db.upsert('oauth_tokens', {
      provider:      'constant_contact',
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expires_at:    expiresAt,
      metadata:      { scope: tokens.scope || null, token_type: tokens.token_type || null },
      updated_at:    new Date().toISOString(),
    }, 'provider');
    return { mode: 'supabase', expires: expiresAt };
  }

  // Fallback: write back to Netlify env (legacy path, requires NETLIFY_PAT)
  const netlifyPat = process.env.NETLIFY_PAT;
  if (!netlifyPat) throw new Error('NETLIFY_PAT not set and OAUTH_STORE != supabase');
  await updateNetlifyEnv(netlifyPat, 'CC_ACCESS_TOKEN', tokens.access_token);
  if (tokens.refresh_token) await updateNetlifyEnv(netlifyPat, 'CC_REFRESH_TOKEN', tokens.refresh_token);
  return { mode: 'netlify_env', expires: expiresAt };
}

exports.handler = async () => {
  console.log('[auto-refresh-cc-token] Starting...');

  const refreshToken = await loadRefreshToken();
  if (!refreshToken) {
    console.error('[auto-refresh-cc-token] No refresh token found in oauth_tokens or env — run tools/refresh-cc-token.js first');
    return { statusCode: 500, body: 'CC refresh token not set' };
  }

  try {
    const tokens = await refreshCCToken(refreshToken);
    console.log('[auto-refresh-cc-token] New access token received.');

    const persisted = await persistTokens(tokens);
    console.log(`[auto-refresh-cc-token] Persisted via ${persisted.mode}. Expires: ${persisted.expires || 'unknown'}`);

    return { statusCode: 200, body: JSON.stringify({ ok: true, expires: persisted.expires, mode: persisted.mode }) };

  } catch (err) {
    console.error('[auto-refresh-cc-token] FAILED:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
