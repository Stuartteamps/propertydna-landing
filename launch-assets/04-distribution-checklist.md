# PropertyDNA iOS Launch — Distribution Checklist

Generated: 2026-06-09. App approved earlier today.

## Already shipped tonight (autonomous)
- [x] `/launch` page — mission-led download hero (Launch.tsx)
- [x] `/ios`, `/app` route aliases
- [x] `/press/ios-launch` — full press release page (IOSLaunchPress.tsx)
- [x] Apple Smart App Banner meta tag on every Safari iOS visit
- [x] AppStoreBanner component — sticky download CTA on Chrome iOS + Android + desktop
- [x] AEO JSON-LD — Organization, MobileApplication, WebSite, FAQPage schema graph
- [x] ShareCTA component — Twitter / FB / LinkedIn / SMS / Email / Copy
- [x] 5 mission-driven SEO blog posts:
  - `/blog/free-ios-app-defend-homebuyers`
  - `/blog/information-asymmetry-real-estate-agents`
  - `/blog/propertydna-vs-zestimate-honest-comparison`
  - `/blog/hidden-permit-history-buying-a-house`
  - `/blog/first-time-buyer-protection-guide`
- [x] Constant Contact email template (`launch-assets/01-cc-email-launch.html`)
- [x] Social copy library (`launch-assets/02-social-launch-posts.md`)
- [x] ManyChat keyword triggers (`launch-assets/03-manychat-launch-keyword.md`)

---

## YOU PRESS THE BUTTON — manual actions Dan needs to do on wake

### Apple App Store
- [ ] In App Store Connect → App Store → iOS App 1.0 → choose **release option**:
  - **Manually release** (recommended for coordinated launch) — then click "Release this version" once social/email are ready to fire simultaneously
  - **Automatically release** — already shipping if approved status is now visible
- [ ] Confirm app live by hitting https://apps.apple.com/app/id6768064079 in mobile Safari

### Constant Contact (5 min)
- [ ] CC dashboard → Create campaign → import HTML from `launch-assets/01-cc-email-launch.html`
- [ ] Subject line: "The data your agent does not want you to see — now free on iOS"
- [ ] From: `hello@mail.thepropertydna.com` (campaign domain)
- [ ] Send to: full subscriber list
- [ ] Schedule: immediate on launch day, or 9:00am PT next morning

### Social (15 min — pick your channels)
- [ ] X / Twitter — post the 4 tweets from `02-social-launch-posts.md` (one per hour over launch day)
- [ ] LinkedIn — paste the long-form
- [ ] Instagram — share to feed + 24h story with App Store sticker
- [ ] Facebook — paste caption
- [ ] Threads — paste caption
- [ ] TikTok / Reels — record the 30-sec script

### Reddit (high-leverage, mod-permission first)
- [ ] r/RealEstate (always check Mod rules on self-promo)
- [ ] r/FirstTimeHomeBuyer
- [ ] r/RealEstateInvesting
- [ ] r/PalmSprings, r/SanDiego, r/Miami, r/CTrealestate (geographically targeted)
- [ ] Post format in `02-social-launch-posts.md` — adjust title to match each sub's rules

### ManyChat (run with manychat-orchestrator agent)
- [ ] Provision keyword triggers from `03-manychat-launch-keyword.md`
- [ ] Schedule launch-day broadcast to opted-in subs

### Product Hunt (optional, +24h after launch — Tuesday/Wednesday best)
- [ ] Submit at 12:01am PT for full 24h leaderboard
- [ ] Tagline: "The data your real estate agent does not want you to see — free in your pocket"
- [ ] First comment: founder note about the mission
- [ ] Hunter ask: anyone in network with Product Hunt karma

### Press / Media outreach (slow-burn)
- [ ] HARO / Connectively — set up daily queries on "real estate", "homebuying", "first-time buyer", "PropTech"
- [ ] Direct pitch list (cold email each with `/press/ios-launch` link):
  - The Information (PropTech beat)
  - TechCrunch (PropTech beat — Mary Ann Azevedo)
  - Inman News (real estate trade press)
  - Curbed (consumer real estate)
  - Realtor Magazine
  - The Real Deal
  - LA Times Business / NYT Real Estate
- [ ] Local press in coverage cities:
  - Desert Sun (Palm Springs)
  - Miami Herald
  - Greenwich Time
  - Westchester Magazine

### App Store Optimization (week 2)
- [ ] Add 5 more iOS keywords once first-week search data is in (ASO tools like Sensor Tower)
- [ ] A/B test screenshot order via Custom Product Pages
- [ ] Localized Spanish description for South Florida + Coachella Valley

### Paid acquisition (week 3, once organic baseline known)
- [ ] Apple Search Ads — bid on "zillow", "redfin", "realtor.com", "home valuation"
- [ ] Meta ads — interest targeting on first-time homebuyers, geographically in coverage cities
- [ ] Google Search Ads — long-tail "free property report [city]"

---

## North-star launch metrics (first 14 days)
- App Store installs (target: 1,000 organic in 7 days)
- /launch page visits (target: 5,000 in 7 days)
- ShareCTA clicks (target: 200 — viral coefficient indicator)
- New CC subscribers (target: +500 from launch email signups)
- New /pricing → Stripe checkout starts (target: 25 — Realtor Pro + Investor)
