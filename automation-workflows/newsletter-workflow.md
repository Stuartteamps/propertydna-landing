# Newsletter Workflows

---

## A. Newsletter Signup

**Webhook path**: `POST /webhook/stuart-team/newsletter`
**Trigger**: Form submit on `/newsletter`

### n8n Node Chain
```
[1] Webhook Trigger
      ↓
[2] Normalize (Code) — extract email, firstName, interest
      ↓
[3] Constant Contact: Add/Update contact → "Weekly Newsletter" list
      ↓
[4] Gmail: Welcome email
      ↓
[5] Save to Supabase `newsletter_subscribers` table
```

### Gmail: Welcome Email
**Subject**: `Welcome to Stuart Team Weekly — first issue this Sunday`
**Body**:
```html
<p>Hi {{ $json.firstName || 'there' }},</p>
<p>You're in. Every Sunday morning: Palm Springs market trends, homes worth watching, off-market alerts, and local intelligence for buyers and sellers.</p>
<p>If you're thinking about buying or selling, reply to this email anytime — I respond to every message personally.</p>
<p>— Daniel Stuart<br>Stuart Team Real Estate · PropertyDNA</p>
```

---

## B. Weekly Newsletter Trigger

**Schedule**: Every Sunday at 7:00 AM PT

### n8n Node Chain
```
[1] Schedule Trigger (Sunday 7am PT)
      ↓
[2] Code: Load newsletter config (market data, featured listings)
      ↓
[3] Code: Generate newsletter HTML
      ↓
[4] Gmail: Send preview draft to Daniel (stuartteamps@gmail.com)
      ↓
[5] WAIT: Daniel reviews and approves manually
      ↓
[6] Manual approval trigger → Send via Constant Contact bulk send
```

### Newsletter Sections to Include
1. **Market Pulse** — 2-3 sentences on what happened this week
2. **Listing Spotlight** — 1-2 featured properties with prices
3. **Off-Market Alert** — tease upcoming inventory
4. **Property DNA Tip** — one insight from recent reports
5. **CTA**: "Get a free report" → thepropertydna.com

### Config Object (update weekly)
```javascript
const config = {
  week: '2026-W18',
  marketPulse: 'Edit this text...',
  featuredListings: [
    { address: '...', price: '...', link: '...' }
  ],
  offMarketTeaser: 'Edit this...',
  tip: 'Edit this...',
};
```
