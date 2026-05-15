/**
 * dossier-request-notify — sends Dan an email when someone submits a dossier request
 * via the modal on /dossier/:apn or /luxury-inventory.
 *
 * Body: { apn?, propertyAddress?, name?, email, phone?, role?, message?, pedigreeTier?, sourcePage }
 */

const https = require('https');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM = 'PropertyDNA Leads <leads@mail.thepropertydna.com>';
const TO   = 'stuartteamps@gmail.com';

function send(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const r = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, d }));
    });
    r.on('error', reject);
    r.write(body); r.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!RESEND_KEY) return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no_resend_key' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const subject = `[Lead] Luxury Dossier — ${body.propertyAddress || body.email}${body.pedigreeTier ? ` (${body.pedigreeTier}-tier)` : ''}`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:580px;color:#111;">
      <h2 style="color:#0a0a0a;border-bottom:2px solid #fbbf24;padding-bottom:8px;">Luxury Dossier Request</h2>
      <table style="font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6;border-collapse:collapse;">
        ${row('Property', body.propertyAddress || '—')}
        ${row('APN', body.apn || '—')}
        ${row('Pedigree tier', body.pedigreeTier || '—')}
        ${row('Source page', body.sourcePage || '—')}
        ${row('Name', body.name || '—')}
        ${row('Email', `<a href="mailto:${body.email}">${body.email}</a>`)}
        ${row('Phone', body.phone || '—')}
        ${row('Role', body.role || '—')}
        ${row('Message', body.message || '—')}
      </table>
    </div>`;

  const text = [
    'Luxury Dossier Request',
    '',
    `Property: ${body.propertyAddress || '—'}`,
    `APN: ${body.apn || '—'}`,
    `Pedigree tier: ${body.pedigreeTier || '—'}`,
    `Source: ${body.sourcePage || '—'}`,
    `Name: ${body.name || '—'}`,
    `Email: ${body.email}`,
    `Phone: ${body.phone || '—'}`,
    `Role: ${body.role || '—'}`,
    `Message: ${body.message || '—'}`,
  ].join('\n');

  const r = await send({ from: FROM, to: TO, subject, html, text, reply_to: body.email });
  return { statusCode: 200, body: JSON.stringify({ ok: r.s < 300, status: r.s }) };
};

function row(label, val) {
  return `<tr><td style="padding:6px 16px 6px 0;color:#475569;width:130px;">${label}</td><td style="padding:6px 0;color:#0f172a;">${val}</td></tr>`;
}
