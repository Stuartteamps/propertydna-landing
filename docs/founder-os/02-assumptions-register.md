# Assumptions Register + Hypothesis Inventory

**Date:** 2026-07-11. Each hypothesis needs: segment · job-to-be-done · current alternative · evidence today · strongest counter · cheapest test · pass/fail threshold · next action.

## Operating assumptions made this cycle (safest reversible)
| # | Assumption | Basis | Reversible? |
|---|---|---|---|
| A1 | Migrations are applied manually, not auto-deployed on push | `RUN_THIS_ONCE.sql`, manual runbooks in `supabase/` `[OBS]` | Yes — adding a migration file does not execute it |
| A2 | Frontend never reads PII tables (reports/profiles/oauth_tokens) with the anon key | grep of `.from()` shows only catalog tables `[FACT]` | N/A |
| A3 | GA4 (`window.pdnaTrack`) is the single analytics sink | `index.html:47` `[FACT]` | Yes |
| A4 | The `queue-report` full-report flow is the primary product path; PriceCheck/AVM is a top-of-funnel teaser | route + code trace `[FACT]` | Yes |
| A5 | Founder = Daniel (`stuartteamps@gmail.com`, owner bypass in `check-usage.js`) | `[FACT]` | N/A |

## Hypothesis inventory (H1–H10)
Status is **UNVALIDATED** for all unless noted; no interview/WTP data found in repo `[Q]`.

- **H1 — Consumers distrust opaque home-value estimates.** Segment: homeowners/buyers. Alternative: Zillow Zestimate. Evidence today: none in repo. Counter: they may trust Zillow enough. Test: landing A/B "transparent range + why" vs generic estimate; 5 homeowner interviews. Pass: ≥40% cite distrust of opaque estimates unprompted. Fail: <20%. Next-pass: lead with transparency wedge. Next-fail: reposition value prop.
- **H2 — Homeowners want to know *why* value changed.** Test: instrument clicks on "why" explainers; interview. Pass: >30% expand explainer. 
- **H3 — Buyers want property-specific risks/hidden costs pre-offer.** Test: BuyerProtection page engagement + interviews. **Blocked** by risk-overlay defaulting (must fix trust first).
- **H4 — Sellers want better-than-generic pricing guidance.** Segment: sellers. Test: SellerValuation conversion.
- **H5 — Agents need faster defensible comps.** Test: 5 agent interviews; time-to-CMA saved. Pass: ≥3/5 would use weekly.
- **H6 — Investors want standardized screening + confidence.** Test: investor interviews; AVM usage.
- **H7 — Users will pay for a transparent report w/ evidence + next steps.** Test: the paid-report conversion event (now instrumented). Pass: ≥3% of report-viewers purchase within session/7d. Fail: <1%.
- **H8 — Saved-property alerts drive repeat usage.** Test: watchlist opt-in + 30-day return rate.
- **H9 — Community-specific comp logic materially improves usefulness** in gated/golf/condo communities. Partial engine exists (`_community_comps.js`). Test: comp-quality rating community vs radius.
- **H10 — PropertyDNA can create qualified leads without degrading trust.** Test: lead-quality score + consumer trust survey.

**Priority order for validation (this quarter):** H7 (revenue) → H1 (core wedge) → H5 (agent B2B path) → H9 (differentiation).

## Customer-discovery system status
Interview guides, note template, tagging taxonomy, objection/WTP/feature-request trackers: **TO BUILD** (marked pending). No fabricated interviews. See backlog item B-08.
