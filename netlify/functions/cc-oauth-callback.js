/**
 * CC OAuth callback — CC redirects here after login.
 * Exchanges auth code for access + refresh tokens.
 * Saves both to Netlify env automatically via Netlify API.
 * Shows a simple success/error page.
 *
 * One-time setup: add this URL as an authorized redirect in CC developer portal:
 *   https://thepropertydna.com/.netlify/functions/cc-oauth-callback
 */
const https = require('https');
const db    = require('./_supabase');

const CLIENT_ID     = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const CLIENT_SECRET = 'UCMY_HNPbhCRENfCi_uK8g';
const REDIRECT_URI  = 'https://thepropertydna.com/.netlify/functions/cc-oauth-callback';
const SITE_ID       = '784437c8-12f8-470b-bb0b-ccf5ec9c0a4a';
// Tokens persist in Supabase (oauth_tokens table) instead of Netlify env to
// avoid the AWS Lambda 4KB env-var ceiling. Set OAUTH_STORE=netlify_env to
// force the legacy path.
const STORE_IN_SUPABASE = (process.env.OAUTH_STORE || 'supabase') !== 'netlify_env';

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
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

function setNetlifyEnv(key, value, pat) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify([{ key, value, context: 'all', is_secret: true }]);
    const req  = https.request({
      hostname: 'api.netlify.com',
      path:     `/api/v1/sites/${SITE_ID}/env`,
      method:   'PUT',
      headers: {
        Authorization:  `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function page(title, body, color = '#22c55e') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#0A0908;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Georgia,serif;color:#F4F0E8}
.box{text-align:center;padding:48px;max-width:480px}
h1{font-size:32px;color:${color};margin:0 0 16px}
p{font-size:15px;color:#6B6252;line-height:1.7;margin:0}
</style></head><body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

exports.handler = async (event) => {
  const { code, error, error_description } = event.queryStringParameters || {};

  if (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: page('Authorization Failed', `${error}: ${error_description || ''}`, '#ef4444'),
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: page('Missing Code', 'No authorization code in the redirect. Try again.', '#ef4444'),
    };
  }

  // Exchange code for tokens. Logging is verbose by design — when this fails,
  // the diagnostics are the only thing that tells us whether it's a secret,
  // redirect_uri, or expired-code problem.
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenBody = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('[cc-oauth-callback] code received, length=', (code || '').length, 'first8=', (code || '').slice(0, 8));
  console.log('[cc-oauth-callback] redirect_uri=', REDIRECT_URI);
  console.log('[cc-oauth-callback] client_id=',    CLIENT_ID);
  console.log('[cc-oauth-callback] client_secret prefix=', CLIENT_SECRET.slice(0, 4) + '...');

  let tokenData;
  try {
    const res = await httpsPost(
      'authz.constantcontact.com',
      '/oauth2/default/v1/token',
      {
        Authorization:  `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenBody),
      },
      tokenBody
    );
    console.log('[cc-oauth-callback] CC response status=', res.status);
    console.log('[cc-oauth-callback] CC response body=', JSON.stringify(res.data).slice(0, 800));
    if (res.status !== 200 || !res.data.access_token) {
      const errorDetail = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
      throw new Error(`status ${res.status}: ${errorDetail}`);
    }
    tokenData = res.data;
  } catch (err) {
    console.error('[cc-oauth-callback] EXCHANGE FAILED:', err.message);
    const safeDetails = `<br><br><strong>Diagnostic detail (also in Netlify function logs):</strong><br>
       Client ID: ${CLIENT_ID}<br>
       Client secret prefix: ${CLIENT_SECRET.slice(0, 4)}...<br>
       Redirect URI sent: ${REDIRECT_URI}<br>
       Code length: ${(code || '').length}<br>
       Error: ${err.message.replace(/</g, '&lt;')}`;
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: page('Token Exchange Failed', err.message + safeDetails, '#ef4444'),
    };
  }

  const { access_token, refresh_token, expires_in } = tokenData;
  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  let storageStatus = 'no storage attempted';

  if (STORE_IN_SUPABASE) {
    try {
      await db.upsert('oauth_tokens', {
        provider:      'constant_contact',
        access_token,
        refresh_token: refresh_token || null,
        expires_at:    expiresAt,
        metadata:      { token_type: tokenData.token_type || null, scope: tokenData.scope || null },
        updated_at:    new Date().toISOString(),
      }, 'provider');
      storageStatus = 'saved to Supabase ✓';
    } catch (e) {
      storageStatus = `Supabase save error: ${e.message}`;
    }
  } else {
    // Legacy path — write tokens back to Netlify env
    const pat = process.env.NETLIFY_PAT;
    if (!pat) {
      storageStatus = 'skipped (NETLIFY_PAT not set, OAUTH_STORE=netlify_env)';
    } else {
      try {
        for (const [k, v] of [['CC_ACCESS_TOKEN', access_token], ['CC_REFRESH_TOKEN', refresh_token || '']]) {
          const b = JSON.stringify([{ key: k, value: v, context: 'all', is_secret: true }]);
          await new Promise((res, rej) => {
            const req = https.request({
              hostname: 'api.netlify.com',
              path: `/api/v1/sites/${SITE_ID}/env`,
              method: 'PUT',
              headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) },
            }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(r.statusCode)); });
            req.on('error', rej);
            req.write(b);
            req.end();
          });
        }
        storageStatus = 'saved to Netlify env ✓';
      } catch (e) {
        storageStatus = `Netlify env error: ${e.message}`;
      }
    }
  }

  const expiresHours = Math.round((expires_in || 86400) / 3600);
  const hasRefresh   = !!refresh_token;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: page(
      '✓ CC Connected',
      `Access token valid for ${expiresHours}h.<br>
       Refresh token: ${hasRefresh ? 'saved' : 'not returned'}.<br>
       Storage: ${storageStatus}.<br><br>
       The weekly cron will keep this fresh automatically.<br>
       You never need to do this again.`
    ),
  };
};
