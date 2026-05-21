/**
 * weekly-mls-reminder — Wednesday 8 AM PT.
 * Emails Dan a reminder to update the 3 FlexMLS share links in Supabase
 * before Thursday's 4:20 PM newsletter cron fires.
 * Includes current links so he can see what's stale and the exact PATCH
 * curl to update them.
 */
const https = require('https');
const db    = require('./_supabase');

const TO      = 'stuartteamps@gmail.com';
const FROM    = 'PropertyDNA <reports@thepropertydna.com>';
const SUPA_ID = '784437c8-12f8-470b-bb0b-ccf5ec9c0a4a';

function post(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, method: 'POST', headers }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

exports.handler = async () => {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { statusCode: 500, body: 'RESEND_API_KEY missing' };

  let current = null;
  try {
    const rows = await db.from('newsletter_links').select('west_valley_new,east_valley_new,recently_sold,notes,updated_at').eq('id', 1).limit(1).get();
    current = rows?.[0] || null;
  } catch { /* fall through */ }

  const wv     = current?.west_valley_new || '(not set)';
  const ev     = current?.east_valley_new || '(not set)';
  const sold   = current?.recently_sold   || '(not set)';
  const notes  = current?.notes  || '(no notes)';
  const stamp  = current?.updated_at ? new Date(current.updated_at).toISOString().slice(0, 10) : '(unknown)';

  const subject = `Wednesday — update MLS links for tomorrow's newsletter`;

  const html = `<div style="font-family:Georgia,serif;background:#fcfaf7;padding:32px;color:#2c241d;max-width:640px;margin:0 auto">
<h2 style="margin:0 0 12px;font-size:24px">Update Thursday's MLS share links</h2>
<p style="font-size:15px;line-height:1.7;color:#5a4e3f;margin:0 0 24px">
Tomorrow at 4:20 PM PT the weekly newsletter goes out. Update the 3 FlexMLS
share links below by 5 PM today so the cron picks them up. Last updated: <strong>${stamp}</strong>.
</p>

<h3 style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#9a8671;margin:24px 0 8px">Current links</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<tr><td style="padding:8px 0;color:#9a8671;width:160px">West Valley new</td><td style="padding:8px 0;word-break:break-all"><a href="${wv}" style="color:#1f1a15">${wv}</a></td></tr>
<tr><td style="padding:8px 0;color:#9a8671">East Valley new</td><td style="padding:8px 0;word-break:break-all"><a href="${ev}" style="color:#1f1a15">${ev}</a></td></tr>
<tr><td style="padding:8px 0;color:#9a8671">Recently sold</td><td style="padding:8px 0;word-break:break-all"><a href="${sold}" style="color:#1f1a15">${sold}</a></td></tr>
<tr><td style="padding:8px 0;color:#9a8671">Notes</td><td style="padding:8px 0;color:#5a4e3f">${notes}</td></tr>
</table>

<h3 style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#9a8671;margin:32px 0 8px">How to update</h3>
<p style="font-size:14px;line-height:1.7;margin:0 0 12px">Reply to this email with the 3 new FlexMLS share URLs and Claude will patch Supabase for you. Or paste them in chat with this format:</p>
<pre style="background:#f4ede4;padding:14px;font-size:12px;font-family:Menlo,monospace;border-radius:4px;line-height:1.6;white-space:pre-wrap">West Valley:  https://www.flexmls.com/share/XXXXX/Selected
East Valley:  https://www.flexmls.com/share/XXXXX/Selected
Recently sold: https://www.flexmls.com/share/XXXXX/Selected</pre>

<p style="font-size:13px;line-height:1.7;color:#7c6c5c;margin-top:32px">
Thursday 8 AM PT — the remote pre-flight agent runs to verify CC token + send.<br>
Thursday 4:20 PM PT — newsletter fires to PropertyDNA — All Contacts.<br>
Friday 9 AM PT — post-flight verifies the send actually went out.
</p>
</div>`;

  const body = JSON.stringify({ from: FROM, to: [TO], subject, html });
  const res  = await post('api.resend.com', '/emails', {
    Authorization:  `Bearer ${resendKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }, body);

  console.log('[weekly-mls-reminder]', res.status, JSON.stringify(res.data).slice(0, 200));
  return { statusCode: 200, body: JSON.stringify({ ok: res.status < 300, resendStatus: res.status }) };
};
