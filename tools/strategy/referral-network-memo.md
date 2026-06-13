# Strategic Memo — Referral Network + Stale Listings + Agent Recruitment

Dan asked, in one message:
1. Run reports on stale listings → pitch listing agents the referral offer
2. Focus this per-club (Thunderbird, Vintage, Madison, Bighorn, etc.)
3. Scrape Realtor.com / Zillow / other to find out-of-area agents to mass-pitch
4. Recruit more agents
5. Hire a content/filming assistant
6. Include photos in reports

Here's how I'd handle each. Underline = the call I'd make if it were my company.

## 1. Stale-listing pitch — BUILT, ready to run

What shipped:
- **`desert-clubs/manifest.json`** — 20 major Coachella Valley clubs with per-club avg DOM thresholds, price bands, and "off-market propensity" tags.
- **`scan-stale-listings.js` cron (8 AM PDT daily)** — scans `property_master` for active listings per club, flags any past the club's threshold, upserts to `stale_listing_tracker`, sends you a daily digest email.
- **`pitch-stale-listing-agent.js` (manual trigger)** — sends the broker-to-broker pitch to a specific listing agent. Marks `pitched=true` so we don't double-pitch.
- **`/recruit` page** — agent applications land in `agent_referral_network`.

How I want the human-in-the-loop to work:
- Every morning at 8 AM PDT you get a digest email of newly-flagged stale listings, with the listing agent name + brokerage on each.
- You eyeball it and reply with which ones to pitch (or tag in our internal admin tool I'll build next).
- The pitch fires only on listings you approve. **Never blanket-blast** — that destroys broker reputation in a small market like the desert.

The pitch tone: peer-to-peer broker note, NOT consumer marketing. Co-listing or full referral with 25% standard. Reply-STOP language at the bottom (CAN-SPAM safe). Replies route to your Gmail.

## 2. Per-club focus — DONE in the manifest

Each of the 20 clubs has its own DOM threshold tuned to its tier. Stone Eagle has only 70 residences so its DOM threshold is 160 days; PGA West has 1,500 residences and 110 days. The scanner respects this.

Beyond stale-listing scanning, the manifest also unlocks:
- **Off-market matcher per club** — long-tenured owners get surfaced when a buyer searches that tier
- **/coverage/<club-slug> landing pages** (you already have the route — `coverage/:slug` — I can auto-generate 20 club pages this week)
- **Club-specific newsletter segments** — "Thunderbird Heights weekly" goes to people who saved a Thunderbird Heights property

If you want, I generate the 20 club landing pages tonight using the manifest.

## 3. Realtor.com / Zillow scraping — DO NOT do it that way

**Legal + practical answer:** both have ToS prohibiting automated scraping. They'll block our IP, send cease-and-desist, and the listing data they actually own is the IDX feed (not the underlying MLS records). Plus the data isn't even great — listing-agent email is masked by lead-gen forms on most listings.

**What to do instead — the smart play:**

Use RentCast (which we already pay for). RentCast has listing-agent contact info for every MLS listing in markets it covers. It's licensed. It's faster. It's how the scan-stale-listings cron already works.

For listings RentCast doesn't surface contact data on, here's the order of escalation:
- Check the listing's brokerage website — most agents publish their email
- Check their CalDRE record (public license registry has email for most agents)
- Use Apollo.io or Hunter.io ($30/mo) to enrich missing agent emails via business-email lookup (Apollo has 250M+ contacts including 1.4M+ real estate agents). This is the right tool for outreach — the data is licensed B2B, the workflow is legal, the deliverability is high.

I can wire Apollo enrichment into `pitch-stale-listing-agent.js` so when we hit a listing without an email on file, we auto-enrich before pitching. ~$30/mo unlocks the full out-of-area agent universe at scale.

**Mass email recommendation:** never blast. Even with legal contact data, blasting agents destroys your reputation in a market where you'll see them at lunch. The right cadence: **5-15 individual pitches per day**, fired from your Gmail (not from reports@), with a 1-line custom intro per agent referencing something specific about their listing. I'll wire the daily digest to give you a "Pitch this one" button per listing that fires from a Gmail draft (via Gmail API) — you hit send.

## 4. Agent recruitment — `/recruit?role=agent` built

The form captures: license, brokerage, years, specialty, why-interested. Inserts to `agent_referral_network`, notifies you, confirms applicant.

**Where to source applicants:**
- LinkedIn Sales Navigator filtered: real estate agents, 3-15 years experience, in: CA Coachella Valley + LA + SD + Bay Area + Phoenix (out-of-area is the wedge — they have listings here they can't service well)
- Compass agent directory + Sotheby's directory + Coldwell Banker top-producer list — the high-end agents who'd benefit from PropertyDNA's data layer
- Inman Connect event attendee lists
- Realtor association directories (NAR, CDAR — California Desert Association of Realtors)
- The agent_referral_network table I just built — any agent we pitched on a stale listing who responded positively becomes a recruitable lead

**Outreach cadence:** 10 personalized LinkedIn DMs/day. Same logic as the stale-listing pitch — never blanket-blast. I can auto-draft the DMs based on a recruit-target.json file you populate with names + brokerages.

## 5. Hire a content assistant — `/recruit?role=assistant` built

The form captures: portfolio URL, hours, can-film, can-edit, has-studio-space. Inserts to `kpi_events`, notifies you.

**Where to source candidates:**
- **Upwork + Fiverr Pro** — best for paid trial shoots. $25-50/hr range for skilled but not famous.
- **Local film school job boards** — Idyllwild Arts, Cal State San Bernardino film program, CSU Long Beach. Eager + cheap + competent.
- **r/VideoEditing + r/cinematography** — post a paid trial gig listing
- **Behance / Vimeo** — search "real estate video editor" by region
- **The Recruit page itself** — once it's live + has light social promotion, you'll get applicants

**Best automation for the role itself:**
- I draft the script (already done for the 5 in your filming kit)
- I generate the b-roll (heat map captures, dashboard videos, screenshots)
- I generate captions + thumbnails + SEO metadata
- **Assistant films you reading the punchlines + handles the edit-and-publish workflow**
- I publish auto-generated SEO blog posts that link to each video

That means the assistant only needs to be good at: shooting a clean 60-second take on a phone tripod with a lav mic, basic Capcut/Descript editing, and posting to YT/IG/TikTok. **NOT** writing scripts. NOT generating content ideas. Those are my job.

**Target compensation:** $25-40/hr part-time for the trial month, then $4-6K/mo for a 20-30 hr/week ongoing engagement once they've proven they ship cleanly.

## 6. Photos in reports — wiring next

Two paths:
- **RentCast photo URLs** — the API returns up to 12 photos per listing in the `photos` array. The save-report function already pulls these via the RentCast call; they're just not surfaced in the email template or report view. ~30 min of work to wire them in. Will ship this week.
- **MLS attachment passthrough** — for properties you list directly (open-house QR system), I'll add a `photos` field to `PropertyConfig` and a drop folder at `/public/property-photos/<slug>/`. You drop the listing photos, I pull them into the report email + the landing page.

## What I need from you to keep this moving

1. **Approve the stale-listing pitch tone** — read the template in `pitch-stale-listing-agent.js`. The voice is mine; the brand and license number need yours. Want me to soften, sharpen, or change anything?
2. **Apollo.io subscription decision** — $30/mo unlocks the agent-email enrichment at scale. Worth it.
3. **Reply on this memo with the parts you want me to ship next week.** My recommendation: photos in reports (this week) + 20 club landing pages (this week) + Apollo wiring (when you say go).

## What I'll do without asking

- Keep the daily mission report + EOD log firing
- Keep the stale-listing scanner running
- Keep the SEO content engine generating + auto-publishing
- Keep the Reddit monitor surfacing
- Keep the open-house cadence + watch-list diff running
- Process recruit applications as they come in (notify you instantly + auto-confirm applicants)

Save the humans. And the sell-side humans too.
