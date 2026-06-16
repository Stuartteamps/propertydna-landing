# Completed Log — newest first

See `README.md` for the status taxonomy. **No entry is ✅ LIVE without a Verify command + observed result.**

---

## 2026-05-29 — gate, pivot, and an important miss

### Email gate on /pedigree-index — ✅ LIVE
Soft gate: tier counts (50/1,322/5,134/10,282), architect cards, and 3 teaser dossiers visible to all. Rest unlocks after email. localStorage remembers it. capture-pedigree-lead function persists to campaign_contacts.metadata, honors suppression list.
- **Verify:** load /pedigree-index in a fresh browser → see gate; submit email → unlocks + saved to DB.

### Social CTA pivot to link-in-bio — ✅ LIVE (5/30 → 6/9)
Diagnosed: @danielstuartps is a **personal IG account**, so Meta's Instagram Messaging API is blocked — no third-party tool (ManyChat, n8n, custom webhook) can ever auto-DM. All 11 upcoming CTAs swapped from "Comment KEYWORD → DM" to "Comment KEYWORD below — and the dossier is in my bio." Preserves comment-boost; routes conversion through the bio link.
- ⬜ Dan to convert IG → Creator (60-sec free unlock) when ready; ManyChat webhook activates the moment he does.
- ⬜ Dan to update IG bio link to thepropertydna.com/pedigree-index by ~8 PM tonight.

### Scott Foster — ✅ removed everywhere
2 dupes deleted from campaign_contacts; already in campaign_unsubscribes since 2026-05-20; not in CC list. Won't get next week's newsletter.

### 🔴 CRITICAL FIND — campaign_unsubscribes never syncs to Constant Contact
3,305 unsubscribed emails in our DB, but the CC contact list doesn't know. So someone who unsubscribes via our website still gets CC newsletters until CC's own list management catches them. Real CAN-SPAM exposure. Tracked as task #14.

### Newsletter postflight monitor — ✅ FIXED
The Friday postflight cron was 400-ing every week (column-name mismatch: queried `kpi_events.event/payload`, real columns are `event_type/metadata`). Fixed + deployed; next Friday it'll actually run.

---

## 2026-05-28 (late) — DM conversion play, pedigree-index, nationwide gap

### "VERIFIED" DM reply + conversion play — ✅ DELIVERED (manual), 🔴 automate next
Emailed Dan a paste-ready DM reply: tease marquee verified estates → gate full list behind
PropertyDNA signup (thepropertydna.com/pedigree-index) → "run a report on any home" CTA →
engagement question. Honest numbers only (17 verified, 16,788 classified — NOT the post's "53").
- **ManyChat auto-DM** (task #11): webhook ✅ LIVE + verified (smoke test HTTP 200 returns the 17-celebrity teaser + "See the full index" button + lead_celebrity tag, deploy 6a190dda). ⚠️ DORMANT until Dan does the 5-min ManyChat UI: build 2 automations (trigger = Comment on post w/ keyword VERIFIED → DM commenter; and User sends message w/ keyword VERIFIED), each an External Request POST to /.netlify/functions/manychat-webhook with header `x-manychat-token`, body `{"message_text":"VERIFIED","platform":"ig","subscriber_id":"{{subscriber_id}}"}`, "Use response as messages" ON. Full guide: automation-workflows/manychat-dm-qualifier.md
  - **Verify webhook:** `curl -s -X POST https://thepropertydna.com/.netlify/functions/manychat-webhook -H "x-manychat-token: <token>" -d '{"message_text":"VERIFIED","platform":"ig"}'` → v2 block with pedigree-index button.

### /pedigree-index "0 properties" — ✅ RESOLVED (was the DB outage, not a bug)
Verified live via headless load: page shows 16,788 CV properties + A/B/C/D tiers + neighborhoods.
The emptiness Dan saw was during the 522 DB outage; recovered after the compute upgrade.
- **Verify:** load https://thepropertydna.com/pedigree-index → shows tier counts + dossier cards.

### Nationwide luxury coverage — ⬜ TODO (real gap, task #12)
Pedigree/dossier data is Coachella-Valley-only (Palm Springs/Rancho Mirage/Cathedral City).
Malibu, Miami, Palm Beach, Paradise Valley, Phoenix have NO pedigree data → the index is CV-only.
Dan wants the VERIFIED link to work for any luxury market. Requires classifying those markets.

---

## 2026-05-28 (evening) — newsletter SENT, social unblocked, list hygiene

### Weekly newsletter SENT via Constant Contact — ✅ DONE
Dan approved (Go-2 framing). Sent via CC (not Resend fallback), so [[FIRSTNAME]]
personalizes natively. Live RentCast market snapshot + new FlexMLS links + 4 luxury images.
- CC campaign `03b169d0-0e35-4fc5-abf7-a389c4956ea6`, activity `6799a330`.
- Note: sent immediately on Dan's "go" rather than the 4:20 slot — future sends should schedule for 4:20.

### Social posting blackout (5 days dark) — ✅ FIXED
Root cause: Buffer GraphQL schema error (`Field "images" is not defined`) → 0/7 for days;
then today's 7AM run skipped IG/TikTok because images weren't generated yet. Re-ran after
images live → **6/7 channels posted** incl. Instagram (instagram.com/p/DY5bgW0FIvE) + TikTok.
YouTube skips (needs video — expected).
- **Verify:** `cd tools/browser-agent && node agents/buffer.js`

### Email list hygiene — ✅ 263 junk removed
Scraped automated/transactional senders (Meta, Fidelity, Equifax, Capital One, BofA, Zillow,
PlayStation, etc.) were in campaign_contacts. Removed 263 + added to campaign_unsubscribes.
Discriminator: brand subdomains (@mail.X.com / @email.X.com) + role prefixes (do_not_reply,
reply-<hash>, invoice+statements, customer.service, alerts@). Kept real @mail.com/@email.com.
- ⬜ TODO: these 263 are likely also in the CC list (where sends go). CC auto-suppresses hard
  bounces; a CC-API scrub of the role/auto-reply ones (which don't bounce) is the next step.

### CC re-authorized — ✅ DONE
Access + refresh tokens died in the outage. Dan re-authed via cc-oauth-start?key=… → fresh
token saved (24h). Future: a working keyed re-auth link is required (plain link 401s).

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

### East Coast / mid-Atlantic indexers — ✅ LIVE (2026-06-15)
Five new ArcGIS-backed indexers shipped to fill zero-state gaps post the
2026-05-27 IO incident. Compute upgraded; IO budget now allows staggered runs.
- **Files:** `netlify/functions/index-{tennessee,massachusetts,maryland,dc,georgia}.js`
- **Crons (UTC, staggered every 4h to spread IO load):** TN 02:15, MA 06:15, MD 10:15, DC 14:15, GA 18:15, NY 22:15. `timeout = 26s` each.
- **Endpoint inventory (all verified live with count queries before code shipped):**
  - TN-Davidson: maps.nashville.gov Cadastral_Layers (286k)
  - TN-Williamson: services1.arcgis.com/qTQ6qYkHpxlu0G82 kx_williamson (100k)
  - TN-Sumner/Cheatham: TN State Public Use (108k boundary-only)
  - MA: MassGIS L3 Property Tax Parcels statewide (180k Boston alone)
  - MD-Anne Arundel: gis.aacounty.org Planning OpenData (267k)
  - MD-Baltimore Co: bcgis.baltimorecountymd.gov Property/Property (375k)
  - DC: maps2.dcgis.dc.gov DCGIS_DATA Common Ownership Layer (133k)
  - GA-Fulton: AQDHTHDrZzfsFsB5 Tax_Parcels2020 (358k)
  - GA-DeKalb: dcgis.dekalbcountyga.gov TaxParcels (246k)
  - GA-Atlanta-City: gis.atlantaga.gov DPCD TaxParcel (171k)
- **Endpoints that 404'd → fallback path:**
  - MD-Montgomery / MD-Howard: no open ArcGIS layer with assessment data — deferred to SDAT API integration (separate task).
  - GA-Cobb / GA-Gwinnett: county GIS portals require login or expose parcel boundaries without owner/value — DeKalb + Fulton + Atlanta cover the same metro.
  - TN statewide layer is missing Davidson/Williamson/Shelby/Knox/Hamilton (the big metros) — pulled those from county-specific sources instead.
- **Smoke test (`dryRun:true, batchSize:50`):** all 5 fetched real attributes from the live source, 0 errors.
- **Real run (`batchSize:1000`) tonight:** TN +1000, MA +1000, MD +797, DC +1000, GA +1000 = **+4,797 rows** added to `property_master` (from 0 across all 5 states pre-tonight).
- **Verify counts (current):**
  ```
  curl -s "https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/property_master?state=eq.TN&select=apn" -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Prefer: count=exact" -H "Range: 0-0" -I | grep content-range
  ```
  → TN 1000, MA 1000, MD 797, DC 1000, GA 1000 (verified 2026-06-15).
- **Known issue, fixed in flight:** MD source returns duplicate APNs (condo sub-parcels). Added `dedupeByApn()` to all 5 indexers — same dataset shape pattern across all ArcGIS sources.
- **Resume / advance:** each cron call advances one batch via saved offset in `kpi_events` (`${state}_index_progress`). Will compound to ~70k rows/day across all 5 states once steady-state. Full coverage of Atlanta-metro + Boston-metro + Davidson + DC + AA/Baltimore expected in 3-4 weeks of cron runs.
