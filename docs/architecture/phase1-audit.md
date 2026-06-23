# Phase 1 Audit — IntellaGraph Network Transition

**Date:** 2026-06-23
**Branch:** `intellagraph-network-transition`
**Scope:** Evolve PropertyDNA from Palm Springs intelligence app → national home intelligence + transparency platform.

## Brand Architecture (Confirmed)

| Layer | Name | Purpose |
|---|---|---|
| Data engine | **IntellaGraph AI** | Property intelligence + valuation model (existing) |
| Consumer profile | **PropertyDNA** | Per-property reports, DNA scores (existing) |
| Governance | **Data Integrity Office (DIO)** | Methodology transparency, data standards, owner rights, dispute resolution |
| Network | **National Property Intelligence Network (NPIN)** | National property index, market dashboards, owner-verified data layer |
| Marketplace concept | **Intelligence Platform** | Conceptual — NOT a securities exchange |

**Explicitly rejected:** "Home Exchange Commission" (HEC), "National Housing Stock Exchange" (NHSE), "Exchange" framing. These mimic SEC/regulated exchange language and create unacceptable compliance risk without registration.

## Codebase Audit Summary

### What already exists (do not rebuild)

**Routes (67 total).** Notable overlap with proposed new surface:
- `/ticker/:apn` — stock-ticker-style property page (`PropertyTicker.tsx`) — already implements valuation, peers, provenance, pedigree tier
- `/report/view/:token`, `/report/:id` — PropertyDNA report viewing
- `/intellagraph` — IntellaGraph AI panel (Claude Sonnet 4.6 + prompt caching)
- `/market-heatmaps` — heat map rendering (`HeatMapCanvas.tsx`)
- `/dossiers`, `/dossier/:apn`, `/pedigree-index` — luxury inventory
- `/watchlist`, `/watch` — read-only watch list

**Components.** `PropertyTicker.tsx`, `WatchList.tsx`, `HeatMapCanvas.tsx`, `IntellaGraphAIPanel.tsx`, full shadcn/ui primitives, valuation panels (`AdjustmentFactorPanel`, `MarketTrendPanel`, `PropertyEventsPanel`), `AuthModal`, `PricingGate`.

**Supabase tables (extensible — do not migrate).** `property_master` (10M+ rows), `property_history`, `property_intelligence`, `notable_owners`, `architects`, `dossier_requests`, `watched_properties`, `profiles`, `subscriptions`, `kpi_events`.

**Netlify functions (100 total).** Indexers, report pipeline (`queue-report.js` → n8n → `save-report.js`), Stripe, email (Resend), CC OAuth, IAP receipt verification, social, monitoring.

**Auth.** Supabase Auth + Google/Apple/Facebook OAuth + magic link + 6-digit email code (iOS). Tier system: free/premium/unlimited. Stripe live.

**Indexed property data.** 10,023,146 properties across 20 states (TN, MA, GA, MD, VA, SC, NC, NJ, CA, AZ, NV, WA, TX, CT, HI, FL, NY, CO, UT, WY, DC). Coverage map in `memory/indexing_10m_milestone.md`.

### Net-new in Phase 1

| Surface | Type | Notes |
|---|---|---|
| `/owner-portal` | New page | Search + claim entry |
| `/owner-portal/:apn` | New page | Progressive 5-question intake, "Pending verification" badge, writes to `property_owner_claims` queue |
| `/data-integrity` | New static | DIO overview |
| `/data-integrity/methodology` | New static | Valuation model transparency |
| `/data-integrity/data-standards` | New static | What data sources we use, how |
| `/data-integrity/owner-rights` | New static | What an owner can do/dispute |
| `/data-integrity/audit-trail` | New static | How AI decisions are logged |
| `/data-integrity/report-error` | New form | Report a data error → `data_disputes` queue |
| `/network` | New page | NPIN landing — rolls up existing heat map + indexed states + dossiers |
| `capture-owner-claim.js` | New function | POST: address → `property_owner_claims` + email notify |
| `report-data-error.js` | New function | POST: error report → `data_disputes` |

### Deferred to Phase 2+

- Investor marketplace / fractional interest / order matching → requires legal/regulatory clearance
- KYC / identity verification (Persona, Stripe Identity, Plaid) → owner claims stay in "Pending verification" state until this ships
- AI audit trail backend (governance_audit_logs writes) → frontend reads stub data in Phase 1
- Market manipulation detection
- Owner-published "open to offers" / "buy-it-now" → premature without KYC
- Renaming any existing routes (do not touch `/ticker/:apn`, `/intellagraph`, `/market-heatmaps`)

## Critical guardrails

1. **Owner claims never write to live valuation.** The intake form populates `property_owner_claims`. The "Owner-verified" badge requires successful KYC, which isn't built. Until then: "Pending verification" badge always.
2. **No exchange/securities language.** DIO replaces HEC. NPIN replaces NHSE. "Intelligence Platform" replaces "Exchange." Existing disclaimers in `Pricing.tsx` and report footers stay.
3. **No existing route renames.** `/ticker/:apn` and `/intellagraph` stay. New routes added alongside.
4. **No production schema changes in Phase 1.** Migration proposal lives at `supabase/migrations/proposed_phase1_owner_governance.sql` — review only, not applied to prod until Dan confirms.
5. **Stripe, n8n, iOS app, indexers untouched.**

## Reusable building blocks

- `PropertyTicker.tsx` shell → can be reused as Owner Portal property header (already shows valuation + DNA + history)
- `PropertyForm.tsx` / address autocomplete → can be reused for Owner Portal property search
- `WatchList.tsx` patterns → similar list/table UX for owner-claimed properties
- `RequestDossierModal.tsx` → similar modal pattern for "Report Data Error"
- Existing email infra (Resend) → claim submission confirmation, error report ack
