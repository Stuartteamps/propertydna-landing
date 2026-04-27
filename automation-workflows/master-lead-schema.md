# Master Lead Schema

Every lead submitted through the Stuart Team / PropertyDNA funnel system uses this normalized field set.
Map these fields across n8n, Gmail, SMS, Supabase, Constant Contact, and Google Sheets.

---

## Universal Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `funnelType` | string | ✅ | `OPEN_HOUSE` / `PROPERTY_DNA` / `SELLER_VALUATION` / `BUYER_KEYS` / `OFF_MARKET` / `NEWSLETTER` / `CONTACT` |
| `leadSource` | string | ✅ | e.g. `qr_open_house`, `web_buyer_form`, `newsletter_form` |
| `firstName` | string | | |
| `lastName` | string | | |
| `email` | string | ✅ | Primary dedup key |
| `phone` | string | | Secondary dedup key |
| `propertyAddress` | string | | Subject property |
| `propertySlug` | string | | Machine-readable slug, e.g. `9520-ekwanok` |
| `community` | string | | e.g. `Mission Lakes Country Club` |
| `homeAddress` | string | | Seller's own home address |
| `interest` | string | | `this_home` / `similar_homes` / `off_market` / `buying` / `selling` / etc. |
| `message` | string | | Free text from form |
| `buyerTimeline` | string | | `asap` / `1-3mo` / `3-6mo` / `6-12mo` / `exploring` |
| `sellerTimeline` | string | | `asap` / `1-3mo` / `3-6mo` / `6-12mo` / `just_curious` |
| `workingWithAgent` | string | | `yes` / `no` / `looking` |
| `priceRange` | string | | e.g. `400-700k` |
| `bedrooms` | string | | `1` / `2` / `3` / `4` / `5+` |
| `propertyType` | string | | `single_family` / `condo` / `multi_family` / `land` |
| `agent` | string | | `daniel_stuart` (from URL param or default) |
| `campaign` | string | | e.g. `open_house_9520_ekwanok` |
| `utmSource` | string | | From URL `?utm_source=` or `?source=` |
| `utmMedium` | string | | From URL `?utm_medium=` |
| `utmCampaign` | string | | From URL `?utm_campaign=` |
| `qrSource` | string | | Set if `?source=qr` — property slug |
| `pageUrl` | string | ✅ | Auto-populated from `window.location.href` |
| `userAgent` | string | ✅ | Auto-populated |
| `referrer` | string | | Auto-populated from `document.referrer` |
| `timestamp` | ISO string | ✅ | Auto-populated |

---

## Field Mapping by Destination

### Gmail
- **Subject**: `[funnelType] New lead — {firstName} {lastName} | {email}`
- **Body**: All fields formatted as a clean HTML table
- **Reply-to**: Lead's email

### SMS (Twilio)
```
New [funnelType] lead: {firstName} {lastName}
{email} | {phone}
{propertyAddress or interest}
{buyerTimeline or sellerTimeline}
Reply to respond
```

### Supabase `leads` table (recommended schema)
```sql
id           uuid primary key default gen_random_uuid()
funnel_type  text not null
lead_source  text
first_name   text
last_name    text
email        text
phone        text
property_address text
interest     text
message      text
buyer_timeline text
seller_timeline text
price_range  text
agent        text
campaign     text
utm_source   text
qr_source    text
page_url     text
user_agent   text
raw_payload  jsonb
created_at   timestamptz default now()
```

### Constant Contact
- **List**: Map `funnelType` → CC list name
  - `OPEN_HOUSE` → "Open House Visitors"
  - `BUYER_KEYS` → "Active Buyers"
  - `SELLER_VALUATION` → "Potential Sellers"
  - `OFF_MARKET` → "Off-Market Buyers"
  - `NEWSLETTER` → "Weekly Newsletter"
  - `CONTACT` → "General Inquiries"
- **Tags**: `funnelType`, `campaign`, `agent`, `qrSource`
- **Custom fields**: `buyerTimeline`, `sellerTimeline`, `priceRange`, `interest`

### Google Sheets
One master sheet with columns matching the Supabase schema above.
Use n8n Google Sheets node: "Append Row" on each lead.
