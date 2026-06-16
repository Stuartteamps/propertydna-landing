/**
 * calendar-watchdog — Catches the "social feed went stale" bug class
 * BEFORE it strikes. Runs weekly. Alerts Dan if the content calendar has
 * fewer than 10 unposted-future entries remaining.
 *
 * Schedule: [functions."calendar-watchdog"] schedule = "0 14 * * 1"
 *           (Mondays 14:00 UTC = 7 AM PDT)
 *
 * Why this exists: the buffer agent has a fallback that re-uses the
 * most recent past entry when no future entry exists. That meant
 * 2026-06-09 → 2026-06-15 served the same image every day to every
 * channel. This watchdog prevents that recurring failure mode.
 *
 * Action recommended in the alert: re-run the local generator or kick
 * off the seo-content/gen-calendar.ts to extend.
 */
const https = require("https");

const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const SENDER      = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const REPO_PATH   = "Stuartteamps/propertydna-landing";
const CAL_PATH    = "tools/browser-agent/data/content-calendar.json";

const WARN_THRESHOLD = 10;   // alert if fewer than N future entries
const CRITICAL_THRESHOLD = 4; // urgent alert if fewer than N

function ghGet(path) {
  return new Promise((resolve) => {
    https.get({
      hostname: "api.github.com", path,
      headers: { "User-Agent": "PropertyDNA-Watchdog/1.0", Accept: "application/vnd.github.raw" },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => resolve(raw));
    }).on("error", () => resolve(null))
      .setTimeout(8000, () => resolve(null));
  });
}

function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0 });
  const payload = JSON.stringify({ from: `PropertyDNA <${SENDER}>`, to, reply_to: "stuartteamps@gmail.com", subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode }); } });
    });
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0 }); });
    req.write(payload);
    req.end();
  });
}

exports.handler = async () => {
  const raw = await ghGet(`/repos/${REPO_PATH}/contents/${CAL_PATH}`);
  let calendar;
  try { calendar = JSON.parse(raw); } catch {
    return { statusCode: 200, body: JSON.stringify({ status: "ok", note: "could_not_parse_calendar" }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const posts = Array.isArray(calendar.posts) ? calendar.posts : [];
  const futurePosts = posts.filter(p => p.date >= today);
  const lastDate = posts.map(p => p.date).sort().slice(-1)[0] || "—";
  const remaining = futurePosts.length;

  // Also detect the "same image repeating" pattern in the last 7 days
  const last7 = posts.filter(p => p.date <= today && p.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10));
  const imagesInLast7 = last7.map(p => p.image).filter(Boolean);
  const uniqueImages = new Set(imagesInLast7).size;
  const repeatedImagePattern = imagesInLast7.length >= 4 && uniqueImages <= 2;

  let level = "ok";
  if (remaining < CRITICAL_THRESHOLD) level = "critical";
  else if (remaining < WARN_THRESHOLD) level = "warn";
  if (repeatedImagePattern) level = "critical";

  if (level === "ok") {
    return { statusCode: 200, body: JSON.stringify({ status: "ok", remaining, last_date: lastDate }) };
  }

  const subject = level === "critical"
    ? `🚨 Social calendar URGENT — only ${remaining} future posts (last date ${lastDate})`
    : `⚠️ Social calendar low — ${remaining} future posts (last date ${lastDate})`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0908;color:#F4F0E8;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#12100d;border:1px solid rgba(255,255,255,0.08);">
<tr><td style="padding:24px 32px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
<p style="margin:0;font-size:10px;color:${level === 'critical' ? '#ff4444' : '#ff8800'};letter-spacing:3px;text-transform:uppercase;">${level === 'critical' ? '🚨 Calendar critical' : '⚠️ Calendar low'}</p>
<p style="margin:8px 0 0;font-size:22px;color:#F4F0E8;font-family:Georgia,serif;">Social posts about to go stale</p>
</td></tr>
<tr><td style="padding:24px 32px;">
<p style="margin:0 0 16px;font-size:14px;color:rgba(244,240,232,0.8);line-height:1.7;">
The Buffer agent reads from <code style="background:rgba(255,255,255,0.06);padding:1px 5px;font-size:12px;color:#C9A84C;">tools/browser-agent/data/content-calendar.json</code>. When it runs out of future entries, it falls back to the most-recent past entry — which is how we ended up showing the same image + copy for 6 days straight in mid-June.
</p>
<p style="margin:0 0 6px;font-size:13px;color:rgba(244,240,232,0.6);">Remaining future entries:</p>
<p style="margin:0 0 16px;font-size:28px;color:#C9A84C;font-family:Georgia,serif;">${remaining}</p>
<p style="margin:0 0 6px;font-size:13px;color:rgba(244,240,232,0.6);">Last scheduled date:</p>
<p style="margin:0 0 16px;font-size:18px;color:#F4F0E8;font-family:Georgia,serif;">${lastDate}</p>
${repeatedImagePattern ? `<p style="margin:0 0 16px;font-size:13px;color:#ff4444;line-height:1.7;border-left:3px solid #ff4444;padding-left:14px;">Detected pattern: last 7 days served only ${uniqueImages} unique image(s) across ${imagesInLast7.length} posts. Likely fallback-replay issue.</p>` : ''}
<p style="margin:18px 0 8px;font-size:11px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">To fix</p>
<p style="margin:0 0 8px;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
Re-run the generator locally:
</p>
<p style="margin:0 0 12px;padding:10px 14px;background:#0a0908;border:1px solid rgba(255,255,255,0.06);font-family:monospace;font-size:12px;color:#C9A84C;">
python3 tools/browser-agent/scripts/extend-calendar.py --days 30
</p>
<p style="margin:0;font-size:12px;color:rgba(244,240,232,0.5);line-height:1.7;">
Or hit reply to this email and Claude will run it autonomously.
</p>
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.08);background:#0a0908;text-align:center;font-size:10px;color:rgba(244,240,232,0.4);">PropertyDNA · Calendar watchdog</td></tr>
</table></td></tr></table></body></html>`;

  await sendEmail({
    to: OWNER_EMAIL,
    subject,
    html,
    text: `Calendar ${level}: ${remaining} future entries, last date ${lastDate}.\n\nRe-run generator:\n  python3 tools/browser-agent/scripts/extend-calendar.py --days 30`,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ status: level, remaining, last_date: lastDate, repeated_image_pattern: repeatedImagePattern }),
  };
};
