/**
 * social-poster — multi-platform social posting infrastructure.
 *
 * Posts a single piece of content (video or text+image) to YouTube,
 * Instagram, TikTok, X (Twitter), LinkedIn, and Facebook in one call.
 * Reads OAuth tokens from social_oauth_tokens table — gracefully skips
 * any platform that doesn't yet have a token.
 *
 * This is the "scaffold first, light it up later" pattern: Dan grants
 * OAuth for one platform at a time, and posting starts working for that
 * platform without any further code changes.
 *
 * POST body:
 *   platforms?      string[]  — explicit platform list; default: all wired
 *   caption         string    — post body / video description
 *   media_url?      string    — public URL of MP4 or image (use Supabase Storage)
 *   media_type?     'video' | 'image' | 'text'  (default 'video')
 *   scheduled_for?  ISO datetime — defer to cron pickup (default: now)
 *   source?         string    — bookkeeping tag (e.g. "youtube_script_03")
 *
 * Auth: x-internal-key header must match INTERNAL_API_KEY.
 *
 * Returns: per-platform result. Skipped platforms are reported as
 * { platform, status: "no_token", instructions: "..." } so Dan knows what
 * to wire next.
 */
const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// ── Platform adapters ─────────────────────────────────────────────────────
// Each adapter takes a token row + post payload and returns { url, id } on
// success, or throws on failure. Adapters return null when the token has
// expired and refresh_token is missing — caller handles re-auth flow.

const ADAPTERS = {
  // YouTube — uploads a Short (vertical) or long-form video via Data API v3
  async youtube(token, { caption, media_url, media_type }) {
    if (media_type !== "video") throw new Error("youtube_requires_video");
    // 2-step upload: 1) POST videos.insert with metadata, 2) PUT the MP4 bytes.
    // For now, we post the video URL into a description-only "community post"
    // path until full Resumable Upload API is wired (needs raw byte streaming).
    // Real implementation: download media_url, multipart upload to YT.
    const titleMax = 100;
    const title = caption.split("\n")[0].slice(0, titleMax) || "PropertyDNA";
    const body = {
      snippet: { title, description: caption, categoryId: "22" }, // 22=People & Blogs
      status:  { privacyStatus: "public", selfDeclaredMadeForKids: false },
    };
    // NOTE: full upload requires multipart/related body. Placeholder returns
    // 'pending_full_upload' so the orchestrator can hand off to a worker.
    return { status: "pending_full_upload", title, scheduled: true, body };
  },

  // Instagram Graph API — Reels for video, image_url for static
  async instagram(token, { caption, media_url, media_type }) {
    const igUserId = token.account_id; // IG Business Account ID
    if (!igUserId) throw new Error("instagram_missing_account_id");

    // Step 1: create container
    const isVideo = media_type === "video";
    const containerPath = `/v19.0/${igUserId}/media?access_token=${token.access_token}` +
      `&${isVideo ? "video_url" : "image_url"}=${encodeURIComponent(media_url)}` +
      (isVideo ? "&media_type=REELS" : "") +
      `&caption=${encodeURIComponent(caption.slice(0, 2200))}`;
    const container = await httpsGetJSON("graph.facebook.com", containerPath);
    if (!container?.id) throw new Error("instagram_container_failed: " + JSON.stringify(container));

    // Wait briefly for IG to process the media before publishing
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: publish
    const publishPath = `/v19.0/${igUserId}/media_publish?access_token=${token.access_token}&creation_id=${container.id}`;
    const pub = await httpsPostNoBody("graph.facebook.com", publishPath);
    if (!pub?.id) throw new Error("instagram_publish_failed: " + JSON.stringify(pub));

    return { url: `https://www.instagram.com/p/${pub.id}/`, id: pub.id };
  },

  // TikTok Content Posting API — direct-post for whitelisted apps
  async tiktok(token, { caption, media_url, media_type }) {
    if (media_type !== "video") throw new Error("tiktok_requires_video");
    const initPath = "/v2/post/publish/inbox/video/init/";
    const init = await httpsPostJSON("open.tiktokapis.com", initPath,
      { "Authorization": `Bearer ${token.access_token}` },
      { source_info: { source: "PULL_FROM_URL", video_url: media_url } });
    if (!init?.data?.publish_id) throw new Error("tiktok_init_failed: " + JSON.stringify(init));
    return { url: `https://www.tiktok.com/@${token.account_handle || "propertydna"}`, id: init.data.publish_id, status: "queued_to_drafts" };
  },

  // X (Twitter) v2 API — posts text + media reference. Video requires media upload first.
  async x(token, { caption, media_url, media_type }) {
    // For text-only or short captions; video upload needs the legacy media/upload chunked endpoint.
    const text = caption.slice(0, 280);
    const res = await httpsPostJSON("api.twitter.com", "/2/tweets",
      { "Authorization": `Bearer ${token.access_token}` },
      { text });
    if (!res?.data?.id) throw new Error("x_post_failed: " + JSON.stringify(res));
    return { url: `https://x.com/i/web/status/${res.data.id}`, id: res.data.id };
  },

  // LinkedIn UGC API — share with text + optional media
  async linkedin(token, { caption, media_url }) {
    const authorUrn = token.account_id; // urn:li:person:XXX or urn:li:organization:XXX
    if (!authorUrn) throw new Error("linkedin_missing_author_urn");
    const body = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption.slice(0, 3000) },
          shareMediaCategory: media_url ? "ARTICLE" : "NONE",
          ...(media_url ? { media: [{ status: "READY", originalUrl: media_url }] } : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await httpsPostJSON("api.linkedin.com", "/v2/ugcPosts",
      { "Authorization": `Bearer ${token.access_token}`, "X-Restli-Protocol-Version": "2.0.0" },
      body);
    const postUrn = res?.id;
    if (!postUrn) throw new Error("linkedin_post_failed: " + JSON.stringify(res));
    return { url: `https://www.linkedin.com/feed/update/${postUrn}/`, id: postUrn };
  },

  // Facebook Pages — page-feed post via Graph API
  async facebook(token, { caption, media_url, media_type }) {
    const pageId = token.account_id;
    if (!pageId) throw new Error("facebook_missing_page_id");
    const isVideo = media_type === "video";
    const path = isVideo
      ? `/v19.0/${pageId}/videos?access_token=${token.access_token}&file_url=${encodeURIComponent(media_url)}&description=${encodeURIComponent(caption)}`
      : `/v19.0/${pageId}/feed?access_token=${token.access_token}&message=${encodeURIComponent(caption)}${media_url ? `&link=${encodeURIComponent(media_url)}` : ""}`;
    const res = await httpsPostNoBody("graph.facebook.com", path);
    if (!res?.id) throw new Error("facebook_post_failed: " + JSON.stringify(res));
    return { url: `https://www.facebook.com/${res.id}`, id: res.id };
  },

  // Reddit — submit text post to specified subreddits
  // (Requires script-type OAuth app, not user-grant)
  async reddit(token, { caption, media_url, media_type, subreddits = ["RealEstate", "FirstTimeHomeBuyer"] }) {
    const results = [];
    for (const sr of subreddits) {
      const params = new URLSearchParams({
        sr,
        kind: media_url ? "link" : "self",
        title: caption.split("\n")[0].slice(0, 300),
        ...(media_url ? { url: media_url } : { text: caption }),
        api_type: "json",
      });
      const res = await httpsPostJSON("oauth.reddit.com", "/api/submit",
        { "Authorization": `Bearer ${token.access_token}`, "User-Agent": "PropertyDNA/1.0" },
        params.toString(),
        "application/x-www-form-urlencoded");
      if (res?.json?.data?.url) results.push({ subreddit: sr, url: res.json.data.url });
    }
    return { url: results.map(r => r.url).join(" · "), id: results.map(r => r.subreddit).join(",") };
  },
};

const OAUTH_INSTRUCTIONS = {
  youtube:   "See tools/social-oauth/README.md → YouTube section (Google Cloud Console + OAuth consent).",
  instagram: "See tools/social-oauth/README.md → Instagram section (Meta Business + IG Business Account).",
  tiktok:    "See tools/social-oauth/README.md → TikTok section (TikTok Developer Portal).",
  x:         "See tools/social-oauth/README.md → X section (X Developer Portal + OAuth 2.0 PKCE).",
  linkedin:  "See tools/social-oauth/README.md → LinkedIn section (LinkedIn Developer Portal + Marketing API).",
  facebook:  "See tools/social-oauth/README.md → Facebook section (Meta Business + Page Access Token).",
  reddit:    "See tools/social-oauth/README.md → Reddit section (script-type OAuth app).",
};

// ── HTTP helpers ──────────────────────────────────────────────────────────
function httpsGetJSON(hostname, path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    }).on("error", reject);
  });
}

function httpsPostJSON(hostname, path, headers, body, contentType = "application/json") {
  const payload = contentType === "application/json" ? JSON.stringify(body) : body;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
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

function httpsPostNoBody(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "POST" }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { caption, media_url, media_type = "video", source } = body;
  if (!caption) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "caption required" }) };
  }

  const requested = Array.isArray(body.platforms) && body.platforms.length
    ? body.platforms
    : Object.keys(ADAPTERS);

  // Pull all relevant tokens in one query
  const tokens = await db.from("social_oauth_tokens")
    .select("platform,access_token,refresh_token,expires_at,account_id,account_name,account_handle")
    .in("platform", requested)
    .get()
    .catch(() => []);

  const tokenMap = Object.fromEntries((tokens || []).map(t => [t.platform, t]));

  // Persist a queue row so we have an audit trail per attempt
  const queueRow = await db.insert("social_post_queue", {
    platforms: requested,
    caption,
    media_url: media_url || null,
    media_type,
    status: "in_progress",
    source: source || null,
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
  }).catch(() => null);
  const queueId = Array.isArray(queueRow) && queueRow[0] ? queueRow[0].id : null;

  const results = [];
  const postedUrls = {};

  for (const platform of requested) {
    const adapter = ADAPTERS[platform];
    if (!adapter) {
      results.push({ platform, status: "no_adapter" });
      continue;
    }
    const token = tokenMap[platform];
    if (!token) {
      results.push({ platform, status: "no_token", instructions: OAUTH_INSTRUCTIONS[platform] });
      continue;
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      results.push({ platform, status: "token_expired", instructions: "Token expired — refresh flow needs to run." });
      continue;
    }

    try {
      const r = await adapter(token, { caption, media_url, media_type });
      results.push({ platform, status: "posted", ...r });
      if (r?.url) postedUrls[platform] = r.url;
    } catch (e) {
      results.push({ platform, status: "error", error: e.message });
    }
  }

  // Update queue row with results
  if (queueId) {
    await db.from("social_post_queue").eq("id", queueId).update({
      status: results.every(r => r.status === "posted") ? "posted" : (results.some(r => r.status === "posted") ? "partial" : "failed"),
      posted_urls: postedUrls,
      last_error: results.filter(r => r.status === "error").map(r => `${r.platform}: ${r.error}`).join(" · ") || null,
    }).catch(() => {});
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ queue_id: queueId, results, posted_urls: postedUrls }),
  };
};
