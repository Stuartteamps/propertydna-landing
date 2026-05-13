/**
 * Key Watchdog — runs every Monday 8 AM PST.
 * 1. Decodes JWT keys to check expiry.
 * 2. Auto-rotates n8n API key if < 14 days remaining.
 * 3. Sends alert email for any key expiring within 14 days.
 * 4. Saves new keys to Netlify env via PAT.
 */
const https = require('https');

const SITE_ID   = '784437c8-12f8-470b-bb0b-ccf5ec9c0a4a';
const ALERT_TO  = 'stuartteamps@gmail.com';
const N8N_HOST  = 'dillabean.app.n8n.cloud';
const DAYS14    = 14 * 24 * 60 * 60 * 1000;

// ── helpers ──────────────────────────────────────────────────────────────────

function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp ? payload.exp * 1000 : null; // ms
  } catch { return null; }
}

function daysLeft(expiryMs) {
  return Math.round((expiryMs - Date.now()) / 86400000);
}

function httpsJson(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function setNetlifyEnv(key, value, pat) {
  const body = JSON.stringify([{ key, value, context: 'all', is_secret: true }]);
  return httpsJson({
    hostname: 'api.netlify.com',
    path: `/api/v1/sites/${SITE_ID}/env`,
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

async function sendAlert(subject, html, resendKey) {
  const body = JSON.stringify({
    from: 'PropertyDNA <reports@thepropertydna.com>',
    to: [ALERT_TO],
    subject,
    html,
  });
  return httpsJson({
    hostname: 'api.resend.com',
    path: '/emails',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

// ── n8n key rotation ──────────────────────────────────────────────────────────

async function rotateN8nKey(currentKey) {
  const oneYearOut = new Date(Date.now() + 365 * 86400000).toISOString();
  const body = JSON.stringify({ expiresAt: oneYearOut });

  // Create new key
  const create = await httpsJson({
    hostname: N8N_HOST,
    path: '/api/v1/api-key',
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': currentKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (create.status !== 200 && create.status !== 201) {
    throw new Error(`n8n create failed ${create.status}: ${JSON.stringify(create.data)}`);
  }

  // n8n returns { apiKey: "..." }
  const newKey = create.data.apiKey || create.data.data?.apiKey;
  if (!newKey) throw new Error(`n8n returned no key: ${JSON.stringify(create.data)}`);

  return { newKey, expiresAt: oneYearOut };
}

// ── main ──────────────────────────────────────────────────────────────────────

exports.handler = async () => {
  const pat       = process.env.NETLIFY_PAT;
  const resendKey = process.env.RESEND_API_KEY;
  const n8nKey    = process.env.N8N_API_KEY;

  const now     = Date.now();
  const results = [];
  const actions = [];

  // ── Tracked keys with known expiry ──
  const keys = [
    { name: 'N8N_API_KEY',       token: n8nKey,                           autoRotate: true },
    { name: 'CC_ACCESS_TOKEN',   token: process.env.CC_ACCESS_TOKEN,      autoRotate: false, note: 'auto-refreshed by auto-refresh-cc-token.js' },
    // Add more JWT-based keys here as needed
  ];

  for (const k of keys) {
    if (!k.token) {
      results.push({ name: k.name, status: 'MISSING', days: null });
      continue;
    }
    const exp = decodeJwtExp(k.token);
    if (!exp) {
      results.push({ name: k.name, status: 'no-expiry', days: null });
      continue;
    }
    const days = daysLeft(exp);
    const status = days < 0 ? 'EXPIRED' : days <= 7 ? 'CRITICAL' : days <= 14 ? 'WARNING' : 'OK';
    results.push({ name: k.name, status, days, exp, autoRotate: k.autoRotate, note: k.note });
  }

  // ── Auto-rotate expiring keys ──
  for (const r of results) {
    if (!r.autoRotate || (r.days > 14 && r.days !== null)) continue;

    if (r.name === 'N8N_API_KEY' && n8nKey && pat) {
      try {
        const { newKey, expiresAt } = await rotateN8nKey(n8nKey);
        await setNetlifyEnv('N8N_API_KEY', newKey, pat);
        r.rotated = true;
        r.newExpiry = expiresAt;
        actions.push(`✅ N8N_API_KEY rotated — new expiry: ${expiresAt.split('T')[0]}`);
      } catch (err) {
        r.rotateError = err.message;
        actions.push(`❌ N8N_API_KEY rotation FAILED: ${err.message}`);
      }
    }
  }

  // ── Send alert if anything needs attention ──
  const needsAlert = results.some(r => ['EXPIRED', 'CRITICAL', 'WARNING'].includes(r.status)) || actions.length > 0;

  if (needsAlert && resendKey) {
    const rows = results.map(r => {
      const color = r.status === 'OK' ? '#22c55e' : r.status === 'WARNING' ? '#f59e0b' : '#ef4444';
      const extra = r.rotated ? ` → ROTATED (new expiry ${r.newExpiry?.split('T')[0]})` : r.rotateError ? ` → ERROR: ${r.rotateError}` : r.note ? ` (${r.note})` : '';
      return `<tr><td style="padding:6px 12px;font-family:monospace">${r.name}</td>
              <td style="padding:6px 12px;color:${color};font-weight:bold">${r.status}</td>
              <td style="padding:6px 12px">${r.days !== null ? `${r.days}d` : '—'}${extra}</td></tr>`;
    }).join('');

    const html = `<div style="background:#0A0908;padding:32px;font-family:Georgia,serif;color:#F4F0E8">
      <h2 style="color:#f59e0b;margin:0 0 16px">PropertyDNA — Key Watchdog Report</h2>
      <table style="border-collapse:collapse;width:100%;background:#1a1614;border-radius:8px">
        <thead><tr style="background:#2a2420">
          <th style="padding:8px 12px;text-align:left;color:#9ca3af">Key</th>
          <th style="padding:8px 12px;text-align:left;color:#9ca3af">Status</th>
          <th style="padding:8px 12px;text-align:left;color:#9ca3af">Details</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${actions.length ? `<p style="margin:16px 0 0;color:#6B6252">${actions.join('<br>')}</p>` : ''}
      <p style="margin:24px 0 0;color:#6B6252;font-size:13px">
        To manually check: <code>! node tools/key-status.js</code><br>
        Reference: warhorse7308
      </p>
    </div>`;

    await sendAlert('PropertyDNA Key Watchdog — Action Required', html, resendKey);
  }

  console.log('Key watchdog results:', JSON.stringify(results, null, 2));
  return { statusCode: 200, body: JSON.stringify({ results, actions }) };
};
