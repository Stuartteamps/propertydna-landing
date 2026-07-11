# PropertyDNA Founder Dashboard

*Updated: 2026-07-11 (Founder OS cycle 1)*

## Current stage
**MIXED** — engineering is Launch/Scale-shaped; validation is Idea/MVP.

## Stage confidence
Medium-high (engineering, observed) · Medium (validation — pending founder data outside repo).

## Core user
Coachella Valley homeowner/buyer seeking a *trustworthy* property report (primary wedge). Agent (B2B) is the strong secondary.

## Core problem
Online home-value estimates are opaque and untrusted; buyers/sellers lack property-specific, evidence-backed intelligence with honest confidence.

## Current product promise
"Every property has a DNA. We decode it." — a transparent PropertyDNA report: valuation *range* + confidence, comps with reasons, risks, next steps.

## This week's objective
Close the Critical anon-exposure holes and stand up a measurable conversion funnel so the next decisions use real data.

## North-star metric
Weekly **activated reports** (report_viewed with real value) → and its conversion to **paid**.

## Critical funnel
landing → address search → valid match → report generated → **report viewed (activation)** → **paid** → return → refer.

## Current baseline
61 tests pass · build passes · 14 pre-existing TS errors · 161 functions · 39 migrations. All conversion/revenue/retention baselines: **UNKNOWN** (now instrumented; pull after deploy).

## Completed this cycle
- Full discovery + stage assessment + risk/product/data/metrics registers.
- **Conversion funnel instrumented** (`report_viewed`, `purchase`, `avm_result`) via new centralized `lib/track.ts` — additive, tested, build-clean.
- **Security remediation migration 039 drafted** (ready to run, not applied).

## Evidence
`vitest` 61/61 · `npm run build` exit 0 · `eslint` clean on touched files · no new type errors. Findings cross-verified by 3 independent audits.

## Experiments running
None yet (no live funnel data pre-deploy). First: B-11 free-summary vs paid-full (after funnel data lands).

## Decisions required from founder
1. **Approve running migration 039** + rotate Constant Contact/Google OAuth tokens right after. *(Critical, fastest high-value risk kill.)*
2. Approve the **C3** coordinated change (get-reports JWT + Dashboard bearer).
3. Confirm **MLS/assessor display+redistribution licensing** per jurisdiction (D5).
4. Do you hold **demand/WTP/conversion data** outside the repo? (sets stage confidence).

## Blockers
Security criticals are a trust precondition for driving real users into the funnel. Hazard trust defect (D1) blocks the buyer/risk value prop.

## Security/data risks
3 Critical (C1/C2/C3), High (H1/H2/H3, D1/D2). See `03-risk-register.md`.

## Revenue indicators
Stripe live; prices set. Actual conversions/MRR/refunds **UNKNOWN** — now trackable via `purchase` + `payments`.

## Technical health
Good test coverage on valuation core; honest degradation; **but** 14 TS errors ungated, dual valuation stacks, fire-and-forget enrichment.

## Next three actions
1. Founder approves → run migration 039 + rotate tokens (B-01).
2. Ship hazard-overlay trust fix (B-03).
3. Stand up weekly metrics dashboard from GA4/kpi_events/Stripe (B-06).

## Explicitly not doing
National expansion breadth, IntellaGraph/"exchange" surfaces, new agent automations, valuation-stack rewrite — until validation gates pass.

## Current stage-exit gaps (to reach defensible "Launch")
Measurable funnel with ≥2 wks data · ≥5 interviews/segment with WTP · one monetization experiment with a real conversion number + threshold · security criticals closed.
