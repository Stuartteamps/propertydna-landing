const https = require('https');
const KEY = '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';
const LISTS = [
  '6686218e-4599-11f1-b14f-02420a320002', // Warm Prospects (44)
  '66dc9866-4599-11f1-9783-02420a320002', // PS Agents (31)
  '675d8f84-4599-11f1-93ff-02420a320002', // Celebrity Homes (29)
  '1b3508b2-4a85-11f1-8e96-02420a320003', // PS Homes (19)
  '22ba3878-4a85-11f1-849f-02420a320002', // Quincy Farm (32)
  '127ae1ba-4a85-11f1-b805-02420a320002', // Oasis Palm Desert (37)
  '2d912e00-4a85-11f1-937d-02420a320003', // El Cajon Distressed (27)
];

const SUBJECT = "Quick property intelligence question for you";

const HTML = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:30px 0;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;border:1px solid #e8e4dc;">
<tr><td style="padding:32px 40px 16px;font-size:14px;color:#1f1a15;line-height:1.7;">
<p style="margin:0 0 16px;">Hi there,</p>
<p style="margin:0 0 16px;">Hope you've been well. Quick note from my side.</p>
<p style="margin:0 0 16px;">I just finished a new property intelligence tool I've been building for my clients. For any specific address it pulls together:</p>
<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
<li>True valuation (last sale + improvements + 2025 market)</li>
<li>Permit history — every documented renovation</li>
<li>Risk profile (flood, San Andreas, fire)</li>
<li>Real comparable sales</li>
<li>5-year value trajectory</li>
</ul>
<p style="margin:0 0 16px;">Would you want me to run one on your property? It's free, takes me about 60 seconds to pull, and you'll get the full report by email.</p>
<p style="margin:0 0 24px;">Just reply "yes" or grab it yourself at the link below.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr>
<td bgcolor="#1f1a15" style="border-radius:2px;background:#1f1a15;">
<a href="https://thepropertydna.com/?ref=cc_niche_outreach&email={{contact.email}}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;text-decoration:none;letter-spacing:0.05em;">
Pull My Property Report →
</a></td></tr></table>
<p style="margin:24px 0 4px;">Daniel</p>
<p style="margin:0;font-size:12px;color:#7c6c5c;">Stuart Team · Coldwell Banker Realty · Palm Springs</p>
</td></tr>
<tr><td style="padding:16px 40px;background:#faf6ef;font-size:11px;color:#9a8671;line-height:1.6;border-top:1px solid #e8e4dc;">
<a href="[[UNSUBSCRIBE]]" style="color:#9a8671;">Unsubscribe</a> · Stuart Team · 555 S Sunrise Way · Palm Springs, CA 92264 · <a href="https://thepropertydna.com" style="color:#9a8671;">thepropertydna.com</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

const payload = JSON.stringify({
  subject: SUBJECT, html: HTML, listIds: LISTS,
  campaignName: `Specialty Lists Combined - May 15 - ${Date.now()}`,
  fromEmail: 'stuartteamps@gmail.com',
  fromName:  'Daniel Stuart | Stuart Team',
  replyTo:   'stuartteamps@gmail.com',
});
const req = https.request({
  hostname: 'thepropertydna.com', path: '/.netlify/functions/send-cc-blast',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-internal-key': KEY, 'Content-Length': Buffer.byteLength(payload) },
}, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log(d)); });
req.write(payload); req.end();
