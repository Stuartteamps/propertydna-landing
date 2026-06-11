/**
 * youtube-engagement — Runs every 15 minutes via Netlify cron. Scans new
 * comments on PropertyDNA YouTube videos, classifies intent, auto-replies
 * to high-intent comments with the App Store link, and surfaces "scan
 * [address]" requests to Dan as queue items.
 *
 * Schedule: [functions."youtube-engagement"] schedule = "*\/15 * * * *"
 *
 * Requires:
 *   - social_oauth_tokens row with platform='youtube' (access_token with
 *     youtube.force-ssl scope)
 *   - youtube_comment_log table for idempotency
 *
 * Reply rules (apply in order; first match wins):
 *   1. Contains "scan", "run", "check" + an address-shaped string
 *      → forward to Dan's inbox; reply with "queued"
 *   2. Contains "how", "where", "app", "download", "ios", "iphone"
 *      → reply with App Store link + free-report CTA
 *   3. Contains "agent" + negative sentiment ("bad", "lying", "scammed", "ripped off")
 *      → reply with empathy + invitation to DM
 *   4. Question mark in first 100 chars
 *      → reply with "great question — full answer in next week's video"
 *      (only if comment >40 chars to avoid spam-replying to "lol?")
 *   5. Otherwise → log + skip
 *
 * Dan can disable specific rules via YOUTUBE_REPLY_RULES_DISABLED env var
 * (comma-separated rule numbers).
 */
const https = require("https");
const db = require("./_supabase");

const REPLY_TEMPLATES = {
  scan_request: ({ address }) =>
    `Queued — running the algorithm on ${address} this week. I'll pin a follow-up reply with the verdict. ` +
    `If you want it sooner, free DNA report at thepropertydna.com 👇`,

  app_question: () =>
    `Free iOS app: https://apps.apple.com/app/id6745688826 — no subscription, no upsells. ` +
    `Web version: https://thepropertydna.com — same intelligence, free DNA report on any address.`,

  agent_negative: () =>
    `Your story is exactly why we built this. Reply with the city/state and I'll show you what the agent should've shown you — free, no funnel. ` +
    `Or DM me on https://thepropertydna.com if you want to talk privately.`,

  question_mark: () =>
    `Great question — I'm covering this in next week's video. Hit subscribe so you don't miss it. ` +
    `Want the answer faster? Run a free DNA report on any address: https://thepropertydna.com`,
};

const ADDRESS_RE = /\b(\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Za-z][A-Za-z0-9\s\-'.]{2,60}?(?:Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Way|Pkwy|Parkway|Pl|Place|Ter|Terrace|Cir|Circle|Trl|Trail|Hwy|Highway))\b[, ]+([A-Za-z\s]+),?\s*([A-Z]{2})\b/i;

function detectIntent(text) {
  const lower = text.toLowerCase().trim();

  // Rule 1 — scan/run/check request
  if (/\b(scan|run|check|analyze|pull|look\s+up)\b/.test(lower)) {
    const addressMatch = text.match(ADDRESS_RE);
    if (addressMatch) {
      return { intent: "scan_request", address: addressMatch[0].trim() };
    }
  }

  // Rule 2 — app / where / how
  if (/\b(how\s+do\s+i|where\s+can\s+i|where('s)?\s+the\s+app|download\s+(this|the)|got\s+an?\s+app|is\s+there\s+an?\s+app|ios\s+app|iphone\s+app)\b/.test(lower)) {
    return { intent: "app_question" };
  }
  if (/\bdownload\b/.test(lower) && lower.length < 80) {
    return { intent: "app_question" };
  }

  // Rule 3 — agent + negative sentiment
  if (/\bagent\b/.test(lower) &&
      /\b(lying|lied|scammed|scam|ripped\s*off|ripped\s+me|sucked|terrible|awful|liar|fraud|predatory|burned|burnt|screwed)\b/.test(lower)) {
    return { intent: "agent_negative" };
  }

  // Rule 4 — question (lenient)
  if (text.length >= 40 && /\?/.test(text.slice(0, 120))) {
    return { intent: "question_mark" };
  }

  return { intent: "none" };
}

// ── YouTube API helpers ───────────────────────────────────────────────────
function ytGet(path, token) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: "youtube.googleapis.com", path,
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    }).on("error", reject);
  });
}

function ytPost(path, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "youtube.googleapis.com", path, method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function refreshAccessToken(token) {
  if (!token.refresh_token) return null;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    refresh_token: token.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "oauth2.googleapis.com", path: "/token", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(params) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on("error", reject);
    req.write(params);
    req.end();
  });
}

async function getValidToken() {
  const tokens = await db.from("social_oauth_tokens")
    .select("*").eq("platform", "youtube").limit(1).get().catch(() => []);
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const token = tokens[0];

  if (token.expires_at && new Date(token.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await refreshAccessToken(token);
    if (refreshed?.access_token) {
      const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      await db.from("social_oauth_tokens").eq("platform", "youtube").update({
        access_token: refreshed.access_token,
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
      return { ...token, access_token: refreshed.access_token, expires_at: newExpiry };
    }
    return null;
  }
  return token;
}

// ── Owner alert (for scan requests) ───────────────────────────────────────
async function alertOwner({ author, comment, address, videoId }) {
  const ownerEmail = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";
  const senderEmail = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const payload = JSON.stringify({
    from: `PropertyDNA <${senderEmail}>`,
    to: ownerEmail,
    subject: `YouTube scan request — ${address}`,
    html: `
      <p>YouTube viewer <strong>${author}</strong> asked you to scan:</p>
      <p style="font-size:18px;font-family:Georgia,serif;border-left:3px solid #C9A84C;padding-left:14px;">${address}</p>
      <p style="color:#555;font-size:13px;">Original comment: "${comment.replace(/[<>]/g, '')}"</p>
      <p><a href="https://www.youtube.com/watch?v=${videoId}">Open video →</a></p>
      <p style="color:#888;font-size:12px;">Engagement auto-replied with "queued" message.</p>
    `,
  });
  await new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => { res.on("data", () => {}); res.on("end", resolve); });
    req.on("error", resolve);
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
exports.handler = async () => {
  const token = await getValidToken();
  if (!token) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "skipped",
        reason: "no_youtube_token",
        instructions: "Set up YouTube OAuth — see tools/social-oauth/README.md → YouTube section.",
      }),
    };
  }

  const channelId = process.env.YOUTUBE_CHANNEL_ID || token.account_id;
  if (!channelId) {
    return { statusCode: 200, body: JSON.stringify({ status: "skipped", reason: "no_channel_id" }) };
  }

  // Pull recent comments across all channel videos via commentThreads.list
  // (allThreadsRelatedToChannelId pages back ~50 most-recent threads)
  const threadsResp = await ytGet(
    `/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${channelId}&maxResults=50&order=time`,
    token.access_token
  );
  const items = threadsResp.items || [];
  if (!items.length) {
    return { statusCode: 200, body: JSON.stringify({ status: "ok", scanned: 0, replied: 0 }) };
  }

  // Bulk-check which comment IDs we've already processed
  const commentIds = items.map(t => t.snippet?.topLevelComment?.id).filter(Boolean);
  const seen = await db.from("youtube_comment_log")
    .select("comment_id").in("comment_id", commentIds).get().catch(() => []);
  const seenSet = new Set((seen || []).map(s => s.comment_id));

  const disabledRules = (process.env.YOUTUBE_REPLY_RULES_DISABLED || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const ruleEnabled = (intent) => {
    const map = { scan_request: "1", app_question: "2", agent_negative: "3", question_mark: "4" };
    return !disabledRules.includes(map[intent] || "");
  };

  let replied = 0;
  for (const thread of items) {
    const top = thread.snippet?.topLevelComment;
    if (!top) continue;
    const commentId = top.id;
    if (seenSet.has(commentId)) continue;

    const snippet = top.snippet || {};
    const text = snippet.textOriginal || "";
    const author = snippet.authorDisplayName || "viewer";
    const videoId = thread.snippet?.videoId;

    const { intent, address } = detectIntent(text);

    let replyText = null;
    if (intent !== "none" && ruleEnabled(intent)) {
      replyText = REPLY_TEMPLATES[intent]({ address });
    }

    if (replyText && intent === "scan_request") {
      // fire-and-forget owner alert
      alertOwner({ author, comment: text, address, videoId }).catch(() => {});
    }

    if (replyText) {
      const reply = await ytPost(
        `/youtube/v3/comments?part=snippet`,
        token.access_token,
        { snippet: { parentId: commentId, textOriginal: replyText } }
      );
      const replyId = reply?.id || null;

      await db.insert("youtube_comment_log", {
        video_id: videoId,
        comment_id: commentId,
        author_channel_id: snippet.authorChannelId?.value || null,
        author_display: author,
        comment_text: text.slice(0, 1000),
        replied: !!replyId,
        reply_id: replyId,
        reply_text: replyText,
        intent,
      }).catch(() => {});

      if (replyId) replied++;
    } else {
      // Log non-replies too so we don't re-classify the same comment forever
      await db.insert("youtube_comment_log", {
        video_id: videoId,
        comment_id: commentId,
        author_channel_id: snippet.authorChannelId?.value || null,
        author_display: author,
        comment_text: text.slice(0, 1000),
        replied: false,
        intent,
      }).catch(() => {});
    }

    // Light rate-limit between replies
    if (replyText) await new Promise(r => setTimeout(r, 750));
  }

  db.kpi("youtube_engagement_run", null, { scanned: items.length, replied });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ok", scanned: items.length, replied, ran_at: new Date().toISOString() }),
  };
};
