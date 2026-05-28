# Completed Log — newest first

See `README.md` for the status taxonomy. **No entry is ✅ LIVE without a Verify command + observed result.**

---

## 2026-05-28

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
