/**
 * social-oauth-status — Read-only summary of social_oauth_tokens for
 * the admin UI. Returns per-platform: connected status, handle, expiry,
 * and whether the platform's CLIENT_ID env var is set.
 *
 * Owner-only — requires x-internal-key OR ?email=OWNER_EMAIL OAuth-auth.
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

const PLATFORMS = [
  { key: "youtube",   label: "YouTube",   client_env: "YOUTUBE_CLIENT_ID",   desc: "Channel posting + comment auto-reply" },
  { key: "instagram", label: "Instagram", client_env: "META_APP_ID",          desc: "Reels + image posting (Graph API)" },
  { key: "facebook",  label: "Facebook",  client_env: "META_APP_ID",          desc: "Page feed posting (same Meta app as IG)" },
  { key: "tiktok",    label: "TikTok",    client_env: "TIKTOK_CLIENT_KEY",    desc: "Video posting (Content Posting API)" },
  { key: "x",         label: "X (Twitter)", client_env: "X_CLIENT_ID",        desc: "Text + media posting (OAuth 2.0 PKCE)" },
  { key: "linkedin",  label: "LinkedIn",  client_env: "LINKEDIN_CLIENT_ID",   desc: "Member + organization posting" },
  { key: "reddit",    label: "Reddit",    client_env: "REDDIT_CLIENT_ID",     desc: "Post to subreddits + identity" },
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const ownerEmail = (process.env.OWNER_EMAIL || "stuartteamps@gmail.com").toLowerCase();
  const internalKey = event.headers["x-internal-key"];
  const emailParam = (event.queryStringParameters?.email || "").toLowerCase();
  const authorized = (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY)
                   || emailParam === ownerEmail;
  if (!authorized) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized — owner only" }) };
  }

  const tokens = await db.from("social_oauth_tokens")
    .select("platform,account_id,account_name,account_handle,scope,expires_at,updated_at,created_at")
    .get()
    .catch(() => []);
  const tokenMap = Object.fromEntries((tokens || []).map(t => [t.platform, t]));

  const status = PLATFORMS.map(p => {
    const tok = tokenMap[p.key];
    const clientIdSet = !!process.env[p.client_env];
    const expired = tok?.expires_at ? new Date(tok.expires_at) < new Date() : false;
    return {
      platform: p.key,
      label: p.label,
      desc: p.desc,
      client_env: p.client_env,
      client_id_set: clientIdSet,
      connected: !!tok && !expired,
      expired,
      account_handle: tok?.account_handle || null,
      account_name: tok?.account_name || null,
      account_id: tok?.account_id || null,
      scope: tok?.scope || null,
      expires_at: tok?.expires_at || null,
      updated_at: tok?.updated_at || null,
      created_at: tok?.created_at || null,
      connect_url: `/.netlify/functions/social-oauth-start?platform=${p.key}`,
      setup_doc: "tools/social-oauth/README.md",
    };
  });

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      platforms: status,
      summary: {
        connected: status.filter(s => s.connected).length,
        total: status.length,
        client_ids_configured: status.filter(s => s.client_id_set).length,
      },
    }),
  };
};
