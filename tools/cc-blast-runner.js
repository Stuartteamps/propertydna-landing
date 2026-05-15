#!/usr/bin/env node
/**
 * CC programmatic blast runner — focused report-CTA campaign
 *
 * Sends through Constant Contact (proven inbox-grade) instead of Resend
 * (burned reputation). Target: 550 contacts in 'PropertyDNA — All Contacts'.
 *
 * Usage:
 *   node tools/cc-blast-runner.js dry    → print preview only
 *   node tools/cc-blast-runner.js send   → actually fire
 */

const https = require('https');

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';
const LIST_ALL_CONTACTS = '662ac8de-4599-11f1-8c5f-02420a320003';

const SUBJECT = "Your Coachella Valley property — quick intelligence report?";

const HTML = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:30px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;border:1px solid #e8e4dc;">

<tr><td style="padding:32px 40px 16px;font-size:14px;color:#1f1a15;line-height:1.7;">
<p style="margin:0 0 16px;">Hi {{contact.first_name}},</p>

<p style="margin:0 0 16px;">Hope you've been well. Quick note from my side.</p>

<p style="margin:0 0 16px;">I just finished building a property intelligence tool I've been using internally with my clients — it pulls together the kind of detailed analysis I'd normally only have time to do on an active deal: <strong>permit history</strong>, <strong>true valuation</strong> (last sale + improvements + current market), <strong>risk profile</strong> (flood, San Andreas, fire), and the <strong>comparable sales</strong> I'd actually use if I were listing your home.</p>

<p style="margin:0 0 16px;">Would you want me to run one on your Coachella Valley property? It's free, takes about 60 seconds for me to pull, and you'll get the full report by email.</p>

<p style="margin:0 0 24px;">Just hit reply with "yes" — or grab it yourself in 60 seconds at the link below.</p>

<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr>
<td bgcolor="#1f1a15" style="border-radius:2px;background:#1f1a15;">
<a href="https://thepropertydna.com/?ref=cc_personal_outreach_may15&email={{contact.email}}&firstName={{contact.first_name}}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;text-decoration:none;letter-spacing:0.05em;">
Pull My Free Report →
</a>
</td>
</tr></table>

<p style="margin:24px 0 8px;">Either way, hope you're enjoying the desert.</p>

<p style="margin:0 0 4px;">Daniel</p>
<p style="margin:0;font-size:12px;color:#7c6c5c;">Stuart Team · Coldwell Banker Realty · Palm Springs</p>
</td></tr>

<tr><td style="padding:16px 40px;background:#faf6ef;font-size:11px;color:#9a8671;line-height:1.6;border-top:1px solid #e8e4dc;">
You're receiving this because you've been in touch with the Stuart Team. If you'd like to stop hearing from me, <a href="[[UNSUBSCRIBE]]" style="color:#9a8671;">unsubscribe here</a>.<br>
Stuart Team · 555 S Sunrise Way · Palm Springs, CA 92264 · <a href="https://thepropertydna.com" style="color:#9a8671;">thepropertydna.com</a>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

function post(host, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname: host, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers, 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let r = ''; res.on('data', c => r += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(r) }); } catch { resolve({ s: res.statusCode, d: r }); } });
    });
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

async function main() {
  const mode = (process.argv[2] || 'dry').toLowerCase();
  console.log(`\n=== CC Programmatic Blast (${mode.toUpperCase()}) ===\n`);
  console.log(`Subject:   ${SUBJECT}`);
  console.log(`Target:    PropertyDNA — All Contacts (~550 warm)`);
  console.log(`Channel:   Constant Contact (proven inbox-grade)`);
  console.log(`HTML size: ${HTML.length} chars`);
  console.log(`\n--- Body preview (first 600 chars) ---\n${HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600)}\n`);

  if (mode === 'dry') {
    console.log('Dry run only. Run with "send" to actually fire.\n');
    return;
  }

  console.log('Creating + scheduling CC campaign...\n');
  const res = await post('thepropertydna.com', '/.netlify/functions/send-cc-blast', {
    subject: SUBJECT,
    html: HTML,
    listIds: [LIST_ALL_CONTACTS],
    campaignName: `PropertyDNA Personal Outreach - May 15 - ${Date.now()}`,
    fromEmail: 'stuartteamps@gmail.com',         // CC-verified sender
    fromName:  'Daniel Stuart | Stuart Team',
    replyTo:   'stuartteamps@gmail.com',
  }, { 'x-internal-key': INTERNAL_KEY });

  console.log('Result:', JSON.stringify(res.d, null, 2));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
