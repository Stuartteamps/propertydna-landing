# PropertyDNA Nightly Data Ingest Workflows
# Two separate n8n workflows — schedule both at 2:00 AM daily

---

## Workflow A: Nightly Market Snapshots
# Builds the Bloomberg-style price ticker for every market we track

### Schedule: Daily 2:00 AM
### Purpose: Store one market_snapshots row per zip per day → builds price chart over time

```
[1] Schedule Trigger (2:00 AM daily)
      ↓
[2] Get Active Zip Codes (Supabase)
    GET https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/report_searches
    select=zip&zip=neq.null&order=created_at.desc&limit=200
    → deduplicate zip codes in Code node
      ↓
[3] Split in Batches (5 at a time to respect RentCast rate limits)
      ↓
[4] For each zip → RentCast Market Data
    GET https://api.rentcast.io/v1/markets?zipCode={{ zip }}&dataType=All&historyRange=1
    Headers: X-Api-Key: {{ $env.RENTCAST_API_KEY }}
      ↓
[5] Code: Extract + shape market data
    ```javascript
    const d = $input.item.json;
    const zip = $('Split').item.json.zip;
    const today = new Date().toISOString().slice(0, 10);

    return [{
      json: {
        geo_key:               zip,
        geo_type:              'zip',
        snapshot_date:         today,
        median_price:          d.averageSalePrice      || null,
        avg_price_per_sqft:    d.averagePricePerSqFt  || null,
        median_dom:            d.averageDaysOnMarket   || null,
        active_listings:       d.activeListingCount    || null,
        pending_listings:      d.pendingListingCount   || null,
        sold_listings:         d.soldListingCount      || null,
        absorption_rate:       d.monthsOfSupply        || null,
        rent_estimate:         d.averageRent           || null,
        appreciation_rate_yoy: d.appreciationRate      || null,
        demand_score:          d.demandScore           || null,
      }
    }];
    ```
      ↓
[6] Upsert to market_snapshots (Supabase)
    POST https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/market_snapshots
    Headers: Prefer: resolution=merge-duplicates
    Body: {{ $json }}
      ↓
[7] Compute moving averages + update neighborhood_index
    GET https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/market_snapshots
    ?geo_key=eq.{{ zip }}&geo_type=eq.zip&order=snapshot_date.desc&limit=180

    Code: compute 30/60/90/180-day MAs
    ```javascript
    const rows = $input.all().map(r => r.json);
    const prices = rows.map(r => r.median_price).filter(Boolean);

    function ma(arr, days) {
      const slice = arr.slice(0, days);
      return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null;
    }

    const ma30  = ma(prices, 30);
    const ma60  = ma(prices, 60);
    const ma90  = ma(prices, 90);
    const ma180 = ma(prices, 180);

    // Trend signal: 30d MA crossing 90d MA
    const trend = ma30 && ma90 ? (ma30 > ma90 ? 'bullish' : ma30 < ma90 ? 'bearish' : 'neutral') : 'neutral';
    const change30d = prices.length >= 2 ? ((prices[0] - prices[29]) / prices[29] * 100) : null;
    const change90d = prices.length >= 3 ? ((prices[0] - prices[89]) / prices[89] * 100) : null;

    return [{ json: { zip, ma30, ma60, ma90, ma180, trend, change30d, change90d } }];
    ```
      ↓
[8] PATCH market_snapshots — update MAs for today's row
    PATCH https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/market_snapshots
    ?geo_key=eq.{{ zip }}&geo_type=eq.zip&snapshot_date=eq.{{ today }}
    Body: { ma_30_day: {{ ma30 }}, ma_60_day: {{ ma60 }}, ma_90_day: {{ ma90 }}, ma_180_day: {{ ma180 }} }
      ↓
[9] PATCH neighborhood_index — update trend signal
    PATCH https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/neighborhood_index
    ?geo_key=eq.{{ zip }}
    Body: {
      trend_signal: {{ trend }},
      trend_30d_change_pct: {{ change30d }},
      trend_90d_change_pct: {{ change90d }},
      last_computed_at: {{ now }}
    }
```

---

## Workflow B: Permit Extraction (No Socrata needed)
# Socrata/dev.socrata.com shut down April 2021.
# Use direct city open data APIs — same CKAN/Socrata-format endpoints still work.

### Key insight: The city APIs themselves are still live.
### Socrata the company → Tyler Technologies. The endpoints didn't move.

### Direct City Permit Endpoints (no registration needed for basic access)

| City | Endpoint |
|---|---|
| Los Angeles | https://data.lacity.org/resource/nbyu-2ha9.json |
| San Francisco | https://data.sfgov.org/resource/i98e-djp9.json |
| Chicago | https://data.cityofchicago.org/resource/ydr8-5enu.json |
| Austin | https://data.austintexas.gov/resource/3syk-w9eu.json |
| Seattle | https://data.seattle.gov/resource/76t5-zqzr.json |
| Phoenix | https://www.phoenixopendata.com/resource/permits.json |
| Palm Springs | See Riverside County below |
| Riverside County | https://gis.rctlma.org/rcweb/rest/services (ArcGIS REST) |

### Permit Lookup Node (add to main report workflow, after RentCast)

```javascript
// Node: Get Permits by Address
// HTTP GET — pick URL based on state/city

const city  = $('Normalize Intake').item.json.city?.toLowerCase()  || '';
const state = $('Normalize Intake').item.json.state?.toLowerCase() || '';
const address = $('Normalize Intake').item.json.address || '';
const zip   = $('Normalize Intake').item.json.zip      || '';

// Map city to its open data permit endpoint
const CITY_ENDPOINTS = {
  'los angeles':   'https://data.lacity.org/resource/nbyu-2ha9.json',
  'san francisco': 'https://data.sfgov.org/resource/i98e-djp9.json',
  'chicago':       'https://data.cityofchicago.org/resource/ydr8-5enu.json',
  'austin':        'https://data.austintexas.gov/resource/3syk-w9eu.json',
  'seattle':       'https://data.seattle.gov/resource/76t5-zqzr.json',
  'phoenix':       'https://www.phoenixopendata.com/resource/permits.json',
};

const endpoint = CITY_ENDPOINTS[city];

if (!endpoint) {
  // City not in our direct list yet — return empty, don't break report
  return [{ json: { permits: { available: false, total: 0, recent: [], source: 'none' } } }];
}

// Socrata-format query still works at these endpoints
const addressEncoded = encodeURIComponent(address);
const url = `${endpoint}?$where=address like '%25${addressEncoded}%25'&$limit=20&$order=issued_date DESC`;

// Return URL for HTTP Request node
return [{ json: { permitUrl: url, hasEndpoint: true } }];
```

### HTTP Request Node (after code node)
```
GET {{ $json.permitUrl }}
Headers:
  X-App-Token: {{ $env.CITY_DATA_APP_TOKEN }}  (optional but gets higher rate limits)
```

**Get free app token:** https://data.cityofchicago.org/profile/app_tokens
  (One token works across all city portals — register with your email)

---

## Riverside County / Palm Springs Specific

Riverside County uses ArcGIS REST, not Socrata. Different format.

```
GET https://gis.rctlma.org/rcweb/rest/services/PublicWorks/RCPermits/MapServer/0/query
  ?where=SITEADDRESS+like+'%25{{ address }}%25'
  &outFields=*
  &f=json
  &resultRecordCount=20
```

No key needed. Returns permit records for Coachella Valley cities including
Palm Springs, Palm Desert, Rancho Mirage, La Quinta, Indian Wells.

---

## What Gets Stored in PropertyDNA Database

Every permit found → `permit_registry` table (via property-ingest.js)
Every permit → `property_events` timeline (event_type='permit')

PropertyDNA accumulates its own permit database over time.
After 6 months of report generation, you'll have the most complete
permit history for your core market (Coachella Valley) of any platform.

---

## Environment Variable Needed

| Var | Value | Notes |
|---|---|---|
| CITY_DATA_APP_TOKEN | Get free at data.cityofchicago.org | Optional — increases rate limits |
| RENTCAST_API_KEY | Already have | Used in workflow A |
| INTERNAL_API_KEY | Already set | Used for save-report |
