# n8n Hazard + Hazard Insurance Enrichment Nodes
# Add these nodes to the main property-dna-workflow AFTER the FEMA Flood Zone node

---

## Node 6b — FEMA National Risk Index (NRI)
**Free API. No key required.**

Covers 18 hazard types per county: Earthquake, Wildfire, Hurricane, Tornado,
Riverine Flood, Coastal Flood, Ice Storm, Lightning, Strong Wind, Winter Weather,
Hail, Drought, Landslide, Avalanche, Tsunami, Volcanic Activity.

### HTTP Request Node Setup
- Method: `GET`
- URL (use county FIPS code from Census Geocoder output):
  ```
  https://hazards.fema.gov/nri/api/v2/counties/{{ $('Census Geocoder').item.json.county_fips }}
  ```
  OR by lat/lon (simpler):
  ```
  https://hazards.fema.gov/nri/api/v2/tracts?lon={{ $('RentCast Comps').item.json.longitude }}&lat={{ $('RentCast Comps').item.json.latitude }}
  ```
- No authentication headers needed

### Response Fields to Extract (Code Node after HTTP)
```javascript
const nri = $input.item.json;

// Overall community risk index
const hazardScore    = nri.RISK_SCORE  ?? null;   // 0–100
const hazardRating   = nri.RISK_RATNG  ?? null;   // 'Very High', 'High', 'Relatively High', 'Relatively Moderate', etc.

// Individual hazard scores (RISK_SCORE for each hazard type)
const floodScore     = nri.RFLD_RISKS  ?? null;   // Riverine flood
const wildfireScore  = nri.WFIR_RISKS  ?? null;   // Wildfire
const earthquakeScore= nri.ERQK_RISKS  ?? null;   // Earthquake  
const windScore      = nri.SWND_RISKS  ?? null;   // Strong wind
const tornadoScore   = nri.TRND_RISKS  ?? null;   // Tornado
const hurricaneScore = nri.HRCN_RISKS  ?? null;   // Hurricane

// Insurance risk tier (PropertyDNA logic)
let insuranceRiskTier = 'Standard';
if (hazardScore >= 75) insuranceRiskTier = 'Very High Risk';
else if (hazardScore >= 50) insuranceRiskTier = 'High Risk';
else if (hazardScore >= 25) insuranceRiskTier = 'Elevated';

let insuranceNotes = [];
if (wildfireScore >= 50) insuranceNotes.push('Wildfire exposure — verify FAIR Plan availability');
if (floodScore >= 50)    insuranceNotes.push('Flood risk — NFIP coverage recommended');
if (earthquakeScore >= 50) insuranceNotes.push('Seismic zone — earthquake rider recommended');
if (hurricaneScore >= 50) insuranceNotes.push('Hurricane exposure — wind/hail coverage advised');

return [{
  json: {
    hazard: {
      score:          hazardScore,
      rating:         hazardRating,
      flood:          floodScore,
      wildfire:       wildfireScore,
      earthquake:     earthquakeScore,
      wind:           windScore,
      tornado:        tornadoScore,
      hurricane:      hurricaneScore,
      insuranceTier:  insuranceRiskTier,
      insuranceNotes: insuranceNotes.join(' · ') || 'No elevated hazard flags.',
      raw:            nri,
    }
  }
}];
```

---

## Node 6c — NWS Active Hazard Alerts
**Already have NWS connection — add a second NWS call for alerts.**

### HTTP Request Node Setup
- Method: `GET`
- URL:
  ```
  https://api.weather.gov/alerts/active?point={{ $('RentCast Property').item.json.latitude }},{{ $('RentCast Property').item.json.longitude }}
  ```
- Header: `User-Agent: (PropertyDNA, daniel@thepropertydna.com)`

### Code Node to Process
```javascript
const data = $input.item.json;
const features = data.features || [];

const alerts = features.slice(0, 5).map(f => ({
  event:    f.properties.event,
  severity: f.properties.severity,    // 'Extreme', 'Severe', 'Moderate', 'Minor'
  headline: f.properties.headline,
  onset:    f.properties.onset,
  expires:  f.properties.expires,
}));

return [{ json: { nwsAlerts: alerts, activeAlertCount: alerts.length } }];
```

---

## Node 6d — RentCast Condo/Unit Support
**Fix for "incomplete information" error on condos.**

In the existing RentCast Property Lookup node, add the unit parameter:

```
GET https://api.rentcast.io/v1/properties?address={{ $('Normalize Intake').item.json.address }}&unit={{ $('Normalize Intake').item.json.unit }}&city={{ $('Normalize Intake').item.json.city }}&state={{ $('Normalize Intake').item.json.state }}&zipCode={{ $('Normalize Intake').item.json.zip }}
```

The `unit` field is optional — RentCast ignores it if empty, uses it when present.
This fixes the 422 error returned for condo addresses without a unit number.

---

## Merge Node — Add to Existing "Merge Normalize Score" (Node 11)

Add these fields to your normalization object:

```javascript
// Inside your existing normalizeAndScore function / merge code node:

const hazard  = $('FEMA NRI Code').item.json.hazard  ?? {};
const alerts  = $('NWS Alerts Code').item.json        ?? {};

normalized.hazard = {
  score:          hazard.score,
  rating:         hazard.rating,
  flood:          hazard.flood,
  wildfire:       hazard.wildfire,
  earthquake:     hazard.earthquake,
  wind:           hazard.wind,
  insuranceTier:  hazard.insuranceTier,
  insuranceNotes: hazard.insuranceNotes,
};

normalized.nwsAlerts = alerts.nwsAlerts ?? [];
normalized.activeAlertCount = alerts.activeAlertCount ?? 0;
```

---

## Normalize Intake Node — Add unit + propertyType

In Node 2 (Normalize Intake), extract the new fields from the webhook body:

```javascript
const body = $input.item.json;

const unit         = (body.unit         || '').trim();
const propertyType = (body.propertyType || '').trim();

// Build clean address for RentCast (unit goes as separate param, not in address string)
const addressClean = (body.address || '').replace(/,?\s*(unit|apt|#)\s*[\w\d]+/gi, '').trim();

return [{
  json: {
    ...body,
    address:      addressClean,
    unit,
    propertyType,
    fullAddress:  [addressClean, unit ? `Unit ${unit}` : null, body.city, body.state, body.zip].filter(Boolean).join(', '),
  }
}];
```

---

## Prompt Update — Claude/OpenAI Narrative Node

Add this context to your AI narrative prompt so it uses the hazard and insurance data:

```
Hazard Profile:
- Overall Risk: {{ $('Merge').item.json.normalized.hazard.rating }} ({{ $('Merge').item.json.normalized.hazard.score }}/100)
- Wildfire Risk Score: {{ $('Merge').item.json.normalized.hazard.wildfire }}
- Flood Risk Score: {{ $('Merge').item.json.normalized.hazard.flood }}
- Earthquake Risk Score: {{ $('Merge').item.json.normalized.hazard.earthquake }}
- Insurance Tier: {{ $('Merge').item.json.normalized.hazard.insuranceTier }}
- Insurance Notes: {{ $('Merge').item.json.normalized.hazard.insuranceNotes }}
- Active NWS Alerts: {{ $('Merge').item.json.normalized.activeAlertCount }}

Use the hazard data to give a specific insurance commentary. If wildfire score > 50, mention FAIR Plan.
If in earthquake zone (score > 40), mention earthquake rider. Do not use generic language.
```

---

## What This Adds to Every Report (No Extra Cost)

| Data Point | Source | Cost |
|---|---|---|
| 18-hazard risk score + rating | FEMA NRI API | Free |
| Per-hazard scores (wildfire, flood, earthquake, wind) | FEMA NRI | Free |
| Insurance risk tier + specific notes | PropertyDNA logic | Free |
| Active weather hazard alerts | NWS API | Free |
| Condo/unit lookup fix | RentCast param fix | Free |

---

## Keys Still Needed

| API | Where to Get | Est. Cost |
|---|---|---|
| BuildZoom | buildzoom.com/api | ~$99/mo |
| SpotCrime | spotcrime.com/api | ~$50/mo |
| RentCast | rentcast.io | Already have — confirm plan covers comps |
