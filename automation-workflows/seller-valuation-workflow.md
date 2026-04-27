# Seller Valuation Workflow

**Webhook path**: `POST /webhook/stuart-team/seller-valuation`
**Trigger**: Form submit on `/seller-valuation`

---

## n8n Node Chain

```
[1] Webhook Trigger
      ↓
[2] Normalize Lead (Code)
      ↓
[3] Save to Supabase
      ↓
[4] Gmail: Instant Confirmation to Seller
      ↓
[5] Gmail: Internal Alert to Daniel with property address + timeline
      ↓
[6] SMS to Daniel (Twilio placeholder)
      ↓
[7] Constant Contact: Add to "Potential Sellers" list
      ↓
[8] Day 1: Daniel manually prepares CMA (comparable market analysis)
[9] Day 1-2: Send valuation report via email
[10] Day 7: Follow-up if no response
```

---

## Gmail: Confirmation to Seller

**Subject**: `Valuation request received — {{ $json.homeAddress }}`

**Body**:
```html
<p>Hi {{ $json.firstName }},</p>
<p>I received your valuation request for {{ $json.homeAddress }}. I'll review the current market data and comparable sales, and reach out within one business day with a full analysis.</p>
<p>If you'd like to speak sooner, reply to this email or call me directly.</p>
<p>— Daniel Stuart<br>Stuart Team Real Estate<br>Palm Springs / Coachella Valley</p>
```

---

## Internal Alert to Daniel
Include:
- Seller name + contact info
- Property address
- Seller timeline (`$json.sellerTimeline`)
- Any notes from the form
- Direct link to run a PropertyDNA report on the address
