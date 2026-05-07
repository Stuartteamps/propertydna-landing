# PropertyDNA — Current Technology Stack & Subscriptions
*Last updated: 2026-05-06 | Update this file whenever a service is added, changed, or cancelled*

---

## MONTHLY SERVICES

| Service | Purpose | Plan | Cost/Mo | Billing Day | Login |
|---------|----------|------|---------|-------------|-------|
| Netlify | Site hosting + serverless functions | Pro (est.) | ~$19 | ~1st | netlify.com |
| Supabase | Database (reports, contacts, campaigns, parcels) | Pro | $25 | ~1st | supabase.com |
| n8n Cloud | Report generation workflow automation | Starter | ~$20 | ~1st | dillabean.app.n8n.cloud |
| Resend | All outbound email (reports, drip, campaigns) | Basic | ~$20 | ~1st | resend.com |
| RentCast | Property data, AVM valuations, comps | Starter ($29) | $29–$199 | ~1st | rentcast.io — KEY: see api_keys.md |
| Constant Contact | Weekly newsletter + contact lists (3,946 contacts) | Lite (est.) | ~$45 | ~1st | constantcontact.com |
| Sona AI (Quo) | AI answering service — 24/7 call handling | Per-call | ~$25–$49 | ~1st | quo.com |
| **Monthly Total** | | | **~$163–$377** | | |

---

## ANNUAL SERVICES

| Service | Purpose | Cost/Yr | Renewal Date | Login |
|---------|----------|---------|--------------|-------|
| Quo (OpenPhone) | Business VoIP — (213) 205-4933 | $300 | 2027-05-06 | quo.com |
| Apple Developer | Apple Sign In OAuth | $99 | TBD | developer.apple.com |
| Domain: propertydna.com | Primary domain | ~$18 | TBD | check registrar |
| Domain: thepropertydna.com | Alternate domain (also live) | ~$18 | TBD | check registrar |
| LinkedIn | Company page + API | $0 | — | linkedin.com |
| **Annual Total** | | **~$435/yr** | | |

---

## USAGE-BASED (no fixed cost — scales with activity)

| Service | Purpose | Rate | Notes |
|---------|----------|------|-------|
| Stripe | Payment processing | 2.9% + $0.30/txn | No monthly fee |
| Anthropic Claude API | AI narrative in property reports | ~$0.03/report | Key in api_keys.md |
| Mapbox | Heat maps + parcel visualization | $0 (free tier) | Free up to 50k map loads/mo |
| Google OAuth | Google Sign In | $0 | Free |
| Facebook OAuth | Facebook Sign In | $0 | Free |

---

## INFRASTRUCTURE DETAILS

### Hosting
- **URL:** thepropertydna.com + propertydna.com
- **Platform:** Netlify (Vite/React SPA + serverless functions)
- **Functions dir:** netlify/functions/ (40 functions)
- **Build:** pnpm, Node 20, esbuild

### Database (Supabase)
- **URL:** neccpdfhmfnvyjgyrysy.supabase.co
- **Key tables:** profiles, reports, parcels, campaign_contacts, campaigns, campaign_unsubscribes, permit_registry, market_snapshots
- **Auth:** Supabase Auth (Google, Apple, Facebook, Magic Link)

### Automation (n8n)
- **Instance:** dillabean.app.n8n.cloud
- **Workflow ID:** FQ0T3xhXyYubf8c6
- **Webhook:** https://dillabean.app.n8n.cloud/webhook/homefax/report

### Email
- **Sending domain:** thepropertydna.com (Resend)
- **From address:** reports@thepropertydna.com
- **Reply-To:** stuartteamps@gmail.com
- **Webhook:** resend-webhook.js (tracks opens/clicks/bounces)

### Phone
- **Provider:** Quo (formerly OpenPhone)
- **AI Agent:** Sona (24/7 answering)
- **Target area code:** 760 (Coachella Valley)

---

## STRIPE PRICING (LIVE)

| Plan | Price ID | Monthly | Who |
|------|----------|---------|-----|
| Consumer | price_1TRSwKFtMY7bffn8UmNgYZqw | $19/mo | Buyers + general public |
| Pro | STRIPE_PRICE_SUBSCRIPTION | $49/mo | Early adopter agents |
| Realtor Pro | price_1TRSwLFtMY7bffn8yq8OJxE4 | $99/mo | Active real estate agents |
| Enterprise | STRIPE_PRICE_ENTERPRISE | $149/mo | Teams + brokerages |
| Investor | price_1TRSwLFtMY7bffn88xFInwXF | $299/mo | Investors + developers |
| Per Report | STRIPE_PRICE_PER_REPORT | TBD | Occasional users |

---

## SERVICES PENDING / INCOMING

| Service | Status | Action Needed |
|---------|--------|---------------|
| BuildZoom | API key incoming | Add BUILDZOOM_API_KEY to Netlify env when received |
| LinkedIn OAuth | App created today | Add Client ID + Secret to n8n as credential |
| Medium | Cross-posting | Need integration token from Medium Settings > Security |
| Constant Contact OAuth | PAUSED — wrong secret | Resume when correct secret confirmed |
| Newsletter automation | PAUSED | Need CC API key + MLS credentials |

---

## ESTIMATED MONTHLY RUN RATE

| Scenario | Fixed | Variable | Total |
|----------|-------|----------|-------|
| Current (minimal usage) | ~$163 | ~$30 | **~$193/mo** |
| Growth (100 active users) | ~$250 | ~$300 | **~$550/mo** |
| Scale (1,000 active users) | ~$400 | ~$3,000 | **~$3,400/mo** |

*Break-even: 5 paying subscribers at $49/mo covers all current fixed costs*
