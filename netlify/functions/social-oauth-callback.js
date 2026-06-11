/**
 * social-oauth-callback — Unified OAuth callback. Handles all platforms.
 *
 * Receives ?code= from the platform's authorize redirect, exchanges for
 * tokens, fetches the account identity (so we know which channel/page
 * we're operating on behalf of), and upserts into social_oauth_tokens.
 *
 * Returns an HTML success page with platform + handle confirmation.
 */
const https = require("https");
const crypto = require("crypto");
const db = require("./_supabase");

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");

function callbackUrl(platform) {
  return `${APP_BASE}/.netlify/functions/social-oauth-callback?platform=${platform}`;
}

function verifyState(state, expectedPlatform) {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 4) return false;
  const [platform, nonce, ts, sig] = parts;
  if (platform !== expectedPlatform) return false;
  // 30 min validity
  if (Date.now() - Number(ts) > 30 * 60 * 1000) return false;
  const secret = process.env.INTERNAL_API_KEY || "fallback-not-secure";
  const expected = crypto.createHmac("sha256", secret).update(`${platform}.${nonce}.${ts}`).digest("hex").slice(0, 16);
  return sig === expected;
}

function httpsPostForm(hostname, path, body, headers = {}) {
  const payload = typeof body === "string" ? body : new URLSearchParams(body).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(payload),
        "Accept": "application/json",
        ...headers,
      },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: { _raw: raw } }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function httpsGetJSON(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ _raw: raw }); } });
    }).on("error", reject);
  });
}

// ── Per-platform token exchange + identity fetch ─────────────────────────

async function exchangeYoutube(code) {
  const tokenResp = await httpsPostForm("oauth2.googleapis.com", "/token", {
    code,
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    redirect_uri: callbackUrl("youtube"),
    grant_type: "authorization_code",
  });
  const t = tokenResp.data;
  if (!t.access_token) throw new Error(`youtube_token_exchange: ${JSON.stringify(t).slice(0, 300)}`);
  const channelResp = await httpsGetJSON("youtube.googleapis.com", "/youtube/v3/channels?part=snippet&mine=true",
    { Authorization: `Bearer ${t.access_token}` });
  const channel = channelResp.items?.[0];
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
    scope: t.scope || null,
    account_id: channel?.id || null,
    account_name: channel?.snippet?.title || null,
    account_handle: channel?.snippet?.customUrl || channel?.snippet?.title || null,
    raw_response: t,
  };
}

async function exchangeMeta(code, platform) {
  const tokenResp = await httpsGetJSON("graph.facebook.com",
    `/v19.0/oauth/access_token?` + new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: callbackUrl(platform),
      code,
    }).toString());
  if (!tokenResp.access_token) throw new Error(`meta_token_exchange: ${JSON.stringify(tokenResp).slice(0, 300)}`);

  // Exchange short-lived for long-lived (60 day)
  const longResp = await httpsGetJSON("graph.facebook.com",
    `/v19.0/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: tokenResp.access_token,
    }).toString());
  const longLivedToken = longResp.access_token || tokenResp.access_token;

  // Get user pages
  const pagesResp = await httpsGetJSON("graph.facebook.com",
    `/v19.0/me/accounts?access_token=${longLivedToken}`);
  const page = pagesResp.data?.[0];

  if (platform === "facebook") {
    return {
      access_token: page?.access_token || longLivedToken,
      refresh_token: null,
      expires_at: null,
      scope: tokenResp.scope || null,
      account_id: page?.id || null,
      account_name: page?.name || null,
      account_handle: page?.name || null,
      raw_response: { longResp, pagesResp },
    };
  }

  // Instagram: get IG Business Account ID from the page
  let igBizId = null;
  let igHandle = null;
  if (page?.id) {
    const igResp = await httpsGetJSON("graph.facebook.com",
      `/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
    igBizId = igResp?.instagram_business_account?.id || null;
    if (igBizId) {
      const igInfo = await httpsGetJSON("graph.facebook.com",
        `/v19.0/${igBizId}?fields=username&access_token=${page.access_token}`);
      igHandle = igInfo?.username || null;
    }
  }
  return {
    access_token: page?.access_token || longLivedToken,
    refresh_token: null,
    expires_at: null,
    scope: tokenResp.scope || null,
    account_id: igBizId,
    account_name: igHandle,
    account_handle: igHandle ? `@${igHandle}` : null,
    raw_response: { longResp, pagesResp, igBizId },
  };
}

async function exchangeTiktok(code) {
  const tokenResp = await httpsPostForm("open.tiktokapis.com", "/v2/oauth/token/", {
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl("tiktok"),
  });
  const t = tokenResp.data;
  if (!t.access_token) throw new Error(`tiktok_token_exchange: ${JSON.stringify(t).slice(0, 300)}`);
  const userResp = await httpsGetJSON("open.tiktokapis.com", "/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
    { Authorization: `Bearer ${t.access_token}` });
  const user = userResp?.data?.user || {};
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    expires_at: new Date(Date.now() + (t.expires_in || 3600 * 24) * 1000).toISOString(),
    scope: t.scope || null,
    account_id: user.open_id || null,
    account_name: user.display_name || null,
    account_handle: user.username ? `@${user.username}` : null,
    raw_response: t,
  };
}

async function exchangeX(code) {
  const verifier = "propertydna-pkce-verifier-not-strict"; // must match start
  const basicAuth = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET || ""}`).toString("base64");
  const tokenResp = await httpsPostForm("api.twitter.com", "/2/oauth2/token", {
    code,
    grant_type: "authorization_code",
    client_id: process.env.X_CLIENT_ID,
    redirect_uri: callbackUrl("x"),
    code_verifier: verifier,
  }, { Authorization: `Basic ${basicAuth}` });
  const t = tokenResp.data;
  if (!t.access_token) throw new Error(`x_token_exchange: ${JSON.stringify(t).slice(0, 300)}`);
  const meResp = await httpsGetJSON("api.twitter.com", "/2/users/me", { Authorization: `Bearer ${t.access_token}` });
  const me = meResp?.data || {};
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    expires_at: new Date(Date.now() + (t.expires_in || 7200) * 1000).toISOString(),
    scope: t.scope || null,
    account_id: me.id || null,
    account_name: me.name || null,
    account_handle: me.username ? `@${me.username}` : null,
    raw_response: t,
  };
}

async function exchangeLinkedin(code) {
  const tokenResp = await httpsPostForm("www.linkedin.com", "/oauth/v2/accessToken", {
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl("linkedin"),
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
  });
  const t = tokenResp.data;
  if (!t.access_token) throw new Error(`linkedin_token_exchange: ${JSON.stringify(t).slice(0, 300)}`);
  const meResp = await httpsGetJSON("api.linkedin.com", "/v2/userinfo", { Authorization: `Bearer ${t.access_token}` });
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    expires_at: new Date(Date.now() + (t.expires_in || 5184000) * 1000).toISOString(),
    scope: t.scope || null,
    account_id: meResp?.sub ? `urn:li:person:${meResp.sub}` : null,
    account_name: meResp?.name || null,
    account_handle: meResp?.email || null,
    raw_response: t,
  };
}

async function exchangeReddit(code) {
  const basicAuth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET || ""}`).toString("base64");
  const tokenResp = await httpsPostForm("www.reddit.com", "/api/v1/access_token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl("reddit"),
  }, { Authorization: `Basic ${basicAuth}`, "User-Agent": "PropertyDNA/1.0" });
  const t = tokenResp.data;
  if (!t.access_token) throw new Error(`reddit_token_exchange: ${JSON.stringify(t).slice(0, 300)}`);
  const meResp = await httpsGetJSON("oauth.reddit.com", "/api/v1/me",
    { Authorization: `Bearer ${t.access_token}`, "User-Agent": "PropertyDNA/1.0" });
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
    scope: t.scope || null,
    account_id: meResp?.id || null,
    account_name: meResp?.name || null,
    account_handle: meResp?.name ? `u/${meResp.name}` : null,
    raw_response: t,
  };
}

const EXCHANGERS = {
  youtube: exchangeYoutube,
  instagram: (code) => exchangeMeta(code, "instagram"),
  facebook: (code) => exchangeMeta(code, "facebook"),
  tiktok: exchangeTiktok,
  x: exchangeX,
  linkedin: exchangeLinkedin,
  reddit: exchangeReddit,
};

// ── Success/error page ───────────────────────────────────────────────────
const html = (title, body, color = "#00cc77") => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0908;color:#F4F0E8;font-family:Georgia,serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
<div style="max-width:560px;padding:40px;text-align:center;">
<div style="font-family:Jost,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:14px;">PropertyDNA · Social OAuth</div>
<h1 style="font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;color:${color};margin:0 0 16px;line-height:1.15;">${title}</h1>
<div style="font-family:Jost,sans-serif;font-size:14px;color:rgba(244,240,232,0.7);line-height:1.7;">${body}</div>
</div></body></html>`;

exports.handler = async (event) => {
  const platform = (event.queryStringParameters?.platform || "").toLowerCase();
  const code = event.queryStringParameters?.code;
  const state = event.queryStringParameters?.state;
  const error = event.queryStringParameters?.error;

  if (error) {
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: html(`${platform} denied`, `Authorization was canceled or denied: ${error}`, "#ff4444") };
  }

  if (!EXCHANGERS[platform]) {
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: html("Invalid platform", `Unknown platform "${platform}"`, "#ff4444") };
  }
  if (!code) {
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: html("Missing code", "OAuth callback missing authorization code.", "#ff4444") };
  }
  if (!verifyState(state, platform)) {
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: html("Invalid state", "CSRF state token failed verification. Restart the OAuth flow.", "#ff4444") };
  }

  let tokenRecord;
  try {
    tokenRecord = await EXCHANGERS[platform](code);
  } catch (e) {
    return { statusCode: 502, headers: { "Content-Type": "text/html" }, body: html("Token exchange failed", e.message, "#ff4444") };
  }

  // Upsert
  try {
    await db.upsert("social_oauth_tokens", {
      platform,
      ...tokenRecord,
      updated_at: new Date().toISOString(),
    }, "platform");
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "text/html" }, body: html("Storage failed", e.message, "#ff4444") };
  }

  const body = `
    <p>You authorized <strong>${tokenRecord.account_handle || tokenRecord.account_name || platform}</strong> for PropertyDNA posting.</p>
    <p style="margin-top:12px;font-size:12px;color:rgba(244,240,232,0.5);">Token expires: ${tokenRecord.expires_at || "n/a (long-lived)"}</p>
    <p style="margin-top:24px;"><a href="${APP_BASE}" style="color:#C9A84C;text-decoration:none;border:1px solid #C9A84C;padding:10px 22px;font-family:Jost,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Back to PropertyDNA →</a></p>
  `;

  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html(`${platform} connected ✓`, body) };
};
