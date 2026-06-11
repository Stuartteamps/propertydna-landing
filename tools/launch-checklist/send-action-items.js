#!/usr/bin/env node
/**
 * Sends Dan a single consolidated email of EVERY action item he needs to
 * complete himself, organized by priority/urgency. Plus the brand-asset
 * ZIP as attachment.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const RECIPIENT = process.env.RECIPIENT || "stuartteamps@gmail.com";

// Attach all brand assets
const BRAND_DIR = path.resolve(__dirname, "..", "brand-assets", "out");
const attachments = fs.readdirSync(BRAND_DIR)
  .filter(f => f.endsWith(".png"))
  .map(f => ({
    filename: f,
    content: fs.readFileSync(path.join(BRAND_DIR, f)).toString("base64"),
  }));

const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="660" cellpadding="0" cellspacing="0" style="max-width:660px;background:#fff;border:1px solid #e5e0d8;">

<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · Action items</p>
<p style="margin:10px 0 0;font-size:26px;color:#1a1a1a;font-family:Georgia,serif;line-height:1.15;">Dan — everything only YOU can do</p>
<p style="margin:8px 0 0;font-size:13px;color:#777;font-style:italic;">A consolidated list from the last few days. In priority order. Brand assets attached.</p>
</td></tr>

<tr><td style="padding:24px 40px 8px;">
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.75;">
Every item below requires <strong>your</strong> hands (login / phone / OAuth grant / payment / public-facing post). I built every system. Now they need switches flipped. Total active time: ~3-4 hours across all sections.
</p>
</td></tr>

<!-- SECTION 1: TODAY (highest urgency) -->
<tr><td style="padding:8px 40px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #ff4444;padding-bottom:6px;">🔴 TODAY (security)</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">1.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Change npm password.</strong> You shared it in chat. Go to <a href="https://www.npmjs.com/settings/intellagraph/profile" style="color:#C9A84C;">npmjs.com → Account Settings → Change Password</a>. New one with 2FA stays.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">2.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Revoke first npm token.</strong> <a href="https://www.npmjs.com/settings/intellagraph/tokens" style="color:#C9A84C;">npmjs.com → tokens</a> — delete the one starting <code style="background:#f5f0e8;padding:1px 5px;">npm_kavASgz…</code>. Keep the working one (npm_bvg6hoO…).
</td></tr>
</table>
</td></tr>

<!-- SECTION 2: 30-MIN DISTRIBUTION SPRINT -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">⏱️ 30-min distribution sprint (do soon)</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:8px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">3.</td><td style="padding:8px 0;color:#444;line-height:1.7;">
<strong>Submit MCP server to Smithery</strong> (5 min) — <a href="https://smithery.ai/new" style="color:#C9A84C;">smithery.ai/new</a>. Sign in with GitHub, paste <code style="background:#f5f0e8;padding:1px 5px;">github.com/Stuartteamps/propertydna-landing</code>, auto-detects our YAML. Live in 24h.
</td></tr>
<tr><td style="padding:8px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">4.</td><td style="padding:8px 0;color:#444;line-height:1.7;">
<strong>Submit to mcp.so</strong> (3 min) — <a href="https://mcp.so/submit" style="color:#C9A84C;">mcp.so/submit</a>. Paste package: <code style="background:#f5f0e8;padding:1px 5px;">@propertydna/mcp-server</code>. Tags: Real Estate, Data Intelligence, Valuation.
</td></tr>
<tr><td style="padding:8px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">5.</td><td style="padding:8px 0;color:#444;line-height:1.7;">
<strong>PR to Anthropic's official MCP repo</strong> (10 min) — fork <a href="https://github.com/modelcontextprotocol/servers" style="color:#C9A84C;">github.com/modelcontextprotocol/servers</a>, add one line to Community Servers section. Exact line in <code style="background:#f5f0e8;padding:1px 5px;">tools/launch-checklist/SUBMIT_ALL.md</code>.
</td></tr>
<tr><td style="padding:8px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">6.</td><td style="padding:8px 0;color:#444;line-height:1.7;">
<strong>PR to awesome-mcp-servers</strong> (5 min) — fork <a href="https://github.com/punkpeye/awesome-mcp-servers" style="color:#C9A84C;">github.com/punkpeye/awesome-mcp-servers</a>, add under "🏠 Real Estate" section.
</td></tr>
</table>
</td></tr>

<!-- SECTION 3: SOCIAL MEDIA SETUP (2 hr) -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">📱 Social media setup — 2 hours, one sitting</h2>
<p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.7;">
Brand assets attached to this email (12 PNGs). Full copy + bios in <code style="background:#f5f0e8;padding:1px 5px;">tools/social-media-setup/PLAYBOOK.md</code> already in your inbox.
</p>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
${[
  ['7',  '<strong>Instagram</strong> (15 min)', 'Business account. Username <code>@propertydna</code>. Use <code>profile-400.png</code> + <code>profile-1080.png</code> as avatar. No banner needed (carousel pinned post).'],
  ['8',  '<strong>TikTok</strong> (10 min)', 'Business account. Username <code>@propertydna</code>. Avatar: <code>tiktok-avatar.png</code>. Pin Short #03 (cherry-pick comps) when uploaded.'],
  ['9',  '<strong>YouTube</strong> (15 min)', 'Channel: <code>PropertyDNA · Save the Humans</code>. Handle <code>@PropertyDNAOfficial</code>. Banner: <code>youtube-banner.png</code> (2560×1440). Avatar: <code>profile-1080.png</code>.'],
  ['10', '<strong>X (Twitter)</strong> (10 min)', 'Username <code>@propertydna</code>. Bio + pinned tweet in PLAYBOOK. Banner: <code>x-banner.png</code> (1500×500). Avatar: <code>profile-400.png</code>.'],
  ['11', '<strong>LinkedIn Company Page</strong> (15 min)', 'Create new Company Page <code>PropertyDNA</code>. About text in PLAYBOOK (900 char). Banner: <code>linkedin-company-banner.png</code>.'],
  ['12', '<strong>LinkedIn (your personal)</strong> (10 min)', 'Update headline + About per PLAYBOOK. Banner: <code>linkedin-personal-banner.png</code> (1584×396).'],
  ['13', '<strong>Facebook Page</strong> (10 min)', '<code>@propertydna</code>. Category: Real Estate Service. Cover: <code>facebook-cover.png</code> (1640×856). Link IG so it auto-crossposts.'],
  ['14', '<strong>Threads</strong> (2 min)', 'Auto-creates when IG is set up. Update bio per PLAYBOOK.'],
  ['15', '<strong>Reddit</strong> (5 min)', 'Username <code>u/propertydna_official</code>. Bio in PLAYBOOK.'],
  ['16', '<strong>Pinterest Business</strong> (15 min)', '<code>@propertydna</code>. Create the 6 boards listed in PLAYBOOK. Cover: <code>pinterest-cover.png</code>.'],
  ['17', '<strong>Bluesky</strong> (10 min)', 'Set handle to custom domain <code>propertydna.com</code> for credibility (instructions: <a href="https://bsky.app/profile/bsky.app/post/3kp52gtwl5j2x" style="color:#C9A84C;">bsky.app domain setup</a>). Avatar + banner: <code>profile-1080.png</code> + <code>bluesky-banner.png</code> (3000×1000).'],
].map(([n, h, d]) => `<tr><td style="padding:7px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">${n}.</td><td style="padding:7px 0;color:#444;line-height:1.7;">${h} — ${d}</td></tr>`).join('')}
</table>
</td></tr>

<!-- SECTION 4: OAUTH GRANTS (auto-activates posting) -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">🔌 OAuth grants — lights up posting + engagement automation</h2>
<p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.7;">
After accounts are created (above), grant each platform's OAuth to PropertyDNA infrastructure. Setup steps in <code style="background:#f5f0e8;padding:1px 5px;">tools/social-oauth/README.md</code>. Status admin at <a href="https://thepropertydna.com/admin/oauth" style="color:#C9A84C;">thepropertydna.com/admin/oauth</a>.
</p>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">18.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>YouTube OAuth</strong> (10 min) — Google Cloud project + OAuth client. <em>Unlocks the comment auto-reply cron.</em></td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">19.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>Instagram + Facebook OAuth</strong> (15 min) — single Meta app covers both. <em>Unlocks Reels + Page posting.</em></td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">20.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>X OAuth</strong> (10 min) — X Developer Portal. <em>Unlocks text + media posting.</em></td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">21.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>LinkedIn OAuth</strong> (10 min) — LinkedIn Developer Portal. <em>Unlocks personal + company posting.</em></td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">22.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>TikTok OAuth</strong> (15 min, plus 1-3 day audit wait) — TikTok Dev Portal. <em>Unlocks video posting.</em></td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">23.</td><td style="padding:6px 0;color:#444;line-height:1.7;"><strong>Reddit script-OAuth</strong> (5 min) — <em>Unlocks the cron that posts to subreddits (when needed).</em></td></tr>
</table>
</td></tr>

<!-- SECTION 5: PUBLIC LAUNCHES (1 hr) -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">🚀 Public launches — when ready</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">24.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Chrome Web Store submission</strong> (15 min + 1-3 day review) — pay $5 dev fee at <a href="https://chrome.google.com/webstore/devconsole" style="color:#C9A84C;">chrome.google.com/webstore/devconsole</a>. Icons already in repo. <strong>You need 5 screenshots</strong> — load extension locally first, screenshot 5 Zillow listing states (high score, low score, flood-zone, permits, comp spread). Full submission text in <code style="background:#f5f0e8;padding:1px 5px;">SUBMIT_ALL.md</code>.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">25.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Product Hunt launch</strong> (10 min) — <a href="https://www.producthunt.com/posts/new" style="color:#C9A84C;">producthunt.com/posts/new</a>. Schedule for <strong>Tuesday 12:01 AM PT</strong> (algorithmic sweet spot). Description + first comment in SUBMIT_ALL.md.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">26.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>HackerNews Show HN</strong> (5 min) — best window: Tue-Thu 9-11 AM PT. Title + body in SUBMIT_ALL.md.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">27.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Reddit launches</strong> (5 min each, 4 subs) — r/ClaudeAI, r/cursor, r/LocalLLaMA, r/RealEstate. Titles + bodies in SUBMIT_ALL.md. <em>Reddit hates promo — lead with substance.</em>
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">28.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Social launch posts</strong> (5 min) — copy/paste from PLAYBOOK to X, LinkedIn, Threads.
</td></tr>
</table>
</td></tr>

<!-- SECTION 6: CONTENT -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">🎬 Content — record + send</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">29.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Record 5 videos</strong> (90-minute shoot) — filming kit + 5 scripts already in your inbox (Resend ID <code style="font-size:11px;color:#888;">f71dcf7e</code>). Wardrobe, lighting, audio, mic setup all in <code>00-filming-kit.md</code>. Recommended shoot order in the kit.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">30.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Drop raw files in a folder + text me</strong> when done — I'll assemble + post the first Short within 24h, full slate within 72h.
</td></tr>
</table>
</td></tr>

<!-- SECTION 7: PARTNERSHIPS + PRESS -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">📨 Partnerships + press outreach (run in parallel, days 2-14)</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">31.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Pitch top 5 podcasts</strong> — Tier 1 list in <code style="background:#f5f0e8;padding:1px 5px;">tools/podcast-outreach/queue.json</code>. BiggerPockets, Real Estate Guys, How I Built This, Decoder (Verge), Lex Fridman. Pitch template at bottom of queue.json — customize per show, send 5 this week.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">32.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Mortgage broker partnerships</strong> — identify 3-5 brokers you know personally. Send the <a href="https://thepropertydna.com/partners" style="color:#C9A84C;">/partners</a> link. Each closing = $200-$1000 referral.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">33.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Insurance broker partnerships</strong> — same pattern. Florida + California urgency makes this an easy yes for the right broker.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">34.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Trade press outreach</strong> — Inman, HousingWire, Real Estate News. Press kit at <a href="https://thepropertydna.com/press-kit" style="color:#C9A84C;">/press-kit</a>. Email <code>press@thepropertydna.com</code> from yourself with a custom angle per outlet.
</td></tr>
</table>
</td></tr>

<!-- SECTION 8: SETUP TWEAKS + VERIFICATIONS -->
<tr><td style="padding:24px 40px 8px;">
<h2 style="margin:0 0 14px;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;border-bottom:2px solid #C9A84C;padding-bottom:6px;">⚙️ Small but important</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">35.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Verify iOS App Store URL</strong> <code>apps.apple.com/app/id6745688826</code> resolves to your current live PropertyDNA app. Newsletter + Chrome ext + every CTA points here.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">36.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Disable newsletter cron after Friday postflight</strong> — auto-cron is enabled for today's send. After Friday confirms it went out, I'll re-comment the line. If you want weekly auto-send going forward, tell me to leave it on.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">37.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Buy a Reddit + X account-protect Reddit Premium</strong> — $5/mo on Reddit gives you Premium = no rate limits, better ban-resistance. Worth it once Reddit is a real channel.
</td></tr>
<tr><td style="padding:6px 0;color:#1a1a1a;width:30px;vertical-align:top;font-weight:600;">38.</td><td style="padding:6px 0;color:#444;line-height:1.7;">
<strong>Decide on newsletter signup CTA placement</strong> — currently linked from footer + /newsletter route. Consider a small inline CTA on /share-your-story success state. Tell me to add it.
</td></tr>
</table>
</td></tr>

<!-- ATTACHMENTS NOTE -->
<tr><td style="padding:24px 40px;background:#faf8f5;border-top:1px solid #e5e0d8;border-bottom:1px solid #e5e0d8;">
<h3 style="margin:0 0 10px;font-size:14px;color:#1a1a1a;font-family:Georgia,serif;">📎 Brand assets attached (12 PNGs)</h3>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:12px;color:#555;line-height:1.65;">
<tr><td style="padding:3px 14px 3px 0;width:240px;color:#888;">profile-1080.png</td><td>Profile photo for all platforms (1080×1080)</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">profile-400.png</td><td>Profile photo, 400×400 (X / IG / FB)</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">profile-320.png</td><td>Profile photo, 320×320 (smaller platforms)</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">instagram-avatar.png</td><td>Instagram avatar, 320×320</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">tiktok-avatar.png</td><td>TikTok avatar, 200×200</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">x-banner.png</td><td>X (Twitter) banner, 1500×500</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">linkedin-personal-banner.png</td><td>LinkedIn personal cover, 1584×396</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">linkedin-company-banner.png</td><td>LinkedIn company page cover, 1128×191</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">youtube-banner.png</td><td>YouTube channel art, 2560×1440</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">facebook-cover.png</td><td>Facebook page cover, 1640×856</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">pinterest-cover.png</td><td>Pinterest cover image, 800×450</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#888;">bluesky-banner.png</td><td>Bluesky banner, 3000×1000</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 40px;">
<p style="margin:0;font-size:13px;color:#666;line-height:1.7;">
<strong>Reference docs in the repo (all already committed):</strong><br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/launch-checklist/SUBMIT_ALL.md</code> — 60-minute distribution sprint<br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/social-media-setup/PLAYBOOK.md</code> — every platform bio + first 5 posts<br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/social-oauth/README.md</code> — OAuth steps per platform<br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/podcast-outreach/queue.json</code> — 50 podcast targets + pitch template<br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/mcp-server/SUBMIT.md</code> — MCP directory submissions<br/>
• <code style="background:#f5f0e8;padding:1px 5px;font-size:11px;">tools/youtube/filming-kit.md</code> — 90-min shoot plan
</p>
</td></tr>

<tr><td style="padding:24px 40px 30px;border-top:1px solid #e5e0d8;background:#0a0908;color:#F4F0E8;text-align:center;">
<p style="margin:0 0 8px;font-size:18px;color:#C9A84C;font-family:Georgia,serif;font-style:italic;">"Save the humans."</p>
<p style="margin:0;font-size:11px;color:#888;line-height:1.6;letter-spacing:1px;">
PropertyDNA · thepropertydna.com · Every system built. Every switch waiting for your hand.
</p>
</td></tr>

</table></td></tr></table></body></html>`;

const text = `PropertyDNA — Your Action Items (last few days)

🔴 TODAY (security):
1. Change npm password (was shared in chat)
2. Revoke first npm token (npm_kavASgz...)

⏱️ 30-MIN DISTRIBUTION SPRINT:
3. Submit MCP server to Smithery
4. Submit to mcp.so
5. PR to Anthropic's official MCP repo
6. PR to awesome-mcp-servers

📱 SOCIAL MEDIA SETUP (2 hours):
7-17. Set up 11 platform accounts (IG, TikTok, YouTube, X, LinkedIn x2, FB, Threads, Reddit, Pinterest, Bluesky). Brand assets attached. PLAYBOOK.md has every line of copy.

🔌 OAUTH GRANTS (lights up automation):
18-23. YouTube, IG+FB, X, LinkedIn, TikTok, Reddit. Setup in tools/social-oauth/README.md. Admin status at thepropertydna.com/admin/oauth.

🚀 PUBLIC LAUNCHES:
24. Chrome Web Store (needs 5 screenshots from loading the extension)
25. Product Hunt (schedule Tuesday 12:01 AM PT)
26. HN Show
27. Reddit launches (4 subs)
28. Social launch posts (X / LinkedIn / Threads — copy in PLAYBOOK)

🎬 CONTENT:
29. Record 5 videos (90-min shoot — kit in inbox)
30. Drop raw files + text me

📨 PARTNERSHIPS + PRESS:
31. Pitch top 5 podcasts (queue.json)
32. Mortgage broker outreach
33. Insurance broker outreach
34. Trade press (Inman, HousingWire)

⚙️ SMALL BUT IMPORTANT:
35. Verify iOS App Store URL resolves
36. Newsletter cron decision (auto-weekly or preview-first)
37. Reddit Premium ($5/mo, optional)
38. Newsletter CTA placement tweak

Brand assets attached: 12 PNGs covering profile photos + every platform's banner.

Save the humans.
`;

const payload = JSON.stringify({
  from: "PropertyDNA <reports@thepropertydna.com>",
  to: RECIPIENT,
  reply_to: "stuartteamps@gmail.com",
  subject: "✅ Your action items — everything only YOU can do (brand assets attached)",
  html, text,
  attachments,
});

const req = https.request({
  hostname: "api.resend.com", path: "/emails", method: "POST",
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
}, (res) => {
  let raw = ""; res.on("data", c => raw += c);
  res.on("end", () => {
    try {
      const d = JSON.parse(raw);
      if (d.id) console.log(`✅ Sent (${attachments.length} attachments). Resend ID: ${d.id}`);
      else { console.error("Failed:", d); process.exit(1); }
    } catch { console.error("Bad response:", raw); process.exit(1); }
  });
});
req.on("error", e => { console.error(e); process.exit(1); });
req.write(payload);
req.end();
