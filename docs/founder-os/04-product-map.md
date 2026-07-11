# Product Map

**Date:** 2026-07-11. `[FACT]` unless noted.

## Primary journey (the product)
```
Landing (/) → Analyze (/analyze) → PropertyForm
  → check-usage.js (free vs paid)
  → create-checkout.js → Stripe (even "free" routes through checkout/bypass)
  → ReportPending (/report-pending) → verify-payment.js
  → queue-report.js  [insert pending row + view_token, email link, fire enrich]
  → enrich-report.js [comps + valuation + overlays] → save-report [status=completed|insufficient_data]
  → email link → ReportViewByToken (/report/view/:token) → get-report-by-token.js → render
```

## Secondary / teaser journey
```
PriceCheck (/price-check, /is-it-overpriced, /value) → avm.js  [synchronous verdict, no row/email/token]
  → link "Full PropertyDNA report →" → /analyze
```
Also fed by the browser extension (auto-fills address from Zillow/Redfin → PriceCheck).

## Surface inventory (67 routes)
- **Core report:** `/analyze`, `/price-check`, `/report/view/:token`, `/report/:id`, `/sample-report`, `/report-pending`.
- **Discovery/SEO:** `/property/:slug`, `/market/:slug`, `/research`, `/coverage/:slug`, `/blog`, `/neighborhood/:slug`, `/architects`, `/dossiers`, `/pedigree-index`, `/luxury-inventory`.
- **Market data:** `/market-heatmaps`, `/map`, `/ticker/:apn`, `/stock/:symbol`, `/property-ticker`, `/intellagraph`.
- **Segments:** `/professionals`, `/seller-valuation`, `/buyer-access`, `/off-market`, `/open-house`, `/owner-portal`.
- **Account/monetization:** `/dashboard`, `/pricing`, `/watchlist`, `/saved-reports`, `/auth/callback`.
- **Trust/governance:** `/data-integrity/*`, `/methodology`, `/accuracy`, `/buyer-protection`, `/privacy`.
- **Growth/ops:** `/waitlist`, `/newsletter`, `/recruit`, `/partners`, `/launch`, `/admin/*` (ops, kpis, campaigns, dossier-requests, oauth).

## Feature → user → problem → hypothesis map (top features)
| Feature | Primary user | Problem | Hypothesis | Measurable outcome |
|---|---|---|---|---|
| PropertyDNA report | homeowner/buyer | opaque estimates | H1, H7 | report_viewed → purchase rate |
| AVM / PriceCheck | buyer/agent | "is it overpriced?" | H3, H5 | avm_result → analyze click |
| Comparable-sales engine | agent/investor | slow defensible comps | H5, H9 | comp-quality rating |
| Risk/hazard overlay | buyer | hidden costs/risks | H3 | **blocked by D1 trust defect** |
| Saved properties / watchlist | homeowner | track value | H8 | 30-day return rate |
| Seller valuation | seller | pricing guidance | H4 | seller lead conversion |
| Owner portal / corrections | homeowner | wrong data | H1/H10 | claim submissions |
| Professional report / leads | agent/mortgage | client tooling / leads | H5, H10 | lead-quality score |

## Explicitly deferred / speculative (do not build until validated)
IntellaGraph network framing, national "index/exchange" surfaces, multi-state expansion breadth, additional agent automations — all pending evidence per stage gates.
