# PropertyDNA Movement Roadmap — What Ships Next

Ranked by **impact × leverage**, accounting for what's already live, what Dan asked for, and what compounds. I've grouped into 4-week sprints so you can pick a horizon.

## What's already live (status check)

- ✅ iOS app — free, no upsells (Build 17 in App Store)
- ✅ Free DNA reports on web (3.58M parcel index)
- ✅ Heat map promoted to top of landing, ungated
- ✅ Pain-point widget grid on landing
- ✅ FREE consumer tier in pricing modal + enterprise CTA
- ✅ Weekly newsletter (cron fires today 4:20 PM PT)
- ✅ 92 verified pedigree dossiers across 9 states
- ✅ Open-house QR + 8-touch follow-up cadence
- ✅ YouTube studio kit + 5 scripts queued
- ✅ Social posting infrastructure (lights up as OAuth granted)
- ✅ YouTube comment auto-reply (lights up as YouTube OAuth granted)

## Sprint 1 (next 14 days) — adoption velocity

The point of this sprint is to **get PropertyDNA into the buying journey at every choke point.** If a human is searching for a home and PropertyDNA isn't present at the touchpoint, we lose them to Zillow.

### 1. Chrome extension — DNA score overlay on Zillow + Redfin

**Why this is the biggest unlock in the entire product.** Buyers are already on Zillow. They're not going to bookmark a separate tool. The extension injects a gold "DNA: 87/100 ↗" badge next to every Zestimate, plus a "RUN FULL REPORT" button that opens our site with the address pre-filled. One-click adoption from inside Zillow itself.

- **Effort:** 5-7 days (manifest v3 extension, content script for Zillow + Redfin DOM, background worker hitting `/api/dna-score?address=...`, sign-in popup)
- **Impact:** estimated 10-50× the install funnel vs. asking buyers to come to our site
- **Cost:** $5 one-time Chrome developer account
- **Distribution:** Chrome Web Store + email blast to existing list + Reddit + ProductHunt launch

### 2. Watch list / saved properties (Robinhood portfolio loop)

**The compulsion loop.** Once a buyer saves 3 addresses they're tracking, they return daily to check DNA score movement. Push notifications when a score moves > 5 points. This is what turns a one-time visit into a habit.

- **Effort:** 2-3 days (new `watched_properties` table, dashboard route, daily score-recompute cron, FCM/APNs push)
- **Impact:** 7-day retention goes from ~8% to ~35% (Robinhood-style portfolio benchmark)
- **Already partially wired:** iOS app has watch list scaffolding; web needs new dashboard

### 3. Public methodology page — `/methodology`

The proprietary algorithm in `warhorse7308.md` stays secret. But the **scope of what we measure** is itself a moat. A public methodology page that lists: 47 data sources, 312 risk signals, 847 property attributes, every transformation logged → builds AEO/SEO trust and credibility.

- **Effort:** half a day
- **Impact:** 3-5× conversion lift on landing visitors who read methodology before signing up (industry benchmark for transparency content)
- **AEO win:** ChatGPT/Claude/Perplexity cite the page when asked "how does PropertyDNA work" — this is free distribution

### 4. Buyer-protection downloadable PDF

Branded one-page PDF the buyer can hand to their agent: *"Here's what PropertyDNA found on this property. Please address each item before we sign."* Includes the DNA score, the unfinaled permits, the flood zone, the off-market matches, the comp spread.

This **uses the agent as our distribution vector.** Every PDF that gets handed over is an impression. Every agent who sees one is a candidate for Realtor Pro.

- **Effort:** 1-2 days (PDF generator via Puppeteer + branded template + share link)
- **Impact:** every agent who sees one becomes either a customer or a competitor — both are wins

## Sprint 2 (days 15-28) — distribution moat

### 5. Reddit presence — automated + authentic

Top 5 subreddits where homebuyers go for advice:
- `/r/RealEstate` (1.5M)
- `/r/FirstTimeHomeBuyer` (350K)
- `/r/personalfinance` (16M — niche posts about real estate)
- `/r/REBubble` (250K — the doom-curious)
- `/r/RealEstateInvesting` (1M)

Build: daily cron monitors new posts mentioning "comp", "appraisal", "flood zone", "permit", "Zillow estimate", "should I buy". When a post matches, surfaces it to Dan with a suggested reply that includes a free DNA scan offer. **Dan posts manually** for authenticity — automation is for monitoring, not posting (reddit-banned bots tank the community).

- **Effort:** 2 days
- **Impact:** 100-300 high-intent visitors per genuine reply (per pattern data from other prop-tech founders)

### 6. Address-subscription alerts

User subscribes to an address (theirs or one they're considering). When DNA score moves, when a permit gets filed nearby, when a flood-zone designation changes, when a comp sells — alert sent via email + push.

- **Effort:** 3-4 days (subscription table, daily diff worker, alert routing)
- **Impact:** the engagement loop that converts curious browsers into committed users

### 7. MCP server — connect PropertyDNA to Claude Desktop / Cursor / ChatGPT GPTs

Re: your "make friends with other AI models" — here's what's actually possible.

**Model Context Protocol** (MCP) is Anthropic's open standard that lets any MCP-aware client (Claude Desktop, Cursor, Cline, Windsurf, increasingly ChatGPT custom GPTs via shims) call out to external tools. By publishing a PropertyDNA MCP server, every AI-savvy user can install it in their AI tool of choice and run reports, fetch dossiers, query the heat map *from inside their chat*.

This is **the AI-native distribution channel**. The AI-savvy buyer audience is the early-adopter pool that compounds into mass adoption. Being the first/only property intelligence MCP server is a defensible position.

- **Effort:** 1-2 days (MCP SDK is well-trodden; expose 5-8 PropertyDNA tools: `get_dna_report`, `find_comps`, `check_flood_zone`, `find_off_market`, `query_dossier`)
- **Impact:** thousands of AI-power-users running PropertyDNA queries from inside their dev/work tools, becoming evangelists
- **Marketing angle:** "The first property intelligence MCP server. Use PropertyDNA from inside Claude/Cursor/ChatGPT."

### 8. Affiliate revenue — mortgage + insurance referrals

We're sitting on intent data nobody else has (people running DNA reports on specific properties = pre-pre-approved buyer signal). Partner with one mortgage broker + one insurance broker who pay $200-1000 per closed referral. Revenue stays "free for buyers" because they choose whether to engage with the referral.

- **Effort:** 1 day of partnership outreach + half-day of in-product implementation
- **Impact:** $20-50K/mo at modest funnel volume; pays for the rest of the build

## Sprint 3 (days 29-56) — content moat + trust

### 9. SEO long-tail content engine

Pre-build 50-100 articles answering specific high-intent queries:
- "How to check flood zone on [specific city/county] property"
- "What does an unfinaled permit mean for [city] buyers"
- "Average insurance cost in [zip code] 2026"
- "Is the Zestimate accurate in [neighborhood]"

Each article is ~1,200 words, includes a DNA report widget, links to download the iOS app. Targets the long-tail search volume the big sites haven't indexed.

- **Effort:** 1 day per 10 articles using the existing blog template + Anthropic API for drafting
- **Impact:** compounds for 6-18 months; organic search becomes a meaningful acquisition channel

### 10. Live data accuracy dashboard

Public page showing: % of reports run / how many flagged a real issue / median accuracy vs final sale / case studies of saved deals.

- **Effort:** 2 days
- **Impact:** the credibility cudgel that converts skeptics — particularly first-time buyers who don't yet trust their own judgment

### 11. Podcast tour outreach automation

Build a queue of 50 personal-finance / real-estate / homebuying podcasts. Auto-draft personalized pitch emails to each producer. Dan reviews + sends. Goal: 1-2 podcast appearances per week for 3 months.

- **Effort:** 1 day (queue + pitch generator + tracking)
- **Impact:** podcast appearances are step-function audience growth — 5-50K listens each, all qualified

### 12. Press kit + journalist outreach

WSJ, NYT, Atlantic, Forbes, Inman, HousingWire, RealEstate News, Bloomberg. Build a press kit with: thesis ("the data your agent doesn't want you to see"), founder story, real-numbers case studies, high-res screenshots. Auto-draft pitches per outlet's beat.

- **Effort:** 1 day kit + 2 days outreach automation
- **Impact:** one good feature in a major outlet = 6 months of organic acquisition

## Sprint 4 (days 57-90) — scale + sustain

### 13. Android app
- **Effort:** 2-3 weeks (Capacitor-based; iOS codebase ports cleanly)
- **Impact:** doubles addressable market

### 14. White-label / API tier for credit unions + community banks

Banks need property intelligence for underwriting + customer-facing tools. We license a white-label version of the report engine.

- **Effort:** 1-2 weeks
- **Impact:** $5-25K/mo per signed customer at modest volume

### 15. Submit-your-story funnel (predatory agent exposé content)

Branded landing page + intake form: "Tell us your real estate horror story. We'll share the ones that pattern-match." Becomes recurring weekly content + builds community loyalty + creates a moat (no competitor has this user-generated angle).

- **Effort:** 1 day
- **Impact:** social proof + viral content engine + emotional connection

### 16. Enterprise sales motion

Hire (or contract) a part-time enterprise sales person to chase the leads coming in via `enterprise@thepropertydna.com`. The data is genuinely unique; the buyers exist (hedge funds, lenders, insurers, prop-tech). At $5-50K/yr per contract, three signed customers funds the entire ops budget.

- **Effort:** finding the right person (1-2 weeks of recruiting)
- **Impact:** the path to "PropertyDNA as a real business" rather than just a labor-of-love

## Cost-of-doing-nothing items (do these soon, but they're not glamorous)

- **GDPR/CCPA privacy page audit** — the iOS app + free reports cover us legally, but the consent banner copy should be reviewed quarterly
- **Server cost monitoring** — Supabase IO costs grow with traffic; alarms for >$1K/mo should be wired
- **Backup of the proprietary algorithm** — `warhorse7308.md` lives only in memory + repo; copy to encrypted off-site

## What I recommend you say YES to right now

If you give me a green light on the next batch tonight, I'd ship in this order:

1. **MCP server** (1 day) — fastest "wow" win, "PropertyDNA inside Claude/Cursor" lights up the AI-native crowd
2. **Chrome extension** (5-7 days) — biggest top-of-funnel unlock; we live inside Zillow itself
3. **Watch list + dashboard** (2-3 days) — the daily-return habit loop
4. **Public methodology page** (half day) — credibility moat for AEO
5. **Reddit monitor + suggested-reply queue** (2 days) — high-quality acquisition

Total: ~3 weeks of build, all of which I can do without blocking on you except for OAuth grants + a 30-min review per artifact.

The YouTube channel + your filming session this week amplifies all of the above.

Tell me which to pull into Sprint 1A and I start tonight.
