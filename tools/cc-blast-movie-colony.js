#!/usr/bin/env node
// CC blast — Movie Colony Occupied (homeowner-specific angle)
const https = require('https');
const KEY = process.env.INTERNAL_API_KEY || '271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977';
const LIST = '2aa88bbc-4a84-11f1-93bd-02420a320003'; // Movie Colony Occupied

const SUBJECT = "Movie Colony homeowners — your home's hidden value";

const HTML = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;color:#2c241d;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:30px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;border:1px solid #e8e4dc;">

<tr><td style="padding:32px 40px 16px;font-size:14px;color:#1f1a15;line-height:1.7;">
<p style="margin:0 0 16px;">Hi there,</p>

<p style="margin:0 0 16px;">As a Movie Colony homeowner, you already know the neighborhood story — but the data behind your specific home's current value rarely gets surfaced unless you list.</p>

<p style="margin:0 0 16px;">I've been running a new analysis tool for Palm Springs properties that pulls together:</p>

<ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
<li><strong>True market valuation</strong> — last sale + improvements + 2025 appreciation</li>
<li><strong>Permit history</strong> — every renovation tracked back to original construction</li>
<li><strong>San Andreas + flood + fire risk profile</strong> for your specific parcel</li>
<li><strong>Movie Colony comparable sales</strong> — only those within walking distance</li>
<li><strong>5-year value trajectory</strong> based on neighborhood-specific velocity</li>
</ul>

<p style="margin:0 0 16px;">I can run one on your property today — no cost, no obligation. Just curious if you want to see where your home actually stands right now.</p>

<p style="margin:0 0 24px;">Reply "yes" and I'll send the full report back, or use the link below to pull it yourself in 60 seconds.</p>

<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr>
<td bgcolor="#1f1a15" style="border-radius:2px;background:#1f1a15;">
<a href="https://thepropertydna.com/?ref=cc_movie_colony_owner&email={{contact.email}}&firstName=there" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;text-decoration:none;letter-spacing:0.05em;">
Pull My Movie Colony Report →
</a>
</td>
</tr></table>

<p style="margin:24px 0 4px;">Daniel</p>
<p style="margin:0;font-size:12px;color:#7c6c5c;">Stuart Team · Coldwell Banker Realty · Palm Springs</p>
</td></tr>

<tr><td style="padding:16px 40px;background:#faf6ef;font-size:11px;color:#9a8671;line-height:1.6;border-top:1px solid #e8e4dc;">
You're receiving this because you own property in the Movie Colony. <a href="[[UNSUBSCRIBE]]" style="color:#9a8671;">Unsubscribe</a>.<br>
Stuart Team · 555 S Sunrise Way · Palm Springs, CA 92264 · <a href="https://thepropertydna.com" style="color:#9a8671;">thepropertydna.com</a>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;

const payload = JSON.stringify({
  subject: SUBJECT, html: HTML, listIds: [LIST],
  campaignName: `Movie Colony Owner Outreach - May 15 - ${Date.now()}`,
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
