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
[13] Compose HTML Report (Code) — also detect feature flags for DNA adjustment
      ↓
[14] Save Report (HTTP → Netlify save-report function)
         POST https://thepropertydna.com/.netlify/functions/save-report
         Headers: x-internal-key: {{ $env.INTERNAL_API_KEY }}
         Body: {
           email, address, city, state, zip,
           reportData: {{ $json.reportObject }},
           status: "completed",
           features: {{ $json.detectedFeatures }},   ← DNA adjustment flags
           n8nRequestId: {{ $execution.id }}
         }
         Response includes: { viewToken, viewUrl, dnaAdjusted }
      ↓
[15] IF: Email Present?
       ├─ YES → HTTP: send-report-email (Netlify function)
       │         POST https://thepropertydna.com/.netlify/functions/send-report-email
       │         Headers: x-internal-key: {{ $env.INTERNAL_API_KEY }}
       │         Body: {
       │           recipientEmail:   {{ $('Normalize Intake').item.json.email }},
       │           recipientName:    {{ $('Normalize Intake').item.json.fullName }},
       │           propertyAddress:  {{ $('Normalize Intake').item.json.fullAddress }},
       │           summary:          {{ $('OpenAI/Claude Narrative').item.json.executiveSummary }},
       │           viewToken:        {{ $('Save Report').item.json.viewToken }},
       │           reportId:         {{ $('Save Report').item.json.reportId }},
       │           ownerCopy:        true
       │         }
       └─ NO  → (skip or log internal note)
      ↓
[16] Respond to Webhook → { status: "success", viewUrl: "..." }
```

See the live workflow in n8n: `FQ0T3xhXyYubf8c6`

---

## Key Fields
- `intent`: `report_request`
- `fullName`, `email`, `phone`, `role`
- `address`, `city`, `state`, `zip`
- Response includes `viewUrl` → `https://thepropertydna.com/report/view/{token}`

---

## Node 14 — Save Report (HTTP Request)

**Replace** any direct Supabase write with a call to the Netlify function.

Method: `POST`
URL: `https://thepropertydna.com/.netlify/functions/save-report`
Authentication: Header `x-internal-key` = `{{ $env.INTERNAL_API_KEY }}`

Minimum body:
```json
{
  "email":        "{{ $('Normalize Intake').item.json.email }}",
  "address":      "{{ $('Normalize Intake').item.json.address }}",
  "city":         "{{ $('Normalize Intake').item.json.city }}",
  "state":        "{{ $('Normalize Intake').item.json.state }}",
  "zip":          "{{ $('Normalize Intake').item.json.zip }}",
  "reportData":   "{{ $('Compose HTML Report').item.json.reportObject }}",
  "status":       "completed",
  "n8nRequestId": "{{ $execution.id }}"
}
```

Optional DNA feature detection (add to body):
```json
{
  "features": {
    "waterfront":     false,
    "pool":           true,
    "fully_remodeled": false,
    "gated_community": true
  }
}
```

The response returns:
```json
{
  "saved":      true,
  "reportId":   "uuid-...",
  "viewToken":  "uuid-...",
  "viewUrl":    "https://thepropertydna.com/report/view/uuid-...",
  "dnaAdjusted": { ... }
}
```

---

## Node 15 — Send Report Email (HTTP Request)

**Replace** the Gmail node with an HTTP node calling the Netlify function.
This sends a clean, deliverability-hardened email with a single secure link.

Method: `POST`
URL: `https://thepropertydna.com/.netlify/functions/send-report-email`
Authentication: Header `x-internal-key` = `{{ $env.INTERNAL_API_KEY }}`

Body:
```json
{
  "recipientEmail":  "{{ $('Normalize Intake').item.json.email }}",
  "recipientName":   "{{ $('Normalize Intake').item.json.fullName }}",
  "propertyAddress": "{{ $('Normalize Intake').item.json.fullAddress }}",
  "summary":         "{{ $('OpenAI Node').item.json.executiveSummary }}",
  "viewToken":       "{{ $('Save Report').item.json.viewToken }}",
  "reportId":        "{{ $('Save Report').item.json.reportId }}",
  "ownerCopy":       true
}
```

---

## DNA Feature Detection (Node 13 — Compose Report)

To enable DNA adjusted valuation, detect features in Node 13 and output a
`detectedFeatures` object. Example detection logic:

```javascript
const desc = (reportObject.normalized?.property?.description || "").toLowerCase();
const listing = (reportObject.normalized?.listing?.remarks || "").toLowerCase();
const combined = desc + " " + listing;

const features = {
  waterfront:               combined.includes("waterfront") || combined.includes("water front"),
  lakefront:                combined.includes("lakefront") || combined.includes("lake front"),
  golf_course:              combined.includes("golf"),
  mountain_view:            combined.includes("mountain view"),
  premium_community:        combined.includes("resort") || combined.includes("luxury community"),
  fully_remodeled:          combined.includes("fully remodel") || combined.includes("completely remodel"),
  updated:                  combined.includes("updated") || combined.includes("renovated"),
  original_condition:       combined.includes("original") || combined.includes("as-is") || combined.includes("dated"),
  pool:                     combined.includes("pool"),
  no_pool_desert_penalty:   !combined.includes("pool") && ["az","nv","fl"].includes(state?.toLowerCase()),
  corner_lot:               combined.includes("corner lot"),
  oversized_lot:            combined.includes("oversized lot") || combined.includes("large lot"),
  gated_community:          combined.includes("gated"),
  short_term_rental_friendly: combined.includes("str") || combined.includes("airbnb") || combined.includes("short term"),
};

return { ...reportObject, detectedFeatures: features };
```

---

## Environment Variables Required in n8n

| Variable              | Value                                                |
|-----------------------|------------------------------------------------------|
| `INTERNAL_API_KEY`    | Must match Netlify env `INTERNAL_API_KEY`            |

## Environment Variables Required in Netlify

| Variable              | Value                                                |
|-----------------------|------------------------------------------------------|
| `INTERNAL_API_KEY`    | Secret shared key (generate with `openssl rand -hex 32`) |
| `SENDER_EMAIL`        | `reports@thepropertydna.com`                         |
| `REPLY_TO_EMAIL`      | `stuartteamps@gmail.com`                             |
| `OWNER_EMAIL`         | `stuartteamps@gmail.com`                             |
| `APP_BASE_URL`        | `https://thepropertydna.com`                         |
| `RESEND_API_KEY`      | Get at resend.com — verify thepropertydna.com domain |
| `SUPABASE_SERVICE_KEY`| Supabase service role key                            |
