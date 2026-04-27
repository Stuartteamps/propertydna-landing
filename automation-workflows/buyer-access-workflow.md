# Buyer Access / DM Keys Workflow

**Webhook path**: `POST /webhook/stuart-team/buyer-access`
**Trigger**: Form submit on `/buyer-access`

---

## n8n Node Chain

```
[1] Webhook Trigger
      ↓
[2] Normalize Lead (Code)
      ↓
[3] Save to Supabase
      ↓
[4] Gmail: Instant Buyer Welcome Email
      ↓
[5] Gmail: Internal Alert to Daniel
      ↓
[6] SMS to Daniel (Twilio placeholder)
      ↓
[7] Constant Contact: Add to "Active Buyers" list + tag priceRange, timeline
      ↓
[8] Day 2 Follow-up: Send curated listings
[9] Day 5 Follow-up: Off-market alert
[10] Day 14 Follow-up: Market update
```

---

## Gmail: Instant Buyer Welcome Email

**Subject**: `Your buyer access is ready — Daniel Stuart`

**Body**:
```html
<p>Hi {{ $json.firstName }},</p>
<p>I've got you set up. Here's what you'll receive from me:</p>
<ul>
  <li>Curated listings matching your criteria ({{ $json.priceRange }}, {{ $json.bedrooms }} bed)</li>
  <li>Off-market and pre-market homes before they're listed</li>
  <li>A free Property DNA report on any home you want to analyze</li>
</ul>
<p>I'll follow up shortly with your first batch of homes. In the meantime, you can get a Property DNA report on any address at <a href="https://thepropertydna.com">thepropertydna.com</a>.</p>
<p>— Daniel Stuart<br>Stuart Team Real Estate</p>
```

---

## Constant Contact Tags
- `buyer_access`
- `timeline_{{ $json.buyerTimeline }}`
- `price_{{ $json.priceRange }}`
