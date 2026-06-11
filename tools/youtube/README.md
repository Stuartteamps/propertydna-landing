# PropertyDNA YouTube Studio

Mission-aligned content pipeline for the "save the humans from asymmetric data + predatory agents" movement.

## Channel positioning

**Channel name:** PropertyDNA · Save the Humans
**Handle:** @PropertyDNAOfficial (try first; fallbacks below if taken)
**Cross-post handles to lock in:** TikTok, Instagram, Threads, X, YouTube Shorts
**Bio (180 char):**

> The data your real estate agent doesn't want you to see. Free for buyers, forever. 3.58M properties indexed. Run a DNA report on any address — link below.

**Long description:**

> PropertyDNA is the institutional-grade property intelligence platform homebuyers were never supposed to have. We give you the same data the agent on the other side of the table has — valuation, flood zone, permit history, comparable trajectory, climate risk, and a buy/hold/walk verdict — for free, on demand, before you sign.
>
> Every week we run the algorithm on real listings. We surface what the agent skipped. We expose how comps get cherry-picked. We name the predatory patterns. And we hand the data to you, the buyer, so you stop overpaying.
>
> Free iOS app. Free web reports. No tracking. No upsells. We make money from the realtors, lenders, and enterprises who use our data — so it stays free for the humans.
>
> Run a free DNA report on any address: thepropertydna.com
> Download the iOS app: thepropertydna.com/app

## Visual identity

- **Channel banner:** Black background (#0A0908), gold accent (#C9A84C), Cormorant Garamond serif "PropertyDNA" + Jost sans tagline "save the humans"
- **Thumbnail style:** High-contrast, single-property hero shot, golden DNA score badge overlaid, red callouts for the "hidden" finding (e.g. "AGENT HID THIS"). Always 1280×720.
- **Lower thirds:** Sparse. Address + DNA score + city/state. Same Cormorant + Jost as the site.
- **Color palette per video type:**
  - Pain-point/exposé → red callouts, dark bg
  - Educational → gold + canvas
  - Off-market drops → blue/gold
  - Live scans → green tickers

## Content cadence (target: 90-day compound)

| Type | Frequency | Length | Channels |
|------|-----------|--------|----------|
| Long-form deep-dive | 1/week | 8-12 min | YouTube main |
| Shorts (single pain point) | 5/week | 45-60s | YT Shorts, TikTok, IG Reels, Threads |
| Live scan | 1/week | 30-45 min | YouTube live + clip extraction |
| Reactive (news) | as breaks | 60-90s | All channels |

## Production pipeline

1. **Topic queued** in `tools/youtube/queue/` (this folder). Each script is a self-contained `.md` file: hook, body, b-roll plan, suggested punchline for Dan to record (or text-on-screen alternative).
2. **Data pulled** automatically — DNA report on the subject property, comp table, permit history, hazard layer screenshots.
3. **B-roll generated** — heat map captures, dashboard recordings, comp visualizations. Stored in `tools/youtube/broll/<slug>/`.
4. **Dan records punchlines** — 30-60s on-camera segments. Quiet room, vertical for Shorts, horizontal for long-form. Single light source. Phone is fine.
5. **Assembly** — Descript or CapCut. Template provided in `tools/youtube/templates/`.
6. **Cross-post** — single source clip → YouTube + Shorts + TikTok + IG Reels via Buffer/Hootsuite (or manual until automation lands).
7. **Engagement** — auto-reply to comments mentioning "how", "where", "app" with App Store link.

## Engagement automation (to build)

- Comment auto-reply via YouTube Data API v3 (oauth required)
- Auto-DM new YouTube subscribers with welcome + first-report walkthrough
- Newsletter pulls top weekly YouTube comment as social proof
- Auto-cross-post via Buffer API (or manual phase-1)

## Week-1 plan

Day 1 (today):
- Lock channel names + create accounts on YT, TikTok, IG, Threads
- Set channel banner + bio across all four
- Review and edit the 5 scripts in `tools/youtube/queue/`

Day 2-3:
- Dan records 5× 45-90s punchline segments (5 Shorts + intro for long-form)
- I pull all data + capture all b-roll
- I assemble script #1 as a full long-form rough cut

Day 4-5:
- Final cut on long-form
- Cross-post first 5 Shorts (one per day for the week)

Day 6-7:
- Monitor engagement, reply to comments
- Queue next 5 scripts based on what hooked

## Topic backlog (priority order)

1. ✅ `01-thunderbird-2.999m-vs-thunderbird-3.895m.md` — comparable-luxury deep dive
2. ✅ `02-florida-hurricane-insurance-collapse.md` — timely, rides today's blog post
3. ✅ `03-how-agents-cherry-pick-comps.md` — exposé/pain-point
4. ✅ `04-three-lies-on-every-zillow-estimate.md` — high-CTR thumbnail bait
5. ✅ `05-the-permit-history-trick.md` — actionable hack
6. `06-coachella-valley-weekly-scan.md` — recurring series template
7. `07-predatory-agent-stories-submit-yours.md` — viewer-generated funnel
8. `08-rancho-mirage-2026-summer-buyer-window.md` — local angle

The 5 with checkmarks are queued in `queue/` as production-ready scripts.
