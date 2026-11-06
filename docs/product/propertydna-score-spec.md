# PropertyDNA Score — Governance Spec

**Date:** 2026-07-11 · **Status:** v0 spec (governs existing `computeDNAScore` in `app/frontend/src/lib/dnaScore.ts`). Treat the Score as a **governed product, not a marketing decoration.**

## Purpose
A transparent, explainable summary of how much *verified evidence* supports a property's intelligence profile and valuation — **not** a buy/sell recommendation and **not** a risk-free guarantee.

## Intended user
Homeowners, buyers, sellers, agents. Interpreted as "how well-understood and well-supported is this property's profile," always shown **with** confidence and category breakdown.

## Input categories (proposed, each 0–100 with its own confidence)
1. **Property completeness** — % of core facts present + verified (sqft, beds, baths, year, lot).
2. **Valuation confidence** — from the comp engine's calibrated confidence (see valuation eval framework).
3. **Comparable-market support** — count/quality/recency of arms-length comps.
4. **Physical/environmental risk** — flood/fire/seismic **only where truly queried** (see D1; otherwise `unknown`).
5. **Tax & ownership history** — presence/consistency of assessment + transfer history.
6. **Permit/improvement confidence** — permit data availability.
7. **Market liquidity/location context** — turnover, HPI trend.

## Weighting approach
Explicit, versioned weights (start equal-ish, tune with evidence). **No hidden weighting.** Publish the weight vector per Score version.

## Missing-data treatment (hard rule)
Missing input → the category is `unknown`, **excluded** from the weighted average, and the overall **confidence is reduced**. Missing data must **never** silently score as "good," "low risk," or 0. (Directly addresses risk D1.)

## Confidence
Every Score ships an overall confidence and per-category confidence. Low overall confidence → present the Score as *preliminary*, never definitive.

## Explanations (required on every Score)
- Which categories contributed and their sub-scores.
- What data was missing and how it lowered confidence.
- Evidence links / sources per category (ties to provenance model D4).

## Prohibited interpretations (must be stated)
- Not investment advice; not a guarantee of value or safety.
- Not a substitute for inspection, appraisal, title search, or professional hazard assessment.
- A high Score ≠ good deal; a low Score ≠ bad property (often = thin data).

## Fairness
Score must not encode protected-class proxies. Audit inputs for demographic proxying; document that neighborhood context uses market signals, not protected characteristics.

## Versioning & change management
- Semantic version (e.g. `dna-score@0.1`) stamped on every rendered Score.
- Weight/algorithm changes require: rationale, before/after distribution diff, and a decision-log entry.
- Never silently change scoring for existing reports; re-score = new version stamp.

## Validation methodology
- Backtest category sub-scores against outcomes where ground truth exists.
- Confirm confidence is calibrated (a "high confidence" Score should be right more often).
- Segment validation by city / price band / property type (mirrors valuation eval).

## Current gaps vs this spec
- `computeDNAScore` weighting + missing-data handling need audit against the "never score missing as good" rule.
- Per-category confidence + provenance links not yet surfaced.
- No version stamp on rendered Score yet.
