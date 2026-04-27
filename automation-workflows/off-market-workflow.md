# Off-Market Deal Workflow

**Webhook path**: `POST /webhook/stuart-team/off-market`
**Trigger**: Form submit on `/off-market`

---

## n8n Node Chain

```
[1] Webhook Trigger
      ↓
[2] Normalize Lead (Code)
      ↓
[3] Save to Supabase
      ↓
[4] Gmail: You're on the list confirmation
      ↓
[5] Gmail: Internal alert to Daniel with buyer criteria
      ↓
[6] SMS to Daniel (Twilio placeholder)
      ↓
[7] Constant Contact: Add to "Off-Market Buyers" + tags
      ↓
[8] When matching property found: Daniel manually triggers outreach
```

---

## Buyer Criteria to Capture
Store in Supabase and Constant Contact custom fields:
- `priceRange`
- `propertyType`
- `bedrooms`
- `message` (free-text criteria)
- `interest`

---

## Gmail: Confirmation

**Subject**: `You're on the off-market list — Daniel Stuart`

**Body**:
```html
<p>Hi {{ $json.firstName }},</p>
<p>You're on my private list. When a property matching your criteria ({{ $json.priceRange }}, {{ $json.bedrooms }} bed{{ $json.propertyType ? ', ' + $json.propertyType : '' }}) comes across my desk before it hits the market, you'll be the first to know.</p>
<p>These move fast — I'll reach out by phone or email the moment something comes up.</p>
<p>— Daniel Stuart<br>Stuart Team Real Estate</p>
```
