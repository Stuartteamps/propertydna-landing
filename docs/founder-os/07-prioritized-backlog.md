# Prioritized Backlog

**Date:** 2026-07-11. Weighted score = `2·UserImpact + 2·RiskReduction + 2·ValidationValue + 1.5·Revenue + 1·Differentiation + 1·Reversibility − 1.5·Effort` (each 1–5). Higher = do sooner. Priority order follows the playbook: security/data-loss → broken journey → instrumentation → provenance/trust → validation → activation → monetization → automation → expansion.

| ID | Task | Score | Sev/Type | Reversible | Status |
|---|---|---|---|---|---|
| **B-01** | Apply security migration 039 (C1/C2/H1/H2) — close anon PII/token exposure | 33 | Critical security | Yes (rollback SQL incl.) | **APPROVED — founder runs migration 039 + rotates tokens** |
| **B-02** | C3: add JWT to `get-reports.js` + send bearer from `Dashboard.tsx` (coordinated deploy) | 31 | Critical security | Yes | **DONE cycle 2** |
| **B-03** | D1: hazard overlays — explicit `unknown` states, stop labeling hardcoded defaults "USGS/CalFire", suppress false "no findings" | 30 | High trust/legal | Yes | **DONE cycle 2** |
| **B-04** | ✅ Instrument conversion funnel (report_viewed, purchase, avm_result) | 29 | Instrumentation | Yes | **DONE cycle 1** |
| B-05 | D2: relabel "97%/1,459-sold" code claim as aspirational target; guard rails against publishing | 24 | High governance | Yes | **DONE cycle 3** |
| B-06 | Weekly metrics: `ops-weekly-metrics.js` (Supabase kpi/reports/payments; GA-only stages UNKNOWN) | 24 | Measurement | Yes | **DONE cycle 3 (fn; GA4 join pending)** |
| B-07 | R1: user-triggered re-enrich button + delivery guarantee for stuck reports | 22 | Reliability | Yes | Backlog |
| B-08 | Customer-discovery system: interview guides + trackers (H1/H5/H7) | 22 | Validation | Yes | Backlog |
| B-09 | Save/account-creation GA event (funnel stage 7 gap) | 20 | Instrumentation | Yes | **DONE cycle 2** |
| B-10 | D3: backtest flags non-blind default path in output; consensus ground-truth filter now defaults OFF | 20 | Data integrity | Yes | **DONE cycle 3** |
| B-11 | Experiment: free-summary vs paid-full-report (H7) with pass/fail thresholds | 19 | Monetization | Yes | Backlog (needs B-04 data) |
| B-12 | D4: provenance model (`asOf`/`source`/`confidence` per fact) | 18 | Trust arch | Yes | Backlog |
| B-13 | R2: fix 14 TS errors (DONE cycle 2) + add typecheck to CI gate (pending) | 16 | Tech debt | Yes | **Partial — tsc 0; CI gate pending** |
| B-14 | M1/M2 fail-closed on missing Stripe/internal secrets (stripe-webhook, debug-report) | 16 | Security | Yes | **DONE cycle 3** |
| B-15 | R3: reconcile dual valuation stacks / correct Methodology page | 15 | Correctness/clarity | Yes | Backlog |
| B-16 | M5: site-wide HSTS/nosniff/referrer/frame + report-only CSP (DONE); M4 CORS tightening pending | 14 | Security hardening | Yes | **Partial — headers DONE cycle 3; CORS pending** |

## Next 3 (recommended)
1. **B-01** (founder approves → run migration 039; rotate CC/Google tokens).
2. **B-03** (hazard trust fix — unblocks the buyer/risk value prop).
3. **B-06** (stand up the weekly dashboard so cycle-2 decisions use real funnel data).
