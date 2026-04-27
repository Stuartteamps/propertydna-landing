# Property DNA Report Request Workflow

**Webhook path**: `POST /webhook/homefax/report`
**Trigger**: PropertyDNA form submit on `/` or `/property-dna`

---

## n8n Node Chain

```
[1] Webhook Trigger
      ↓
[2] Normalize Intake (Code) — extract name, email, address, role
      ↓
[3] Property Lookup (RentCast API)
      ↓
[4] Valuation Lookup (RentCast AVM)
      ↓
[5] NWS Points → NWS Forecast
      ↓
[6] Prepare Lookup Params → FEMA Flood Zone
      ↓
[7] RentCast Comps → Census Geocoder → Extract Tract → Census ACS
      ↓
[8] FBI Crime Data (Code)
      ↓
[9] BuildZoom Permits ← [NEEDS KEY]
      ↓
[10] SpotCrime ← [NEEDS KEY]
      ↓
[11] Merge Normalize Score (Code) — build full normalized object
      ↓
[12] OpenAI/Claude Narrative (Anthropic API)
      ↓
[13] Compose HTML Report (Code)
      ↓
[14] Save to Supabase (Code)
      ↓
[15] IF: Email Present?
       ├─ YES → Gmail: Send Report to Lead
       └─ NO → Gmail: Internal Review Copy
      ↓
[16] Respond to Webhook → { status: "success", reportUrl: "..." }
```

See the live workflow in n8n: `FQ0T3xhXyYubf8c6`

---

## Key Fields
- `intent`: `report_request`
- `fullName`, `email`, `phone`, `role`
- `address`, `city`, `state`, `zip`
- Response includes `reportUrl` → `https://thepropertydna.com/report/{uuid}`
