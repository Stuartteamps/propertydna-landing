/**
 * eod-log — End-of-day log emailed to Dan every evening.
 *
 * Runs daily at 02:00 UTC (7 PM PDT). Reports:
 *   1. WHAT GOT DONE TODAY — git commits, content shipped, automations
 *      fired, partnerships/press inbound
 *   2. WHAT'S STILL NEEDED FROM YOU — the top 5 outstanding action items
 *   3. WHAT'S RUNNING TONIGHT — the autonomous engines still working
 *   4. TOMORROW'S PRIORITIES — what should happen if Dan does nothing
 *
 * Schedule: [functions."eod-log"] schedule = "0 2 * * *"
 *
 * This is the staying-on-track loop Dan asked for: "send me log at the
 * end of day of everything you completed and items you still need from
 * me each day so we can stay on track"
 */
const https = require("https");
const db = require("./_supabase");

const OWNER_EMAIL = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
const SENDER      = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = process.env.SENDER_NAME  || "PropertyDNA";

function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0 });
  const payload = JSON.stringify({ from: `${SENDER_NAME} <${SENDER}>`, to, subject, html, text });
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

async function safeCount(table, filterField, filterValue, sinceISO) {
  try {
    const cutoff = sinceISO || new Date(Date.now() - 86400000).toISOString();
    let q = db.from(table).select("id");
    if (filterField && filterValue !== undefined) q = q.eq(filterField, filterValue);
    q = q.gte("created_at", cutoff);
    const r = await q.get();
    return Array.isArray(r) ? r.length : 0;
  } catch { return 0; }
}

// Fetch recent commits to GitHub via public API (no auth needed for public repos)
async function fetchRecentCommits(sinceISO) {
  return new Promise((resolve) => {
    const path = `/repos/Stuartteamps/propertydna-landing/commits?since=${encodeURIComponent(sinceISO)}&per_page=30`;
    https.get({
      hostname: "api.github.com", path,
      headers: { "User-Agent": "PropertyDNA-EOD/1.0", Accept: "application/vnd.github+json" },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          if (!Array.isArray(data)) return resolve([]);
          resolve(data.map(c => ({
            sha: c.sha?.slice(0, 7),
            msg: (c.commit?.message || "").split("\n")[0],
            author: c.commit?.author?.name || "—",
            time: c.commit?.author?.date,
          })));
        } catch { resolve([]); }
      });
    }).on("error", () => resolve([]))
      .setTimeout(8000, () => resolve([]));
  });
}

// Pending action items — keep these current as the mission progresses
const PENDING_ACTION_ITEMS = [
  {
    title: "Submit MCP server to Smithery + mcp.so + Anthropic's repo",
    why: "Distribution amplifier — 1000s of AI-native users discover PropertyDNA",
    time: "30 min",
    doc: "tools/launch-checklist/SUBMIT_ALL.md",
  },
  {
    title: "Record the 5 videos in the filming kit",
    why: "YouTube channel + Shorts + TikTok all need the founder voice",
    time: "90-min shoot",
    doc: "Filming kit in inbox (Resend f71dcf7e)",
  },
  {
    title: "Set up social accounts + grant OAuth at /admin/oauth",
    why: "Lights up the cross-poster + YouTube engagement automation",
    time: "2 hr",
    doc: "tools/social-media-setup/PLAYBOOK.md + brand assets in inbox (492cab4b)",
  },
  {
    title: "Chrome Web Store submission",
    why: "Biggest top-of-funnel unlock — DNA badge on every Zillow / Redfin listing",
    time: "15 min + 5 screenshots from loaded extension",
    doc: "tools/chrome-extension/README.md",
  },
  {
    title: "Send top 5 press pitches",
    why: "Verge, WSJ, Bloomberg, Inman, NYT — pre-personalized",
    time: "10 min (copy/paste from JSON to Gmail)",
    doc: "tools/press-outreach/pitches.json",
  },
  {
    title: "Send top 5 celebrity/influencer outreaches",
    why: "Graham Stephan, Meet Kevin, BiggerPockets, Codie Sanchez, Patrick Bet-David",
    time: "15 min",
    doc: "tools/celebrity-outreach/queue.json",
  },
  {
    title: "npm password change + revoke first token",
    why: "Security hygiene — was shared in chat",
    time: "2 min",
    doc: "npmjs.com → Settings → Change Password + tokens",
  },
];

exports.handler = async () => {
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const startISO = dayStart.toISOString();
  const dayLabel = dayStart.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ── 1. What got done today
  const commits = await fetchRecentCommits(startISO);

  const reports_today      = await safeCount("kpi_events", "event_type", "report_generated", startISO);
  const stories_today      = await safeCount("submitted_stories", null, null, startISO);
  const watch_adds_today   = await safeCount("watched_properties", null, null, startISO);
  const oh_leads_today     = await safeCount("open_house_leads", null, null, startISO);
  const reddit_today       = await safeCount("reddit_post_queue", null, null, startISO);
  const youtube_replies    = await safeCount("youtube_comment_log", "replied", true, startISO);
  const lead_emails_today  = await safeCount("kpi_events", "event_type", "lead_email_sent", startISO);

  // ── Build HTML email
  const commitList = commits.length === 0
    ? '<p style="font-size:12px;color:rgba(244,240,232,0.5);margin:0;">No commits today yet.</p>'
    : commits.slice(0, 15).map(c =>
        `<tr><td style="padding:4px 12px 4px 0;color:rgba(244,240,232,0.4);font-family:monospace;font-size:11px;width:70px;vertical-align:top;">${c.sha}</td><td style="padding:4px 0;color:rgba(244,240,232,0.8);font-size:12px;line-height:1.55;vertical-align:top;">${(c.msg || "").replace(/[<>]/g, "")}</td></tr>`
      ).join("");

  const actionItemsHtml = PENDING_ACTION_ITEMS.map((a, i) => `
<tr><td style="padding:10px 0;border-top:${i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)'};vertical-align:top;width:24px;color:#C9A84C;font-family:Georgia,serif;font-size:14px;">${i + 1}.</td>
<td style="padding:10px 0;border-top:${i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)'};">
<p style="margin:0 0 3px;font-size:13px;color:#F4F0E8;line-height:1.5;font-weight:500;">${a.title}</p>
<p style="margin:0 0 3px;font-size:11px;color:rgba(244,240,232,0.5);line-height:1.55;">↳ ${a.why}</p>
<p style="margin:0;font-size:10px;color:rgba(244,240,232,0.4);letter-spacing:0.5px;">⏱ ${a.time} · ${a.doc}</p>
</td></tr>`).join("");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0908;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0908;"><tr><td align="center" style="padding:32px 16px;">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#12100d;border:1px solid rgba(255,255,255,0.08);">

<tr><td style="padding:24px 32px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
<p style="margin:0;font-size:10px;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">End of day · ${dayLabel}</p>
<p style="margin:8px 0 0;font-size:22px;color:#F4F0E8;font-family:Georgia,serif;line-height:1.15;">Today's log — staying on track</p>
</td></tr>

<!-- SHIPPED TODAY -->
<tr><td style="padding:22px 32px 12px;">
<h2 style="margin:0 0 10px;font-size:11px;color:#00cc77;letter-spacing:3px;text-transform:uppercase;">✅ Shipped today</h2>
<p style="margin:0 0 12px;font-size:13px;color:rgba(244,240,232,0.7);line-height:1.7;">
${commits.length} commits to main · ${reports_today} reports run · ${stories_today} stories submitted · ${watch_adds_today} watch-list adds · ${oh_leads_today} open-house leads · ${reddit_today} Reddit posts surfaced · ${youtube_replies} YouTube comments replied · ${lead_emails_today} lead-emails delivered
</p>
<table cellpadding="0" cellspacing="0" style="width:100%;margin-top:6px;">
${commitList}
</table>
</td></tr>

<!-- STILL NEEDED FROM YOU -->
<tr><td style="padding:22px 32px 12px;border-top:1px solid rgba(255,255,255,0.06);">
<h2 style="margin:0 0 10px;font-size:11px;color:#ff8800;letter-spacing:3px;text-transform:uppercase;">⏳ Still needed from you</h2>
<table cellpadding="0" cellspacing="0" style="width:100%;">
${actionItemsHtml}
</table>
</td></tr>

<!-- RUNNING TONIGHT -->
<tr><td style="padding:22px 32px 12px;border-top:1px solid rgba(255,255,255,0.06);">
<h2 style="margin:0 0 10px;font-size:11px;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">⚙️ Running tonight while you sleep</h2>
<ul style="margin:0;padding-left:22px;font-size:12px;color:rgba(244,240,232,0.6);line-height:1.85;">
<li>Watch-list diff cron (6 AM PDT) — alerts users on DNA score moves</li>
<li>Reddit monitor (2 PM + 6 AM PDT) — fresh matches surfaced to your inbox</li>
<li>YouTube engagement (every 15 min) — auto-replies when OAuth is granted</li>
<li>Daily mission report (6:30 AM PDT) — morning snapshot of indexing + engagement</li>
<li>Drip sequence (hourly) — multi-touch nurture on inbound submissions</li>
<li>SEO content generator queue — drafts continuing in tools/seo-content/queue/</li>
<li>Auto-publisher — turns approved drafts into live /blog posts</li>
</ul>
</td></tr>

<!-- TOMORROW IF YOU DO NOTHING -->
<tr><td style="padding:22px 32px;border-top:1px solid rgba(255,255,255,0.06);">
<h2 style="margin:0 0 10px;font-size:11px;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">🌅 Tomorrow — what happens with or without you</h2>
<p style="margin:0;font-size:12px;color:rgba(244,240,232,0.65);line-height:1.7;">
With or without your input: newsletter token refresh runs, watch-list refresh fires, ops digest emails, Reddit monitor twice, daily mission report lands at 6:30 AM. <br/><br/>
If you give 30 minutes: ship the 4 MCP directory submissions (Smithery + mcp.so + Anthropic + awesome-mcp). Biggest single distribution lever.
</p>
</td></tr>

<tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);background:#0a0908;text-align:center;">
<p style="margin:0;font-size:12px;color:#C9A84C;font-style:italic;font-family:Georgia,serif;">"Save the humans."</p>
<p style="margin:6px 0 0;font-size:10px;color:rgba(244,240,232,0.4);letter-spacing:1px;">
PropertyDNA · thepropertydna.com · Autonomous EOD log
</p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = `End of day — ${dayLabel}

✅ SHIPPED TODAY:
${commits.length} commits · ${reports_today} reports · ${stories_today} stories · ${watch_adds_today} watch-adds · ${oh_leads_today} OH leads · ${reddit_today} Reddit posts · ${youtube_replies} YT replies · ${lead_emails_today} lead emails

Commits:
${commits.slice(0, 15).map(c => `  ${c.sha}  ${c.msg}`).join("\n") || "  (none yet today)"}

⏳ STILL NEEDED FROM YOU:
${PENDING_ACTION_ITEMS.map((a, i) => `${i + 1}. ${a.title} (${a.time}) — ${a.why}`).join("\n")}

⚙️ RUNNING TONIGHT:
- Watch-list diff cron
- Reddit monitor (2 cycles)
- YouTube engagement (once OAuth granted)
- Daily mission report (6:30 AM PDT tomorrow)
- Drip sequence
- SEO content generator
- Auto-publisher for approved drafts

🌅 TOMORROW: with or without you, newsletter token + watch refresh + ops digest + Reddit + mission report all fire. If you give 30 min: ship 4 MCP directory submissions.

Save the humans.`;

  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Today · ${commits.length} commits · ${reports_today} reports · ${PENDING_ACTION_ITEMS.length} pending from you`,
    html, text,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      commits: commits.length,
      reports_today,
      stories_today,
      watch_adds_today,
      oh_leads_today,
      pending_action_items: PENDING_ACTION_ITEMS.length,
      ran_at: new Date(now).toISOString(),
    }),
  };
};
