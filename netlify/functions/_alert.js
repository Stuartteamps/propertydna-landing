// _alert.js — shared alert helper for autonomous pipelines.
// Sends a clearly-labeled alert email to the platform owner via Resend.
// Returns { ok, status } so callers can branch but never throw on alert failures.

const https = require('https');

const ALERT_TO     = process.env.OWNER_EMAIL  || 'stuartteamps@gmail.com';
const ALERT_FROM   = process.env.ALERT_SENDER_EMAIL || 'alerts@mail.thepropertydna.com';
const ALERT_NAME   = 'PropertyDNA Alerts';
const SITE         = 'https://thepropertydna.com';

function send({ subject, body, level = 'info', context = {} }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ ok: false, reason: 'RESEND_API_KEY missing' });

  const color = level === 'critical' ? '#dc2626' : level === 'warn' ? '#f59e0b' : '#16a34a';
  const ts    = new Date().toISOString();

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0A0908;color:#F4F0E8;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0908;padding:32px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0F0E0D;border:1px solid #1f1a15">
<tr><td style="padding:20px 30px;border-bottom:2px solid ${color}">
  <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${color}">PropertyDNA · ${level.toUpperCase()}</p>
  <p style="margin:4px 0 0;font-family:Georgia,serif;font-size:22px;color:#F4F0E8">${subject}</p>
</td></tr>
<tr><td style="padding:24px 30px;color:#C7BFA9;font-size:14px;line-height:1.7">${body}</td></tr>
<tr><td style="padding:0 30px 24px">
  <pre style="background:#1A1714;padding:14px;font-size:11px;color:#7c6c5c;border-left:2px solid ${color};white-space:pre-wrap;word-break:break-all;margin:0">${JSON.stringify(context, null, 2)}</pre>
</td></tr>
<tr><td style="padding:16px 30px;border-top:1px solid #1f1a15;font-size:11px;color:#7c6c5c">
  ${ts} · <a href="${SITE}" style="color:#7c6c5c">thepropertydna.com</a>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${level.toUpperCase()}: ${subject}\n\n${body.replace(/<[^>]+>/g, '')}\n\nContext:\n${JSON.stringify(context, null, 2)}\n\n${ts}`;

  const payload = JSON.stringify({
    from:      `${ALERT_NAME} <${ALERT_FROM}>`,
    to:        ALERT_TO,
    subject:   `[${level.toUpperCase()}] ${subject}`,
    html,
    text,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ ok: res.statusCode < 300, status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ ok: res.statusCode < 300, status: res.statusCode }); } });
    });
    req.on('error', (e) => resolve({ ok: false, reason: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.write(payload);
    req.end();
  });
}

module.exports = { send };
