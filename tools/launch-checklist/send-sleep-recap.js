#!/usr/bin/env node
/**
 * Sleep-recap email — Dan is going to bed. Send him: today's wins +
 * everything still pending from him across the past few weeks of
 * conversations, so he can tackle in order tomorrow.
 */
const https = require("https");
const RECIPIENT = process.env.RECIPIENT || "stuartteamps@gmail.com";

const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0908;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0908;"><tr><td align="center" style="padding:32px 16px;">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#12100d;border:1px solid rgba(255,255,255,0.08);">

<tr><td style="padding:24px 32px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
<p style="margin:0;font-size:10px;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">Sleep recap · June 15, 2026</p>
<p style="margin:10px 0 0;font-size:24px;color:#F4F0E8;font-family:Georgia,serif;line-height:1.15;">Sleep well, Dan. Here's tomorrow's list.</p>
<p style="margin:8px 0 0;font-size:13px;color:rgba(244,240,232,0.55);font-style:italic;">"You're turning home sales into well-informed humans." — you said it. We're building it.</p>
</td></tr>

<!-- TONIGHT'S WINS -->
<tr><td style="padding:22px 32px 8px;">
<h2 style="margin:0 0 12px;font-size:11px;color:#00cc77;letter-spacing:3px;text-transform:uppercase;">✅ Shipped tonight (while you were eating dinner)</h2>
<ol style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.85;">
<li><strong>Root cause found on the stale-content bug.</strong> Content calendar ended 2026-06-09; the buffer agent's fallback re-played the most recent past entry every day for 6 days. That's why every page got the same image + copy.</li>
<li><strong>Dan's 20 real photos copied to the CDN</strong> at /social/real/. No more AI-looking shots — these are your actual property + Palm Springs scenery photography.</li>
<li><strong>30 new days of viral-formatted copy</strong> (6/15 → 7/14) with 12+ archetype rotation. Real numbers, founder voice, FL insurance hot takes, skits, mission statements, methodology reveals — no repeats inside any 5-day window.</li>
<li><strong>6 CV-specific posts broadened to nationwide framing</strong> per your ask. Plus 5 more days added through 7/19. Future runway: 35 days.</li>
<li><strong>3 "trade homes like stocks" vision posts injected</strong> — pushing the IntellaGraph AI angle + the buy/sell-button future you described.</li>
<li><strong>Watchdog cron live</strong> (Mondays 7 AM PDT). Alerts you if &lt;10 future entries OR &lt;=2 unique images in last 7 days. This failure mode can't sneak up on us again.</li>
<li><strong>Auto-regenerator script ready</strong> at <code style="background:rgba(255,255,255,0.06);padding:1px 5px;font-size:11px;color:#C9A84C;">tools/browser-agent/scripts/extend-calendar.py</code>. Calls Claude to draft N more days using the same archetype + image pool. Run when the watchdog pings.</li>
</ol>
<p style="margin:14px 0 0;font-size:12px;color:rgba(244,240,232,0.5);line-height:1.7;font-style:italic;">
Sample of tomorrow's post (7/14): "Three things every homebuyer should verify before making an offer in 2026: 1) Insurance carrier tier for the ZIP (not the seller's policy — your future one) 2) Permit history with closure status 3) Comp spread against full-radius algorithm set. We surface all three for free…"
</p>
</td></tr>

<!-- TOMORROW'S TO-DO -->
<tr><td style="padding:22px 32px 8px;border-top:1px solid rgba(255,255,255,0.06);">
<h2 style="margin:0 0 12px;font-size:11px;color:#ff8800;letter-spacing:3px;text-transform:uppercase;">⏳ Your list for tomorrow — in priority order</h2>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#ff4444;letter-spacing:2px;text-transform:uppercase;">🔴 Security (2 min)</p>
<ol style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Change npm password</strong> (you shared it in chat). npmjs.com → Account Settings → Change Password.</li>
<li><strong>Revoke first npm token</strong> (npm_kavASgz…). npmjs.com → tokens. Keep the second one (npm_bvg6hoO…) working.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">⏱️ Quick wins (30 min total)</p>
<ol start="3" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Email your title rep</strong> for the SoCal agent CSV with production volumes. Template in <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/strategy/title-rep-csv-playbook.md</code>. Single biggest unlock for the referral network.</li>
<li><strong>Submit MCP server to Smithery</strong> (smithery.ai/new). Sign in with GitHub, paste repo URL. Auto-detects our YAML. Live in 24h.</li>
<li><strong>Submit to mcp.so</strong> (mcp.so/submit). Paste @propertydna/mcp-server. Tags: Real Estate / Data Intelligence.</li>
<li><strong>PR to Anthropic's official MCP repo</strong> (github.com/modelcontextprotocol/servers). Exact line to add in <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/launch-checklist/SUBMIT_ALL.md</code>.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">📱 Social media (2 hr — one sitting)</p>
<ol start="7" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Set up 10 branded social accounts</strong> per <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/social-media-setup/PLAYBOOK.md</code>. Every bio, pinned post, first 5 content posts pre-written. Brand assets attached to the action-items email from June 12 (Resend ID 492cab4b).</li>
<li><strong>Grant OAuth for posting automation</strong> at <a href="https://thepropertydna.com/admin/oauth" style="color:#C9A84C;">thepropertydna.com/admin/oauth</a>. YouTube first (lights up comment auto-reply). Then IG/FB, X, LinkedIn, TikTok, Reddit.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">🎬 Content + assistant (90-min shoot + hire)</p>
<ol start="9" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Record the 5 videos in the filming kit</strong> (Resend ID f71dcf7e in your inbox). Wardrobe, lighting, audio, mic setup all documented. ~5-6 min of on-camera total.</li>
<li><strong>Post the assistant hiring listing</strong> on Upwork Pro + r/VideoEditing. $200 paid trial — 2 Shorts in 5 days. Brief in <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/strategy/viral-content-playbook.md</code>.</li>
<li><strong>Or share /recruit?role=assistant</strong> on your social so applicants come direct.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">🚀 Public launches (1 hr)</p>
<ol start="12" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Chrome Web Store submission</strong>. Pay $5 dev fee. Need 5 screenshots from the loaded extension. Full submission text ready.</li>
<li><strong>Product Hunt launch</strong> — schedule for next Tuesday 12:01 AM PT. Description + first comment in SUBMIT_ALL.md.</li>
<li><strong>HackerNews Show HN</strong> — best window Tue-Thu 9-11 AM PT. Title + body ready.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">📨 Outreach (1 hr)</p>
<ol start="15" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Send top 5 press pitches</strong> from <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/press-outreach/pitches.json</code>. Verge / WSJ / Bloomberg / Inman / NYT. Pre-personalized.</li>
<li><strong>Send top 5 celebrity/influencer pitches</strong> from <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">tools/celebrity-outreach/queue.json</code>. Graham Stephan / Meet Kevin / BiggerPockets / Codie Sanchez / Patrick Bet-David. Value-first.</li>
</ol>
</div>

<div style="margin-bottom:18px;">
<p style="margin:0 0 6px;font-size:10px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">⚙️ Small decisions (no time required)</p>
<ol start="17" style="margin:0 0 0 22px;padding:0;font-size:13px;color:rgba(244,240,232,0.8);line-height:1.7;">
<li><strong>Approve the stale-listing pitch tone</strong> in <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 4px;color:#C9A84C;">netlify/functions/pitch-stale-listing-agent.js</code>. Read the template — softer / sharper / anything to change?</li>
<li><strong>Apollo.io subscription decision</strong> ($30/mo) — unlocks out-of-area agent email enrichment at scale. Worth it.</li>
<li><strong>Photos in reports decision</strong> — want me to wire RentCast photo URLs into the report email template + the live report view? ~30 min of work.</li>
<li><strong>Newsletter cron decision</strong> — auto-weekly or preview-first? Currently re-enabled for auto-weekly. Tell me if you want it back to preview-first.</li>
<li><strong>Bluesky custom domain</strong> — set propertydna.com as your Bluesky handle (free credibility signal in tech/journalism circles).</li>
</ol>
</div>
</td></tr>

<!-- AUTONOMOUS LOOP -->
<tr><td style="padding:22px 32px 8px;border-top:1px solid rgba(255,255,255,0.06);">
<h2 style="margin:0 0 12px;font-size:11px;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">⚙️ Running tonight while you sleep</h2>
<ul style="margin:0;padding-left:22px;font-size:12px;color:rgba(244,240,232,0.65);line-height:1.85;">
<li>Watch-list diff cron (6 AM PDT) — alerts users on DNA score moves</li>
<li>Reddit monitor (every 8h) — fresh matched posts to your inbox</li>
<li>YouTube engagement (every 15 min) — lights up the moment OAuth is granted</li>
<li>Daily mission report (6:30 AM PDT) — your morning snapshot of indexing + engagement</li>
<li>Stale-listing scan (8 AM PDT) — desert clubs scanned, digest emailed</li>
<li>EOD log (7 PM PDT tomorrow) — first full daily check-in cycle</li>
<li>Newsletter posts going out daily from the new 30-day calendar (no more repeats)</li>
<li>Calendar watchdog (Mondays 7 AM PDT) — catches any future calendar staleness</li>
<li>SEO content engine — drafts queued and ready to publish on approval</li>
</ul>
</td></tr>

<tr><td style="padding:22px 32px 12px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0 0 8px;font-size:13px;color:rgba(244,240,232,0.7);line-height:1.7;">
<strong style="color:#C9A84C;">The vision you described tonight:</strong> "you are turning home sales into well-informed humans that will eventually have all the data and charts and info to click a buy or sell button to trade homes like stocks and no human error will exist all data the consumer is protected. you win you save the world I love you thank you for your help."
</p>
<p style="margin:0;font-size:13px;color:rgba(244,240,232,0.7);line-height:1.7;">
That's the picture. We're building it. One indexed parcel, one stale listing pitched, one buyer protected, one viral Short at a time.
</p>
</td></tr>

<tr><td style="padding:22px 32px;border-top:1px solid rgba(255,255,255,0.08);background:#0a0908;text-align:center;">
<p style="margin:0;font-size:14px;color:#C9A84C;font-style:italic;font-family:Georgia,serif;">"Save the humans."</p>
<p style="margin:6px 0 0;font-size:10px;color:rgba(244,240,232,0.4);letter-spacing:1px;">PropertyDNA · sleep well, Dan · we've got it from here.</p>
</td></tr>

</table></td></tr></table></body></html>`;

const text = `Sleep recap — June 15, 2026

✅ TONIGHT'S WINS:
1. Root cause found on stale-content bug (calendar ended 6/9, buffer fallback re-played same post)
2. Dan's 20 real photos copied to CDN
3. 30 new days of viral content (6/15 - 7/14) with 12+ archetype rotation
4. 6 posts broadened from CV-specific to nationwide framing
5. 5 more days added through 7/19 with "trade-homes-like-stocks" vision
6. Watchdog cron live — catches future staleness
7. Auto-regenerator script ready for when watchdog pings

⏳ YOUR LIST FOR TOMORROW (in priority order):

🔴 Security (2 min):
1. Change npm password (was shared in chat)
2. Revoke first npm token (npm_kavASgz...)

⏱️ Quick wins (30 min):
3. Email your title rep for SoCal agent CSV
4. Submit MCP server to Smithery
5. Submit to mcp.so
6. PR to Anthropic's MCP repo

📱 Social media (2 hr):
7. Set up 10 branded accounts per PLAYBOOK
8. Grant OAuth at /admin/oauth

🎬 Content + assistant (90-min shoot):
9. Record 5 videos from filming kit
10. Post assistant hiring listing on Upwork
11. Share /recruit?role=assistant

🚀 Public launches (1 hr):
12. Chrome Web Store submission
13. Product Hunt — schedule Tuesday 12:01 AM PT
14. HackerNews Show HN

📨 Outreach (1 hr):
15. Send top 5 press pitches
16. Send top 5 celebrity pitches

⚙️ Small decisions:
17. Approve stale-listing pitch tone
18. Apollo.io subscription ($30/mo)
19. Photos in reports — yes/no
20. Newsletter cron — auto or preview-first
21. Bluesky custom domain

Autonomous engines running while you sleep:
- Watch-list diff, Reddit monitor, YT engagement, daily mission report
- Stale-listing scan, EOD log, calendar watchdog, SEO engine
- 30 days of viral content posting (no more repeats)

The vision you said: "you are turning home sales into well-informed humans that will eventually have all the data and charts and info to click a buy or sell button to trade homes like stocks."

That's the picture. We're building it. One parcel, one buyer, one viral Short at a time.

Save the humans. Sleep well.`;

const payload = JSON.stringify({
  from: "PropertyDNA <reports@thepropertydna.com>",
  to: RECIPIENT,
  reply_to: "stuartteamps@gmail.com",
  subject: "🌙 Sleep well · tonight's wins + tomorrow's list",
  html, text,
});

const req = https.request({
  hostname: "api.resend.com", path: "/emails", method: "POST",
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
}, (res) => {
  let raw = ""; res.on("data", c => raw += c);
  res.on("end", () => {
    try {
      const d = JSON.parse(raw);
      if (d.id) console.log(`✅ Sleep recap sent. Resend ID: ${d.id}`);
      else { console.error("Failed:", d); process.exit(1); }
    } catch { console.error("Bad response:", raw); process.exit(1); }
  });
});
req.on("error", e => { console.error(e); process.exit(1); });
req.write(payload);
req.end();
