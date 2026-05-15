const https = require('https');
const KEY = '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';
const LIST = '8eb0a39c-4a84-11f1-bc92-02420a320002'; // Movie Colony Absentee

const SUBJECT = "What your Palm Springs home would sell for today";

const HTML = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:30px 0;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;border:1px solid #e8e4dc;">
<tr><td style="padding:32px 40px 16px;font-size:14px;color:#1f1a15;line-height:1.7;">
<p style="margin:0 0 16px;">Hi there,</p>

<p style="margin:0 0 16px;">As an out-of-area owner of a Palm Springs Movie Colony property, you probably get a lot of "let's chat about your home" emails. This isn't that.</p>

<p style="margin:0 0 16px;">I just built a tool that pulls together — for any specific Palm Springs property — the kind of detailed market intelligence you'd normally only get from a full listing prep:</p>

<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
<li><strong>Current market value</strong> (your last sale + improvements + 2025 appreciation)</li>
<li><strong>Permit history</strong> — what's been documented on your property</li>
<li><strong>Movie Colony-specific comps</strong> within walking distance</li>
<li><strong>Risk profile</strong> — flood, San Andreas, fire (relevant for insurance)</li>
<li><strong>STR demand score</strong> for short-term rental potential</li>
</ul>

<p style="margin:0 0 16px;">Just curious if you'd want me to run one on your property — purely informational, no listing pitch, no obligation.</p>

<p style="margin:0 0 24px;">Reply "yes" or use the link below.</p>

<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr>
<td bgcolor="#1f1a15" style="border-radius:2px;background:#1f1a15;">
<a href="https://thepropertydna.com/analyze?ref=cc_movie_absentee&email={{contact.email}}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;text-decoration:none;letter-spacing:0.05em;">
Pull My Property Report →
</a>
</td></tr></table>

<p style="margin:24px 0 4px;">Daniel</p>
<p style="margin:0;font-size:12px;color:#7c6c5c;">Stuart Team · Coldwell Banker Realty · Palm Springs</p>
</td></tr>
<tr><td style="padding:16px 40px;background:#faf6ef;font-size:11px;color:#9a8671;line-height:1.6;border-top:1px solid #e8e4dc;">
You're receiving this as a Movie Colony property owner. <a href="[[UNSUBSCRIBE]]" style="color:#9a8671;">Unsubscribe</a>.<br>
Stuart Team · 555 S Sunrise Way · Palm Springs, CA 92264 · <a href="https://thepropertydna.com" style="color:#9a8671;">thepropertydna.com</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

const payload = JSON.stringify({
  subject: SUBJECT, html: HTML, listIds: [LIST],
  campaignName: `Movie Colony Absentee - May 15 - ${Date.now()}`,
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
