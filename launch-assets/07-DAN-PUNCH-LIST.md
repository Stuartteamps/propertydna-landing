# DAN — MORNING PUNCH LIST

What was done autonomously while you slept vs what needs you in the morning. Sorted by impact.

---

## DONE — fully live in production right now

Verified live as of 2026-06-10 commit `b8b26cd`:

- All web rebrand changes (Realtor Pro $149 + Investor $299)
- `/launch` page + `/press/ios-launch` press release
- 5 mission-driven SEO blog posts
- 12 city coverage landing pages (`/coverage/palm-springs-ca` etc.)
- Apple Smart App Banner meta (Safari iOS shows native install banner)
- `AppStoreBanner` sticky CTA (Chrome iOS / Android / desktop)
- `ShareCTA` component on launch page
- AEO JSON-LD graph (Organization + MobileApplication + WebSite + FAQPage)
- Mission-led About page rewrite
- Nav + Footer iOS App links
- `apple-touch-icon.png` (180×180)
- Sitemap.xml updated with 19 new URLs

## DONE — broadcasts already fired

- **28 press pitches** sent via Resend to verified public tip lines from `daniel@mail.thepropertydna.com` (replies → `stuartteamps@gmail.com`):
  - Wave 1 (8): TechCrunch, The Verge, 9to5Mac, MacRumors, AppleInsider, Inman, HousingWire, The Real Deal
  - Wave 2 (8): Cult of Mac, Fast Company, Bisnow, Desert Sun, Axios, CNBC, USA Today, RealTrends
  - Wave 3 (12): MarketWatch, NerdWallet, Consumer Reports, LA Times, NYT Real Estate, Sun-Sentinel, LoHud, BiggerPockets, 1000Watt, VentureBeat, GeekWire, iPhone Life
- **22 URLs submitted to IndexNow** — Bing/Yandex/IndexNow.org all accepted (HTTP 202). Fast re-indexing in progress.
- **ManyChat webhook** — 8 keyword auto-responders live and smoke-tested. APP/IOS/LAUNCH/DOWNLOAD/FREE/AGENT/REALTOR/DEFEND all return the App Store link with channel attribution.
- **Newsletter injection** — top-of-newsletter launch banner added to `send-cc-newsletter.js` + fixed a wrong App Store ID baked into the existing body section. Ready for tomorrow's manual send.

---

## YOU PRESS THE BUTTON — order by impact

### 1. App Store — release the app (5 min, BLOCKER for everything else)

If you chose Manual Release in ASC: open App Store Connect → iOS App 1.0 → click **Release this version**. The press pitches and IndexNow submissions go nowhere if the app isn't live.

### 2. CC Weekly Newsletter — manual send (5 min)

Cron is paused. To send tomorrow:
```
# Preview
curl https://thepropertydna.com/.netlify/functions/ccTest

# Send
curl -X POST https://thepropertydna.com/.netlify/functions/send-cc-newsletter
```
The launch banner is already injected at the top — you'll see it in the preview.

### 3. ManyChat broadcast — Meta-policy gated UI step (10 min)

Webhook is live. Open ManyChat → Automation → New Automation. Use keyword trigger. Step-by-step is in `automation-workflows/manychat-dm-qualifier.md`.

For the bulk broadcast: left sidebar → Broadcasts → New. Meta requires manual confirmation; can't be API'd.

### 4. Social posts — fire them (30 min, MAJOR organic lift)

All copy is in `launch-assets/02-social-launch-posts.md`. Post in this order:
- X — Post 1 immediately, Posts 2-4 spaced through the day
- LinkedIn — long-form
- Instagram — feed + 24h story with App Store sticker
- Facebook — caption
- Threads — caption
- TikTok / Reels — use scripts in `launch-assets/06-tiktok-reels-content-library.md`

### 5. Reddit posts — needs your account (20 min)

Posts in `02-social-launch-posts.md`. Subs:
- r/RealEstate (check mod self-promo rules first)
- r/FirstTimeHomeBuyer (mission-aligned, high response rate)
- r/RealEstateInvesting
- r/PalmSprings, r/SanDiego, r/Miami, r/CTrealestate (local angle)

### 6. Influencer DMs (1-2 hr) — highest-leverage paid acquisition

Full playbook with handles, hooks, and templates in `launch-assets/05-influencer-creator-outreach.md`.

Target: 30 cold DMs → 5-8 actual mentions → 1,000-5,000 installs in launch week.

Recommended budget: **$1,000** for first 5 paid placements. Most micro-creators accept product-only deals for novel free tools.

### 7. TikTok / Reels content production (you said you have equipment)

10 scripts in `launch-assets/06-tiktok-reels-content-library.md`. Shoot Videos 1, 2, 9 first — those are the strongest hooks. Daily posting cadence for 14 days.

### 8. Press follow-up — watch your Gmail (ongoing)

Press replies are coming to `stuartteamps@gmail.com`. Apple-focused outlets (9to5Mac, MacRumors, AppleInsider, Cult of Mac) tend to respond within 24 hours. Real estate trades (Inman, The Real Deal, HousingWire) are slower but higher-value.

### 9. Google Business Profile setup (15-30 min)

Per `memory/gbp_setup.md`: GBP content was drafted on 2026-05-01, paused on API setup awaiting your confirmation. Two things:
- Open https://business.google.com — confirm Profile exists for "PropertyDNA, LLC" in Palm Springs
- If yes: grant the Google Cloud project access to the Business Profile API
- If no: create the profile, verify by postcard (5-10 days)

GBP completion = appearance in Google Maps for "property report" + "real estate data" searches in coverage cities.

### 10. Apple Search Ads + Meta Ads (paid acquisition, budget required)

Don't fire these until organic baseline is known (week 2+). Then:
- Apple Search Ads — bid on "zillow", "redfin", "realtor.com", "home valuation"
- Meta Ads — interest target first-time homebuyers in coverage cities geographically
- Budget recommendation: $500-1000/day cap to learn signal before scaling

---

## Files you'll want open

- `launch-assets/04-distribution-checklist.md` — original morning list
- `launch-assets/05-influencer-creator-outreach.md` — handles + templates
- `launch-assets/06-tiktok-reels-content-library.md` — 10 video scripts
- `launch-assets/02-social-launch-posts.md` — captions for every platform

---

## What's blocking the next leverage point

| What | Blocker | Unblock |
|---|---|---|
| Auto-posting to X / IG / TikTok | API tokens not wired | OAuth each in their dev consoles, save tokens to Netlify env |
| GBP API integration | Profile + Cloud project unconfirmed | Step 9 above |
| Tracerfy skip-trace prospecting | Credits depleted (per 5/9 note) | Top up $135 at tracerfy.com IF you want to resume |
| Quo SMS launch broadcasts | A2P registration lapsed | Re-verify in OpenPhone dashboard |
| Apple App Store release | Manual click in ASC | Step 1 above |

---

## Honest take

47 visitors / month → 1000s / month is a 20-100x lift. The press wave alone won't deliver that (typical PR pickup adds 200-500 visitors per outlet that runs you, 2-5 outlets max). The compounding traffic engines are:

1. **Daily TikTok / Reels** — algorithmic lift if any one video hits. One viral 60-second clip = 50K-500K views.
2. **Programmatic city SEO** — the 12 city pages I shipped will start ranking 2-6 weeks out. Long-tail searches like "free property report greenwich ct" have moderate volume + very low competition.
3. **Influencer mentions** — single creator mention = 500-5000 installs.
4. **App Store organic** — once installs cross 1,000, the App Store algorithm starts surfacing PropertyDNA in "Real Estate" category searches. This compounds rapidly.

The press wave is necessary but insufficient. You need to ship one video per day for the next 14 days and DM 30 creators. That is where 1000s of visitors comes from.
