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

const CC_SITE_ID    = '784437c8-12f8-470b-bb0b-ccf5ec9c0a4a';
const CLIENT_ID     = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SECRET = 'UCMY_HNPbhCRENfCi_uK8g';

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

exports.handler = async () => {
  console.log('[auto-refresh-cc-token] Starting...');

  const refreshToken = process.env.CC_REFRESH_TOKEN;
  const netlifyPat   = process.env.NETLIFY_PAT;

  if (!refreshToken) {
    console.error('[auto-refresh-cc-token] CC_REFRESH_TOKEN not set — run node tools/refresh-cc-token.js first');
    return { statusCode: 500, body: 'CC_REFRESH_TOKEN not set' };
  }

  if (!netlifyPat) {
    console.error('[auto-refresh-cc-token] NETLIFY_PAT not set — add it in Netlify env vars');
    return { statusCode: 500, body: 'NETLIFY_PAT not set' };
  }

  try {
    const tokens = await refreshCCToken(refreshToken);
    console.log('[auto-refresh-cc-token] New access token received.');

    await updateNetlifyEnv(netlifyPat, 'CC_ACCESS_TOKEN', tokens.access_token);
    console.log('[auto-refresh-cc-token] CC_ACCESS_TOKEN updated in Netlify.');

    // If CC returned a new refresh token, save it too
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      await updateNetlifyEnv(netlifyPat, 'CC_REFRESH_TOKEN', tokens.refresh_token);
      console.log('[auto-refresh-cc-token] CC_REFRESH_TOKEN rotated.');
    }

    const exp = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : 'unknown';

    console.log(`[auto-refresh-cc-token] Done. Token expires: ${exp}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, expires: exp }) };

  } catch (err) {
    console.error('[auto-refresh-cc-token] FAILED:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
