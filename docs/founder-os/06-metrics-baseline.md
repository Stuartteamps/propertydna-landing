# Metrics Baseline

**Date:** 2026-07-11. Distinguishes **measurable now** from **UNKNOWN** (no fabrication).

## Analytics reality
- Sink: GA4 `G-S09N9KX1D6` via `window.pdnaTrack` (`index.html:47`) + server KPIs to Supabase `kpi_events`.
- **Before cycle 1:** GA saw `page_view`, `form_started`, `form_submitted`, some page-specific events — **nothing after form submit**. No report-generated, report-viewed, or purchase event. Funnel blind past submit `[FACT]`.
- **After cycle 1 (this branch):** added `report_viewed` (`ReportViewByToken.tsx`), `purchase` (`ReportPending.tsx`), `avm_result` (`PriceCheck.tsx`). Full conversion funnel now has client events end-to-end (pending deploy).

## Funnel definition (target instrumentation)
| Stage | Event | Status |
|---|---|---|
| 1 Impression/landing | `page_view` | ✅ live |
| 2 Address search start | `form_started` / `avm_result` | ✅ (form) / ✅ new (avm) |
| 3 Valid match | `avm_result{matched}` | ✅ new |
| 4 Report requested | `form_submitted` | ✅ live |
| 5 Report generated | server `report_engine_completed` (kpi) | ✅ server-side |
| 6 Report viewed (activation) | `report_viewed` | ✅ **new this cycle** |
| 7 Save/account | (needs event on AuthModal) | ❌ gap → backlog |
| 8 Payment/lead | `purchase` | ✅ **new this cycle** |
| 9 Return visit | GA returning-user | ⚠️ default GA only |
| 10 Referral/share | `share_click` | ✅ live |

## Baseline values
All conversion/retention/revenue baselines: **UNKNOWN** — not present in repo; require pulling GA4 + Supabase `kpi_events`/`payments` after deploy. Do not assume.

| Metric | Value | Source when available |
|---|---|---|
| Unique visitors / wk | UNKNOWN | GA4 |
| Address-search starts | UNKNOWN | `form_started` + `avm_result` |
| Successful matches | UNKNOWN | `avm_result{matched:true}` |
| Report completion rate | UNKNOWN | `kpi_events` completed vs queued |
| Time to report | partially logged | enrich-report timing |
| Activation (report_viewed) | UNKNOWN (now trackable) | GA4 |
| Paid conversion | UNKNOWN (now trackable) | `purchase` + `payments` table |
| Repeat-use / retention cohorts | UNKNOWN | GA4 + reports by email |
| Refund/cancel rate | UNKNOWN | Stripe |
| Valuation error (MdAPE) | measurable via `?live=1` only | `backtest-accuracy.js?live=1` |

## Baseline established this cycle (technical health)
- Tests: **61 passing** (vitest) `[FACT]`.
- Typecheck: **14 pre-existing errors** (not gating build) `[FACT]`.
- Build: **passes** (`npm run build` exit 0) `[FACT]`.
- Functions: 161. Migrations: 38→39 (039 drafted).
