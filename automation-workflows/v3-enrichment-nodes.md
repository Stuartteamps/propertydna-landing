# PropertyDNA v3 — Enrichment Engine n8n Node Guide

**Add these nodes to the main property-dna-workflow AFTER node [10] SpotCrime
and BEFORE node [11] Merge Normalize Score.**

Uses a single HTTP Request node that calls the PropertyDNA Enrichment Engine,
which internally fires 11 APIs in parallel using Promise.allSettled.

---

## Node [10b] — PropertyDNA Enrichment Engine

**HTTP Request Node**
- Method: `POST`
- URL: `https://thepropertydna.com/.netlify/functions/enrich-property`
- Authentication: Header `x-internal-key` = `{{ $env.INTERNAL_API_KEY }}`
- Timeout: 35 seconds (some APIs take up to 25s)
- On Error: Continue (do not fail workflow)

**Body (JSON):**
```json
{
  "lat":     "{{ $('RentCast Property').item.json.latitude }}",
  "lon":     "{{ $('RentCast Property').item.json.longitude }}",
  "zip":     "{{ $('Normalize Intake').item.json.zip }}",
  "address": "{{ $('Normalize Intake').item.json.address }}",
  "city":    "{{ $('Normalize Intake').item.json.city }}",
  "state":   "{{ $('Normalize Intake').item.json.state }}"
}
```

**Response shape:**
```json
{
  "enriched": true,
  "v3_enriched": true,
  "enriched_at": "2026-04-29T...",
  "locationIntelligence": {
    "_confidence": 67,
    "_subscore": 72,
    "_interpretation": "Walk Score 81/100 (Very Walkable). 3 schools and 8 transit stops within 1.5 miles.",
    "walkScore":  { "walkScore": 81, "transitScore": 62, "bikeScore": 55 },
    "amenities":  { "schoolsNearby": 3, "parksNearby": 5, "transitStopsNearby": 8, "groceryStoresNearby": 2 }
  },
  "marketData": {
    "_confidence": 100,
    "_subscore": 80,
    "fred": { "mortgage30YrRate": 6.82, "nationalHPIYoyPct": 4.1 },
    "hud":  { "fmrTwoBed": 1890, "fmrThreeBed": 2340, "metro": "Los Angeles-Long Beach" },
    "census": { "medianHouseholdIncome": 82400, "medianHomeValue": 720000 }
  },
  "hazardEnrichment": {
    "_confidence": 75,
    "_subscore": 58,
    "femaFlood":  { "zone": "X", "sfha": false },
    "seismic":    { "peakGroundAcceleration": 0.42, "seismicRiskLevel": "Moderate" },
    "environmental": { "ejIndexPctile": 38, "pm25Pctile": 42 },
    "airQuality": { "aqi": 52, "aqiCategory": "Moderate" }
  },
  "rentalAnalysis": {
    "_confidence": 100,
    "_subscore": 62,
    "_interpretation": "HUD FMR 2-bed rent of $1,890/mo implies a 3.2% gross yield."
  },
  "neighborhoodTrajectory": {
    "_confidence": 100,
    "_subscore": 71,
    "laborMarket": { "stateUnemploymentRate": 4.1, "stateAbbr": "CA" },
    "nationalHousing": { "hpiYoyPct": 4.1, "mortgage30YrRate": 6.82 }
  },
  "sourceStatuses": {
    "census": "success",
    "fred": "success",
    "hud": "success",
    "fema_flood_v3": "success",
    "epa_ejscreen": "success",
    "usgs_seismic": "success",
    "airnow": "unavailable",
    "walk_score": "unavailable",
    "osm_amenities": "success",
    "fcc_broadband": "success",
    "bls_unemployment": "success"
  },
  "categoryScores": {
    "locationQuality": 72,
    "marketValueAccuracy": 80,
    "riskScore": 58,
    "rentalYieldPotential": 62,
    "neighborhoodTrajectory": 71,
    "locationConfidence": 67,
    "marketConfidence": 100,
    "riskConfidence": 75,
    "rentalConfidence": 100,
    "trajectoryConfidence": 100
  }
}
```

---

## Node [11] — Merge Normalize Score (Code) — ADD to existing node

In the existing merge/normalize code node, add this at the end:

```javascript
// Merge v3 enrichment into normalized object
const enrichResult = $('Enrichment Engine').item.json;
if (enrichResult && enrichResult.v3_enriched) {
  normalized.enrichment = {
    v3_enriched:            true,
    enriched_at:            enrichResult.enriched_at,
    locationIntelligence:   enrichResult.locationIntelligence   || null,
    marketData:             enrichResult.marketData             || null,
    hazardEnrichment:       enrichResult.hazardEnrichment       || null,
    rentalAnalysis:         enrichResult.rentalAnalysis         || null,
    neighborhoodTrajectory: enrichResult.neighborhoodTrajectory || null,
    sourceStatuses:         enrichResult.sourceStatuses         || {},
    categoryScores:         enrichResult.categoryScores         || {},
  };
}
```

---

## APIs called by the Enrichment Engine

| API | Source | Key Required | What it returns |
|-----|--------|-------------|-----------------|
| US Census ACS 5-year | api.census.gov | CENSUS_API_KEY (free) | Median income, home value, population, rent |
| FRED | api.stlouisfed.org | FRED_API_KEY (free) | 30-yr mortgage rate, national HPI YoY |
| HUD Fair Market Rents | huduser.gov | HUD_API_KEY (free) | FMR by bedroom count and metro |
| FEMA NFHL Flood Zone | hazards.fema.gov | None | Flood zone, SFHA status |
| EPA EJSCREEN | ejscreen.epa.gov | None | Environmental justice index, PM2.5 |
| USGS Seismic | earthquake.usgs.gov | None | Peak ground acceleration, seismic risk level |
| AirNow AQI | airnowapi.org | AIRNOW_API_KEY (free) | Current AQI and pollutant category |
| Walk Score | walkscore.com | WALK_SCORE_API_KEY (paid tiers) | Walk/transit/bike scores |
| OSM Overpass | overpass-api.de | None | Schools, parks, transit, grocery nearby |
| FCC Census Block | geo.fcc.gov | None | Census block FIPS code |
| BLS Unemployment | api.bls.gov | BLS_API_KEY (free) | State unemployment rate |

**All APIs called simultaneously via Promise.allSettled.**
**No single failure blocks the report.** "unavailable" = key not set, "failed" = API error.

---

## Error handling

The Enrichment Engine node should be set to **Continue on Error** in n8n.
If the entire function fails, save-report.js will fire it as a fire-and-forget
background job automatically — so enrichment still happens post-save.

---

## Environment variables required in Netlify

| Variable | Where to get | Tier |
|----------|-------------|------|
| `CENSUS_API_KEY` | api.census.gov/data/key_signup.html | Free |
| `FRED_API_KEY` | fred.stlouisfed.org/docs/api/api_key.html | Free |
| `HUD_API_KEY` | huduser.gov/portal/dataset/fmr-api.html | Free |
| `AIRNOW_API_KEY` | docs.airnowapi.org | Free |
| `WALK_SCORE_API_KEY` | walkscore.com/professional/api.php | Paid tiers |
| `BLS_API_KEY` | data.bls.gov/registrationEngine | Free |
