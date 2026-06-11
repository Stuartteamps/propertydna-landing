#!/usr/bin/env node
const https = require("https");
const fs = require("fs");
const path = require("path");

const RECIPIENT = process.env.RECIPIENT || "stuartteamps@gmail.com";
const playbook = fs.readFileSync(path.join(__dirname, "PLAYBOOK.md"), "utf8");

const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · Social Media Playbook</p>
<p style="margin:10px 0 0;font-size:24px;color:#1a1a1a;font-family:Georgia,serif;">Every platform. Exact copy. Setup in 2 hours.</p>
</td></tr>
<tr><td style="padding:24px 40px 8px;">
<p style="margin:0 0 14px;font-size:14px;color:#444;line-height:1.7;">
Dan — full playbook is attached. Highlights below. Total active setup time across all 10 platforms is ~2 hours. After that, daily content effort settles at 60-90 min once routine kicks in.
</p>
<p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">
<strong>The big call:</strong> set up branded pages everywhere AND keep posting from personal. Personal = founder trust (5-10x reach on LinkedIn especially). Brand = handoff-able + ad-targetable + press-credible. They feed each other.
</p>
</td></tr>
<tr><td style="padding:8px 40px;">
<h2 style="margin:0 0 12px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:1px solid #C9A84C;padding-bottom:4px;">Universal handle strategy</h2>
<p style="margin:0 0 16px;font-size:13px;color:#444;line-height:1.7;">
Try <strong>@propertydna</strong> on every platform first. Fallbacks if taken: <code style="background:#f5f0e8;padding:1px 5px;">@propertydna.official</code>, <code style="background:#f5f0e8;padding:1px 5px;">@PropertyDNAOfficial</code>, <code style="background:#f5f0e8;padding:1px 5px;">@thepropertydna</code>.
</p>
</td></tr>
<tr><td style="padding:8px 40px;">
<h2 style="margin:0 0 12px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:1px solid #C9A84C;padding-bottom:4px;">10 platforms covered in the playbook</h2>
<ol style="margin:0;padding-left:22px;font-size:13px;color:#444;line-height:1.85;">
<li><strong>Instagram</strong> — Business account, 137-char bio, 5-slide carousel pinned</li>
<li><strong>TikTok</strong> — Business account, 80-char bio, Short #03 pinned</li>
<li><strong>YouTube</strong> — channel description, banner, channel trailer, links section</li>
<li><strong>X (Twitter)</strong> — 158-char bio, pinned tweet, 5-day post sequence</li>
<li><strong>LinkedIn Company Page</strong> — 900-char About, B2B funnel-oriented</li>
<li><strong>LinkedIn (your personal)</strong> — updated headline + 2600-char founder narrative About</li>
<li><strong>Facebook Page</strong> — credibility surface + IG auto-crosspost</li>
<li><strong>Threads</strong> — linked to IG, text-first cadence</li>
<li><strong>Reddit</strong> — u/propertydna_official, reactive strategy (the cron handles monitoring)</li>
<li><strong>Pinterest</strong> — Business account, 6 boards (luxury/checklists/architects)</li>
<li><strong>Bluesky</strong> — bonus, hedge platform — handle: propertydna.com (custom domain)</li>
</ol>
</td></tr>
<tr><td style="padding:8px 40px;">
<h2 style="margin:0 0 12px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:1px solid #C9A84C;padding-bottom:4px;">First-content per platform — already written</h2>
<p style="margin:0 0 14px;font-size:13px;color:#444;line-height:1.7;">
Every platform's first 5 posts are pre-written in the playbook. Including the pinned post, the daily cadence for week 1, and the hashtag stacks per platform.
</p>
</td></tr>
<tr><td style="padding:8px 40px;">
<h2 style="margin:0 0 12px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:1px solid #C9A84C;padding-bottom:4px;">Setup execution order (one 2-hour session)</h2>
<ol style="margin:0;padding-left:22px;font-size:13px;color:#444;line-height:1.85;">
<li>Profile photo + 5 banner variants (45 min — or I'll generate them, your call)</li>
<li>Instagram setup + first carousel (15 min)</li>
<li>TikTok setup + first Short (10 min)</li>
<li>YouTube channel + banner + about (15 min)</li>
<li>X setup + pinned post (10 min)</li>
<li>LinkedIn company page (15 min)</li>
<li>LinkedIn personal headline + about (10 min)</li>
<li>Facebook + IG auto-crosspost link (10 min)</li>
<li>Threads (auto-linked from IG, 2 min)</li>
<li>Reddit username claim (5 min)</li>
<li>Pinterest setup + 3 pins (15 min)</li>
<li>Bluesky with custom domain (10 min)</li>
</ol>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
<p style="margin:0 0 8px;font-size:13px;color:#444;font-family:Georgia,serif;font-style:italic;">"Save the humans."</p>
<p style="margin:0;font-size:12px;color:#777;">
Full playbook in attachment. Same one is in the repo at <code>tools/social-media-setup/PLAYBOOK.md</code>.<br/>
PropertyDNA · thepropertydna.com
</p>
</td></tr>
</table></td></tr></table></body></html>`;

const payload = JSON.stringify({
  from: "PropertyDNA <reports@thepropertydna.com>",
  to: RECIPIENT,
  reply_to: "stuartteamps@gmail.com",
  subject: "📱 Your social media playbook — 10 platforms, every line of copy ready",
  html,
  text: `PropertyDNA — Social Media Playbook
Every platform. Exact copy. 2-hour setup.

Big call: branded pages everywhere AND keep posting from personal.

10 platforms covered:
1. Instagram (Business, 137-char bio, 5-slide carousel pinned)
2. TikTok (Business, 80-char bio, Short #03 pinned)
3. YouTube (full channel description + banner + trailer)
4. X (158-char bio, pinned tweet)
5. LinkedIn Company Page (900-char B2B-oriented)
6. LinkedIn personal (founder narrative)
7. Facebook (IG crosspost)
8. Threads
9. Reddit (u/propertydna_official)
10. Pinterest (6 boards)
+ Bluesky bonus

Setup: ~2 hours total. Daily routine: 60-90 min once warm.

Full playbook attached.

— Save the humans.`,
  attachments: [{
    filename: "PropertyDNA-Social-Playbook.md",
    content: Buffer.from(playbook, "utf8").toString("base64"),
  }],
});

const req = https.request({
  hostname: "api.resend.com", path: "/emails", method: "POST",
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
}, (res) => {
  let raw = ""; res.on("data", c => raw += c);
  res.on("end", () => {
    try {
      const data = JSON.parse(raw);
      if (data.id) console.log(`✅ Sent. Resend ID: ${data.id}`);
      else { console.error("Failed:", data); process.exit(1); }
    } catch { console.error("Bad response:", raw); process.exit(1); }
  });
});
req.on("error", e => { console.error(e); process.exit(1); });
req.write(payload);
req.end();
