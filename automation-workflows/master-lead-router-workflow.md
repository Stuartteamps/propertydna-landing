# Master Lead Router Workflow

Every lead from every funnel flows through this normalization and routing layer before being dispatched.

---

## Purpose
- Deduplicate leads by email/phone
- Normalize field names across all funnel types
- Route to correct downstream systems (Gmail, SMS, Supabase, CC)
- Log everything to a single master `leads` table

---

## n8n Node Chain

```
[1] Webhook Trigger (receives any funnelType)
      ↓
[2] Normalize Fields (Code)
      ↓
[3] Check Supabase for existing lead by email
      ↓
[4] IF: New lead?
       ├─ YES → Insert new record
       └─ NO  → Update existing record (add new funnel tag)
      ↓
[5] Route by funnelType (Switch node)
       ├─ OPEN_HOUSE       → open-house-lead-workflow
       ├─ PROPERTY_DNA     → property-dna-workflow
       ├─ SELLER_VALUATION → seller-valuation-workflow
       ├─ BUYER_KEYS       → buyer-access-workflow
       ├─ OFF_MARKET       → off-market-workflow
       ├─ NEWSLETTER       → newsletter-workflow
       └─ CONTACT          → contact-workflow
      ↓
[6] Always: Gmail internal log to Daniel
[7] Always: Append to Google Sheet master log
```

---

## Dedup Logic (Code node)

```javascript
const email = $json.email?.toLowerCase().trim();
const phone = $json.phone?.replace(/\D/g, '');

// Query Supabase
const existing = await supabaseQuery(
  `SELECT id, funnel_types FROM leads WHERE email = '${email}' LIMIT 1`
);

if (existing.length > 0) {
  // Update: add new funnel tag, update timestamp
  return [{ json: { ...existing[0], isNew: false, newFunnelType: $json.funnelType } }];
}

return [{ json: { ...$json, isNew: true } }];
```

---

## Google Sheets Master Log

Sheet name: `Lead Master Log`

Columns: `timestamp | funnelType | firstName | lastName | email | phone | propertyAddress | interest | buyerTimeline | sellerTimeline | priceRange | agent | campaign | qrSource | pageUrl`

New row appended for every submission (duplicates allowed — dedup in Supabase).
