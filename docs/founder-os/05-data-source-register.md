# Data Source Register

**Date:** 2026-07-11 · `[FACT]` from code; licensing status `[Q]` requires founder/legal confirmation.

| Source | Used for | Where (code) | Provenance stamped? | Licensing/terms | Notes |
|---|---|---|---|---|---|
| County assessor / ArcGIS parcel layers (20 states) | `property_master` facts, APN, sqft/beds | `index-*.js` indexers | Partial (`source` label, no date) | `[Q]` per-county terms | ~10M rows claimed; dedupe by APN |
| CREST assessor | subject facts (precedence #1) | `enrich-report.js:420-425` | No `retrievedAt` | `[Q]` | merged over master/properties |
| MLS-derived sold comps | comparable sales | `lookupSoldComps` `enrich-report.js:248` | No | `[Q] critical` — display rights vary | arms-length filter applied |
| RentCast | independent AVM benchmark | `backtest-accuracy.js:617`, collectors | n/a | API terms | benchmark only |
| FEMA NFHL | flood zone | `save-report.js:103` | `source` label | public | **defaults missing→"X/Minimal"** (D1) |
| USGS | seismic | `save-report.js:127` | label only | public | **hardcoded Low for non-CA** (D1) |
| CalFire FHSZ | wildfire | `save-report.js:148` | label only | public | **city-heuristic, not real lookup** (D1) |
| Census / ACS | demographics | `save-report.js:87` | `source` | public | |
| FHFA HPI | appreciation-to-today | `_hpi_index.js:215-273` | Yes (indexSource, confirmed/derived) | public | best-documented provenance |
| NWS / weather | environmental context | `enrich-report.js` weather | partial | public | |
| OpenStreetMap / mapping | maps, location | frontend map components | n/a | ODbL attribution `[Q]` | check attribution reqs |
| Google Places | address autocomplete | `lib/googlePlaces.ts` | n/a | Google terms | key restriction `[Q]` |
| Stripe | payments | `create-checkout.js` etc. | n/a | — | live |
| Constant Contact / Resend | email | CC + `_email.js` | n/a | — | OAuth tokens (C2 risk) |

## Gaps
- **D4:** No first-class provenance model — add `{value, source, sourceUrl, retrievedAt, confidence, jurisdiction}` per fact.
- **D5:** MLS/assessor **display + redistribution licensing** unverified per jurisdiction — must resolve before scaling display or publishing accuracy.
- Hazard sources (FEMA/USGS/CalFire) are **labeled but not truly queried** for most states — fix labels + states (D1).
