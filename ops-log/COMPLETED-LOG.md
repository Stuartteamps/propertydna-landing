# Completed Log — newest first

See `README.md` for the status taxonomy. **No entry is ✅ LIVE without a Verify command + observed result.**

---

## 2026-05-28 (afternoon) — luxury image pipeline + DB incident

### gpt-image-1 image service — ✅ LIVE
`tools/image-gen/` (Dan's spec): `createSocialImage()` on gpt-image-1, quality high,
sharp→JPEG resize for email/IG-safe sizes. Local-only (key in tools/image-gen/.env, NOT Netlify).
- **Verify:** `cd tools/image-gen && npm run test` → writes a luxury JPEG to generated/.

### Newsletter luxury images, CDN-hosted + content-matched — ✅ LIVE
4 images (weather/events/west/east valley) generated, each matched to its section copy,
served from Netlify CDN. send-cc-newsletter.js repointed off dead Supabase Storage.
- **Verify:** `for i in weather events west-valley east-valley; do curl -s -o /dev/null -w "%{http_code}\n" https://thepropertydna.com/social/newsletter/latest-$i.jpg; done` → all 200.
- **Observed:** 100/106/80/79 KB, all HTTP 200 image/jpeg.

### Newsletter preview to stuartteamps@gmail.com — ✅ LIVE
Fixed a 403 bug: preview path sent FROM the gmail CC sender (Resend rejects gmail.com);
switched to verified SENDER_RESEND. Preview delivered.
- **Verify:** `curl -s "https://thepropertydna.com/.netlify/functions/send-cc-newsletter?testEmail=stuartteamps@gmail.com"` → `status:200` + resend_id.

### Today's social post image (celebrity provenance series 5/28–5/31) — ✅ LIVE (5/28, 5/29 deployed)
gpt-image-1 portrait heroes matched to each post; wired into content-calendar.json.
- **Verify:** `curl -s -o /dev/null -w "%{http_code}\n" https://thepropertydna.com/social/photo/2026-05-28.jpg` → 200.

### Supabase DB outage (IO-budget wedge) — ✅ RESOLVED
DB returned 522/timeout on all queries (core product down). Not local indexers this time.
Dan upgraded compute tier → instance restarted → recovered.
- **Verify:** `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" "https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/newsletter_links?select=id&limit=1" -H "apikey:$SK" -H "Authorization:Bearer $SK"` → 200 in <1s.

### Auto-send paused + full send held — ⚠️ INTENTIONAL HOLD
4:20PM cron disabled in netlify.toml; full-list send waits for Dan's approval.

### 🔴 BLOCKED — CC re-authorization needed for full send via Constant Contact
CC access token expired during the outage AND the refresh token is invalid (`invalid_grant`).
Full send currently would fall back to Resend (different sender/list). For the warmed CC list,
Dan must re-authorize once at `https://thepropertydna.com/.netlify/functions/cc-oauth-start`.

### ⬜ TODO — newsletter_links freshness
FlexMLS links in table are from 2026-05-14 (E0wo8/E0wsU/E0wr2). Confirm these are THIS week's
or update via update-newsletter-links before full send.

---

## 2026-05-28 (morning)

### Social post image URLs (www → canonical) — ✅ LIVE
The 301-redirecting `www.thepropertydna.com` image URLs broke IG/YouTube media fetch.
All `image` fields in the posting calendar now use the canonical bare domain.
- **Verify:** `python3 -c "import json; d=json.load(open('tools/browser-agent/data/content-calendar.json')); print('broken www image fields:', sum(1 for p in d['posts'] if isinstance(p.get('image'),str) and 'www.' in p['image']))"`
- **Observed (2026-05-28):** `broken www image fields: 0` — 18 canonical, 14 empty (see below). Live images return HTTP 200 as real multi-MB JPEGs.

### Future social posts have NO image (2026-05-27 → 2026-06-09) — 🔴 BLOCKED
The "Strip recycled images" commit (d86620d) correctly removed reused/low-tier
photos for credibility, but left 14 upcoming posts with empty `image` fields.
They will post **text-only** until real luxury-tier images are assigned.
- **Blocker:** No `OPENAI_API_KEY` available to generate luxury images. See below.
- **Verify:** `python3 -c "import json; d=json.load(open('tools/browser-agent/data/content-calendar.json')); print('empty-image future posts:', sum(1 for p in d['posts'] if not p.get('image')))"`
- **Observed (2026-05-28):** `empty-image future posts: 14`.

### CC weekly newsletter — luxury images — ⚠️ DORMANT (was reported "done", it is NOT live)
Commit 8b5107f (2026-05-27) wrote the code to pull Architectural-Digest-style
DALL-E images for the West/East Valley listing blocks instead of stale CC PNGs.
**But that path only activates when `OPENAI_API_KEY` is set** (`send-cc-newsletter.js:138`,
`useAiImages = process.env.OPENAI_API_KEY ? true : false`). The key is **unset in
all Netlify contexts**, so the newsletter is silently using the fallback
`/social/photo/*.jpg` images — the recycled generic photos that undercut a $30M
luxury context. The Supabase Storage AI-image bucket also currently returns 544
DatabaseTimeout (residual from the 2026-05-27 IO incident).
- **Blocker:** `OPENAI_API_KEY` not set in Netlify (any context).
- **Verify key:** `netlify env:get OPENAI_API_KEY --context production`
- **Verify storage:** `curl -s -o /dev/null -w "%{http_code}\n" "https://neccpdfhmfnvyjgyrysy.supabase.co/storage/v1/object/public/newsletter-images/latest-west-valley.jpg"` (want 200, currently 544)
- **Observed (2026-05-28):** key `No value set in the production context`; storage `544`.
- **To make LIVE:** (1) add `OPENAI_API_KEY` to Netlify env, (2) run `generate-newsletter-images` once to populate the bucket, (3) confirm the 4 `latest-*.jpg` return 200, (4) send a test newsletter to self and eyeball the listing images.

### Ops tracking system (this folder) — ✅ LIVE
Created `ops-log/` with status taxonomy that forbids "done" without proof.
- **Verify:** `ls ops-log/` → `README.md  COMPLETED-LOG.md`
