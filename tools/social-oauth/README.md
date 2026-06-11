# Social OAuth Setup — Light Up Posting + Engagement

The infrastructure is built. `social-poster.js` will post to YouTube, Instagram, TikTok, X, LinkedIn, Facebook, and Reddit the moment OAuth tokens exist in `social_oauth_tokens`. `youtube-engagement.js` runs every 15 min and auto-replies to viewer comments once YouTube is wired.

Each platform takes **5-15 minutes** of clicking through their dev portal. After each, run the paste-token command at the bottom and that platform goes live.

---

## Common: where the tokens live

Tokens land in Supabase `social_oauth_tokens`:

| Column | What |
|---|---|
| `platform` | youtube · instagram · tiktok · x · linkedin · facebook · reddit |
| `access_token` | the API token |
| `refresh_token` | for re-auth after expiry (Google/Meta/LinkedIn have this) |
| `expires_at` | when access_token dies |
| `account_id` | platform-specific (channelId, IG Business ID, page ID, urn) |
| `account_handle` | display handle (@propertydna etc) |

Paste helper at the bottom of this doc inserts or updates a row.

---

## 1. YouTube (do this first — unlocks engagement automation)

**Effort:** 10 min · **Unlocks:** posting + comment auto-reply + scan-request alerts

### Steps in Google Cloud Console

1. Go to https://console.cloud.google.com — make sure you're using the PropertyDNA Google account (`stuartteamps@gmail.com`)
2. Top bar → **Select a project** → **NEW PROJECT** → name: `PropertyDNA-YouTube` → CREATE
3. Search bar → "YouTube Data API v3" → **ENABLE**
4. Left nav → **APIs & Services** → **OAuth consent screen** → **External** → CREATE
   - App name: `PropertyDNA`
   - User support email: `stuartteamps@gmail.com`
   - Developer contact: `stuartteamps@gmail.com`
   - Add scope: `https://www.googleapis.com/auth/youtube.force-ssl`
   - Add test user: `stuartteamps@gmail.com` (your channel-owner Google account)
5. Left nav → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: Web application
   - Name: `PropertyDNA YouTube`
   - Authorized redirect URI: `https://thepropertydna.com/.netlify/functions/youtube-oauth-callback`
   - CREATE → copy the **Client ID** and **Client Secret**

### Set Netlify env vars

```bash
netlify env:set YOUTUBE_CLIENT_ID "your-client-id" --scope functions
netlify env:set YOUTUBE_CLIENT_SECRET "your-client-secret" --scope functions
```

### Grant your channel access

Visit this URL in your browser (replace `CLIENT_ID`):

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=https://thepropertydna.com/.netlify/functions/youtube-oauth-callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.force-ssl&access_type=offline&prompt=consent
```

You'll be redirected back — the callback Netlify function captures the code + token + refresh_token and writes them to `social_oauth_tokens` automatically. (Callback function is the next thing I'll wire — for now, paste manually below.)

### Manual paste — if callback isn't built yet

The Google "authorized URL" above will end with `?code=4/0A...`. To exchange the code for tokens manually:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=YOUR_CODE_FROM_CALLBACK" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://thepropertydna.com/.netlify/functions/youtube-oauth-callback" \
  -d "grant_type=authorization_code"
```

Response gives you `access_token`, `refresh_token`, `expires_in`. Paste into `social_oauth_tokens` using the SQL at the bottom of this doc.

Also set:
```bash
netlify env:set YOUTUBE_CHANNEL_ID "UCxxxxxxxxxxxxxxxx"   # your channel ID
```

(Find your channel ID at https://www.youtube.com/account_advanced)

---

## 2. Instagram (Reels + image posts)

**Effort:** 15 min · **Unlocks:** Reels + carousel + story posting via Graph API

### Steps in Meta for Developers

1. Convert your IG account to a **Business** account (Settings → Account → Switch to professional)
2. Connect it to a Facebook Page (required by Graph API). New page is fine.
3. Go to https://developers.facebook.com/apps → **Create App** → **Business** → CREATE
   - Name: `PropertyDNA`
4. Add product: **Instagram Graph API**
5. Tools → Graph API Explorer → select your app → **User Access Token** → request these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_manage_posts`
6. Generate token → exchange for a long-lived token:
   ```bash
   curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
   ```
   Response is good for 60 days. We auto-refresh from there.
7. Get your IG Business Account ID:
   ```bash
   curl "https://graph.facebook.com/v19.0/me/accounts?access_token=YOUR_TOKEN"  # find page ID
   curl "https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=YOUR_TOKEN"  # find IG biz ID
   ```

Paste into `social_oauth_tokens` with `platform='instagram'`, `account_id=<IG_BUSINESS_ID>`.

---

## 3. TikTok

**Effort:** 15 min (+ 1-3 day review wait for direct-post scope) · **Unlocks:** Content Posting API

### Steps in TikTok Developer Portal

1. https://developers.tiktok.com → **Manage apps** → CREATE NEW APP
2. App name: `PropertyDNA` · Category: `Business Tools`
3. Add product: **Login Kit** + **Content Posting API**
4. Scopes:
   - `user.info.basic`
   - `video.publish` (requires audit — submit "I'm posting my own real-estate-education content")
5. Set redirect URI: `https://thepropertydna.com/.netlify/functions/tiktok-oauth-callback`
6. Copy Client Key + Client Secret

### Grant access

```
https://www.tiktok.com/v2/auth/authorize?client_key=CLIENT_KEY&scope=user.info.basic,video.publish&response_type=code&redirect_uri=https://thepropertydna.com/.netlify/functions/tiktok-oauth-callback&state=anything
```

Until direct-post is approved, the adapter uses `video.upload` (inbox) which posts to your TikTok drafts — you tap to publish from the app.

---

## 4. X (Twitter)

**Effort:** 10 min · **Unlocks:** text posts + media (separate upload flow for video)

### Steps in X Developer Portal

1. https://developer.x.com/portal → **Projects & Apps** → **Add app**
   - Plan: Free (1500 tweets/mo) is fine to start
2. App settings → **User authentication settings** → enable OAuth 2.0
   - Type: **Web app**
   - Permissions: **Read and write**
   - Callback URL: `https://thepropertydna.com/.netlify/functions/x-oauth-callback`
   - Website: `https://thepropertydna.com`
3. Copy **Client ID** + **Client Secret**

### Grant access (PKCE)

```
https://twitter.com/i/oauth2/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=https://thepropertydna.com/.netlify/functions/x-oauth-callback&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=x&code_challenge=challenge&code_challenge_method=plain
```

Token exchange yields access + refresh. Paste with `platform='x'`.

---

## 5. LinkedIn

**Effort:** 10 min (+ ~1 week review for marketing scope on real accounts; basic personal posting is instant)

### Steps in LinkedIn Developer Portal

1. https://www.linkedin.com/developers/apps → CREATE APP
2. Associate with your company page (`PropertyDNA`)
3. Products → request: **Share on LinkedIn** (instant) + **Sign In with LinkedIn using OpenID Connect**
4. Auth tab → redirect URL: `https://thepropertydna.com/.netlify/functions/linkedin-oauth-callback`
5. Copy Client ID + Secret

### Grant access

```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=CLIENT_ID&redirect_uri=https://thepropertydna.com/.netlify/functions/linkedin-oauth-callback&scope=openid%20profile%20email%20w_member_social&state=li
```

Get your URN:
```bash
curl -H "Authorization: Bearer TOKEN" https://api.linkedin.com/v2/userinfo
# sub = your member URN
```

Paste with `platform='linkedin'`, `account_id='urn:li:person:YOUR_SUB'`.

---

## 6. Facebook (Page posts)

**Effort:** included in IG setup above · **Unlocks:** Page feed + Page videos

### Reuse the Meta app from #2

After IG setup, request scopes:
- `pages_manage_posts`
- `pages_show_list`
- `publish_video`

Get a **Page Access Token** (separate from User Token):
```bash
curl "https://graph.facebook.com/v19.0/PAGE_ID?fields=access_token&access_token=YOUR_USER_TOKEN"
```

The Page Access Token doesn't expire if generated from a long-lived user token. Paste with `platform='facebook'`, `account_id=<PAGE_ID>`.

---

## 7. Reddit

**Effort:** 5 min · **Unlocks:** post to subreddits

### Steps

1. https://www.reddit.com/prefs/apps → **create another app**
2. Type: **script** (server-to-server, no user OAuth needed)
3. Redirect URI: `http://localhost` (placeholder, not used for script type)
4. Note client ID (under name) + secret

### Get token

```bash
curl -X POST -d "grant_type=password&username=YOUR_REDDIT_USERNAME&password=YOUR_REDDIT_PASSWORD" \
  --user "CLIENT_ID:SECRET" \
  -A "PropertyDNA/1.0 by YOUR_USERNAME" \
  https://www.reddit.com/api/v1/access_token
```

Response gives `access_token` good for 1 hour. Refresh by re-running the call. Adapter handles refresh.

Paste with `platform='reddit'`, no `account_id` needed.

---

## Paste helper — insert/update a token row

Use the Supabase Management API (PAT in keychain):

```bash
SBP=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w | sed 's|go-keyring-base64:||' | base64 -d)

curl -X POST "https://api.supabase.com/v1/projects/neccpdfhmfnvyjgyrysy/database/query" \
  -H "Authorization: Bearer $SBP" \
  -H "Content-Type: application/json" \
  -d '{"query": "INSERT INTO social_oauth_tokens (platform, access_token, refresh_token, expires_at, scope, account_id, account_handle) VALUES ('\''youtube'\'', '\''ACCESS_TOKEN'\'', '\''REFRESH_TOKEN'\'', NOW() + INTERVAL '\''1 hour'\'', '\''youtube.force-ssl'\'', '\''UCxxxxxxxx'\'', '\''@PropertyDNA'\'') ON CONFLICT (platform) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = COALESCE(EXCLUDED.refresh_token, social_oauth_tokens.refresh_token), expires_at = EXCLUDED.expires_at, updated_at = NOW();"}'
```

Confirm:

```bash
curl -X POST "https://api.supabase.com/v1/projects/neccpdfhmfnvyjgyrysy/database/query" \
  -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  -d '{"query":"SELECT platform, account_handle, expires_at, updated_at FROM social_oauth_tokens ORDER BY updated_at DESC;"}'
```

---

## Test a single platform

Once a token is in, smoke-test:

```bash
INTERNAL_KEY=$(netlify env:get INTERNAL_API_KEY)

curl -X POST https://thepropertydna.com/.netlify/functions/social-poster \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_KEY" \
  -d '{
    "platforms": ["x"],
    "caption": "Smoke test from PropertyDNA — the data your agent does not want you to see. https://thepropertydna.com",
    "media_type": "text"
  }'
```

Response per platform: `posted` (✅), `no_token` (not wired yet), `token_expired` (refresh needed), `error` (with message).

---

## What I'll build next (Phase 3)

- OAuth callback Netlify functions (one per platform) so the manual paste step goes away
- Auto-refresh worker that runs nightly to keep tokens warm
- Cross-post worker that picks pending `social_post_queue` rows and fires `social-poster` for each scheduled run
- "Smart hashtag" function that pulls trending tags per platform per topic
