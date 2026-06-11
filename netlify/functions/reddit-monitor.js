/**
 * reddit-monitor — Scans 5 high-value subreddits twice daily for posts
 * matching homebuyer-intent keywords. Surfaces matches to Dan with a
 * suggested reply that offers a free DNA scan.
 *
 * Dan posts manually (Reddit auto-replies destroy community standing).
 * This function is for monitoring + suggestion, not posting.
 *
 * Schedule: [functions."reddit-monitor"] schedule = "0 14,22 * * *"
 *           (6 AM PT + 2 PM PT — catches morning + lunch browsing)
 *
 * Output:
 *   - Writes matched posts to reddit_post_queue
 *   - Emails Dan a daily digest of new matches with suggested replies
 *
 * Reddit API: uses the unauthenticated public JSON endpoint
 * (https://www.reddit.com/r/<sub>/new.json) — no OAuth needed for read.
 * Once Dan grants OAuth via /social-oauth-start?platform=reddit, this
 * will use the authenticated endpoint instead (better rate limit).
 */
const https = require("https");
const db = require("./_supabase");

const SUBREDDITS = [
  "RealEstate",
  "FirstTimeHomeBuyer",
  "personalfinance",
  "REBubble",
  "RealEstateInvesting",
];

// Match patterns — intent keywords + their reply angle
const PATTERNS = [
  { keyword: /\b(zestimate|zillow estimate|redfin estimate)\b/i, angle: "zestimate_truth",
    reply: ({ title, sub }) => `The Zestimate's median error is around 1.9% on-market and 7.5% off-market — but Zillow doesn't tell you which side of that distribution you're on. I built PropertyDNA (https://thepropertydna.com) to surface the comp set the algorithm actually uses, with confidence intervals. Free, no account required.${sub === "personalfinance" ? "" : " Happy to run your specific address if you want — drop it here."}`,
  },
  { keyword: /\b(flood zone|fema|flood insurance)\b/i, angle: "flood_zone_check",
    reply: ({ title }) => `If you're checking flood zone on a property, also check whether it's in a *revised* AE designation post-Helene/Milton (huge swaths of FL got rewritten). The lender will require flood insurance and the resale value reflects the new zone within 12 months. PropertyDNA pulls the live FEMA NFHL — free, no signup: https://thepropertydna.com`,
  },
  { keyword: /\b(unfinaled permit|open permit|permit not closed)\b/i, angle: "permit_history",
    reply: ({ title }) => `Unfinaled permits average $12K at closing when title catches them. I run them on every report through PropertyDNA (https://thepropertydna.com) — pulls from BuildZoom + county portals. If you want to share the address I can run the permit history live.`,
  },
  { keyword: /\b(comp|cma|comparable sales|comparative market analysis)\b/i, angle: "comp_truth",
    reply: ({ title, sub }) => `Most CMAs pick 3 comps. The algorithm should pull every comp in the radius. When the 3-comp average is more than 8% above the full-set average, it's cherry-picked. PropertyDNA shows the full ring + the cherry-pick spread for free: https://thepropertydna.com${sub === "RealEstate" ? "" : " — happy to run it on a specific address if you want."}`,
  },
  { keyword: /\b(florida insurance|citizens insurance|home insurance florida|hurricane insurance)\b/i, angle: "fl_insurance_crisis",
    reply: ({ title }) => `Florida's insurance crisis is rewriting carrying costs faster than people realize — 1.4M homes are now Citizens-only. Before you commit on any FL property, check the carrier tier for the zip code (not just the seller's policy). PropertyDNA pulls live OIR depopulation data + revised FEMA zones: https://thepropertydna.com`,
  },
  { keyword: /\b(overpaying|overpaid|too high|over asking|paying too much)\b/i, angle: "overpay_risk",
    reply: ({ title }) => `Two things to verify before you go above asking: (1) the comp spread — if your agent's 3 comps average more than 8% above the algorithm's full-radius set, it's cherry-picked; (2) the DNA-adjusted mid value. Run a free PropertyDNA report on the address: https://thepropertydna.com`,
  },
  { keyword: /\b(buyer agent|buyer.s agent|listing agent|dual agent|agent commission)\b/i, angle: "agent_incentives",
    reply: ({ title }) => `The economic incentive is real: every $10K you negotiate off costs the buyer's agent ~$250 in commission, every dead deal costs them 100%. That's why the data needs to be on your side of the table. PropertyDNA gives you the same intelligence the agent has, before you sign: https://thepropertydna.com (free).`,
  },
  { keyword: /\b(should i (buy|offer)|worth it|low.?ball|negotiat\w+)\b/i, angle: "should_i_buy",
    reply: ({ title }) => `Before deciding, two specific data pulls help: (1) full-radius comp truth (not the agent's 3 picks), (2) permit history + flood / hazard layer. PropertyDNA does both free, no signup: https://thepropertydna.com — happy to run your address.`,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────
function fetchSubreddit(sub) {
  return new Promise((resolve) => {
    const path = `/r/${sub}/new.json?limit=25`;
    https.get({
      hostname: "www.reddit.com",
      path,
      headers: { "User-Agent": "PropertyDNA-Monitor/1.0 by u/propertydna" },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    }).on("error", () => resolve(null))
      .setTimeout(15000, () => resolve(null));
  });
}

function classifyPost(post) {
  const text = `${post.title} ${post.selftext || ""}`;
  const matched = [];
  let pattern = null;
  for (const p of PATTERNS) {
    if (p.keyword.test(text)) {
      matched.push(p.angle);
      pattern = pattern || p;
    }
  }
  return { matched, pattern };
}

async function sendOwnerDigest(matches) {
  if (matches.length === 0) return;
  const ownerEmail = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
  const senderEmail = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
  const senderName = process.env.SENDER_NAME || "PropertyDNA";
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:32px 20px;">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:28px 36px 16px;border-bottom:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · Reddit Monitor</p>
<p style="margin:8px 0 0;font-size:22px;color:#1a1a1a;">${matches.length} new posts to reply to</p>
<p style="margin:6px 0 0;font-size:13px;color:#777;line-height:1.5;">Authenticity is the channel — copy the suggested reply, edit to your voice, post manually. Reddit bans bots; you reply, the algorithm rewards quality.</p>
</td></tr>
${matches.map(m => `
<tr><td style="padding:18px 36px;border-top:1px solid #f0ece4;">
<p style="margin:0 0 4px;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">${m.subreddit} · u/${m.author || "deleted"} · ${m.matched_keywords?.join(", ") || ""}</p>
<p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;font-family:Georgia,serif;line-height:1.3;">${m.title}</p>
${m.body ? `<p style="margin:0 0 12px;font-size:12px;color:#555;line-height:1.6;border-left:3px solid #e5e0d8;padding:8px 12px;background:#faf8f5;">${m.body.slice(0, 320).replace(/[<>]/g, "")}${m.body.length > 320 ? "…" : ""}</p>` : ""}
<p style="margin:0 0 6px;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">Suggested reply</p>
<p style="margin:0 0 10px;font-size:13px;color:#444;line-height:1.6;background:#f7f5f0;padding:10px 14px;border-left:3px solid #C9A84C;font-family:Georgia,serif;">${m.suggested_reply}</p>
<p style="margin:0;font-size:12px;"><a href="${m.url}" style="color:#C9A84C;text-decoration:none;">Open thread on Reddit →</a></p>
</td></tr>`).join("")}
<tr><td style="padding:18px 36px;background:#faf8f5;border-top:1px solid #e5e0d8;">
<p style="margin:0;font-size:11px;color:#888;line-height:1.5;">Posts already shown won't re-appear. Adjust monitored subreddits in netlify/functions/reddit-monitor.js.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const payload = JSON.stringify({
    from: `${senderName} <${senderEmail}>`,
    to: ownerEmail,
    subject: `Reddit · ${matches.length} new posts to reply to (${new Date().toISOString().slice(0,10)})`,
    html,
  });

  await new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => { res.on("data", () => {}); res.on("end", resolve); });
    req.on("error", resolve);
    req.write(payload);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
exports.handler = async () => {
  const allMatches = [];
  let totalScanned = 0;

  for (const sub of SUBREDDITS) {
    const data = await fetchSubreddit(sub);
    const posts = data?.data?.children?.map(c => c.data) || [];
    totalScanned += posts.length;

    for (const post of posts) {
      const { matched, pattern } = classifyPost(post);
      if (!matched.length) continue;

      // Skip if we already queued this reddit id
      const seen = await db.from("reddit_post_queue").select("id").eq("reddit_id", post.id).limit(1).get().catch(() => []);
      if (Array.isArray(seen) && seen.length) continue;

      const reply = pattern?.reply({ title: post.title, sub }) || `Free PropertyDNA report on any address: https://thepropertydna.com`;

      const row = {
        reddit_id: post.id,
        subreddit: sub,
        author: post.author,
        title: post.title.slice(0, 500),
        body: (post.selftext || "").slice(0, 4000),
        url: `https://www.reddit.com${post.permalink}`,
        score: post.score,
        created_utc: new Date(post.created_utc * 1000).toISOString(),
        matched_keywords: matched,
        suggested_reply: reply,
        status: "pending",
      };

      const inserted = await db.insert("reddit_post_queue", row).catch(() => null);
      if (Array.isArray(inserted) && inserted[0]) allMatches.push(inserted[0]);
      else allMatches.push(row);
    }

    // 2s pacing between subreddits to be polite
    await new Promise(r => setTimeout(r, 2000));
  }

  if (allMatches.length > 0) {
    await sendOwnerDigest(allMatches);
  }

  db.kpi("reddit_monitor_run", null, { scanned: totalScanned, matches: allMatches.length });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      subreddits_scanned: SUBREDDITS.length,
      posts_scanned: totalScanned,
      matches: allMatches.length,
      ran_at: new Date().toISOString(),
    }),
  };
};
