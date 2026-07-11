# Risk Register

**Date:** 2026-07-11 · Severity: Critical / High / Medium / Low. Findings verified by parallel security, valuation, and journey audits (cycle 1).

## SECURITY (remediation drafted in `supabase/migrations/039_security_rls_hardening.sql` — NOT yet applied)

| ID | Sev | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|---|
| C1 | **Critical** | `property_reports` + `profiles` grant `anon` SELECT on ALL rows. Public anon key → dump every email, full address, report JSON, `view_token`, `stripe_customer_id`. | `002_rls.sql:18-19,35-36` `USING(true)`; key in `lib/supabase.ts:4` | Drop the two anon-select policies (migration 039). Server paths use service key — safe. | **Drafted, awaiting founder go** |
| C2 | **Critical** | `oauth_tokens` has RLS disabled → plaintext CC/Google refresh tokens readable with public key → integration takeover. | `016_oauth_tokens.sql` (no ENABLE RLS) | Enable RLS, no anon policy; **rotate tokens after**. (migration 039) | **Drafted** |
| C3 | **Critical** | `get-reports.js` trusts client-supplied `email` with no JWT → IDOR; owner email dumps entire report corpus. | `get-reports.js:18-40` | Require bearer, verify via `/auth/v1/user`, ignore body email. **Needs Dashboard to send token (`Dashboard.tsx:74`)** — coordinated deploy. | **Needs founder-approved coordinated change** |
| H1 | High | `campaigns`/`campaign_contacts`/`campaign_unsubscribes` `FOR ALL USING(true)` no `TO` → public read+write+delete of marketing contacts. | `011_campaigns.sql:64-66` | Scope to `service_role` (migration 039). | Drafted |
| H2 | High | RLS disabled on `waitlist`, `device_tokens`, `notification_preferences`, and others (`sona_state`, `buyer_*`, `agent_*`, `report_events`, `data_quality_issues`). | migrations 015/034/036/037 | Enable RLS + service-role policies; verify insert paths. (039 covers the top 3) | Partial in 039 |
| H3 | High | Owner-governance table `FOR SELECT USING(true)` — owner claim PII public. | `033_phase1_owner_governance.sql:148` | Scope select to service_role/staff. | Backlog |
| M1 | Med | Stripe webhook accepts all posts when secret unset (`stripe-webhook.js:22` `return true`). | | Fail closed. | Backlog |
| M2 | Med | `debug-report.js` auth bypass when `INTERNAL_API_KEY` unset. | `:25` | Require key; 401 if absent. | Backlog |
| M3 | Med | `upsert-profile.js` writes profile from unauthenticated client identity. | `:20-34` | Verify JWT. | Backlog |
| M4 | Med | 108 functions use `Access-Control-Allow-Origin: *` incl. mutating/PII endpoints. | | Restrict ACAO on state-changing endpoints. | Backlog |
| M5 | Med | No CSP / HSTS in `netlify.toml`. | | Add global security headers. | Backlog |
| L1 | Low | Publishable key + project URL hardcoded as literal fallbacks. | `_supabase.js:10`, `lib/supabase.ts:4` | Require env; drop literal. | Backlog |

Positive controls: `delete-account.js` verifies bearer; `view_token` is `crypto.randomUUID()` (122-bit); Stripe prices server-side; no live secrets committed; `.env.example` placeholders only.

## DATA / TRUST / LEGAL

| ID | Sev | Finding | Evidence | Remediation |
|---|---|---|---|---|
| D1 | **High** | Risk overlays default to `Low`/`Minimal Hazard` for 49 states via city-name heuristics while labeling source "USGS"/"CalFire". Missing data can render to a buyer as an affirmative all-clear. | `save-report.js:103-140`, `BuyerProtection.tsx:266-276` | Use explicit `unknown`/`unavailable` states; never label a hardcoded default with a real source name; suppress "no findings" when data is absent. |
| D2 | **High** | Unreproducible "97% / ≤3% MdAPE / 1,459 solds leave-one-out validated" claim embedded as fact in code header. Not currently published (good), but a governance landmine. | `_valuation-engine.js:4-17` | Move to an aspirational-target note; gate any public accuracy claim behind the eval framework (see valuation-engine.md). |
| D3 | Med | Backtest default path is a self-admitted calibration check (anchored on subject's prior sale) + filters ground truth using model output → inflates measured accuracy. | `backtest-accuracy.js:16-19,566-608` | Publish only `?live=1` blind numbers; remove self-referential ground-truth filtering. |
| D4 | Med | No provenance timestamps (`asOf`/`retrievedAt`) on displayed facts; `source` is free-text and only on some overlays. | schema sweep | Add a provenance model; stamp retrieval date per fact. |
| D5 | Med | MLS/assessor data display + licensing terms not verified per-jurisdiction. | indexers across 20 states | Legal review of source terms before broad display/scaling. `[Q founder]` |

## RELIABILITY / TECH DEBT

| ID | Sev | Finding | Remediation |
|---|---|---|---|
| R1 | Med | Enrichment fire-and-forget; stuck reports rely on cron, no in-product re-enrich. | Add user-triggered re-enrich; harden delivery guarantee. |
| R2 | Med | 14 pre-existing TS errors; `tsc` not gating build. | Fix + add typecheck to CI. |
| R3 | Med | Two divergent valuation stacks unreconciled; Methodology page describes the non-headline one. | Reconcile or clearly document which produces the headline value. |

## TOP 5 RISKS (this cycle)
1. **C1/C2 mass PII + token exposure via public anon key** (Critical).
2. **C3 report-corpus IDOR** (Critical).
3. **D1 false "no-risk" hazard defaults** presented as sourced (trust/liability).
4. **Funnel blindness** (can't validate anything) — partially fixed this cycle.
5. **D2 unreproducible accuracy claim** leaking into marketing.

## TOP 5 GROWTH CONSTRAINTS
1. No measurable activation funnel (fixed partially cycle 1).
2. No validated willingness-to-pay evidence.
3. No customer-discovery loop running.
4. Trust defects (D1/D2) block the buyer/risk value prop.
5. Breadth-over-depth: 20 states indexed before one geography's economics proven.
