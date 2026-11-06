# Stage Assessment (Idea → MVP → Launch → Scale)

**Date:** 2026-07-11. Per the Founder's Playbook, stage is judged by **validated learning**, not feature count.

## Verdict: MIXED — engineering at LAUNCH/SCALE, validation at IDEA/MVP

| Subsystem | Stage | Evidence |
|---|---|---|
| Web/app product surface | **Scale-shaped** | 67 routes, iOS+Android, 161 functions `[FACT]` |
| Data indexing | **Scale-shaped** | ~10M rows / 20 states claimed; nightly indexers `[FACT/OBS]` |
| Report pipeline | **MVP (works)** | End-to-end path completes, degrades honestly `[FACT]` |
| Valuation engine | **MVP** | Produces range+confidence, refuses to fabricate; but uncalibrated confidence, unreconciled dual stack `[FACT]` |
| Monetization | **MVP** | Stripe live, prices set; **no evidence of paying-customer volume or retention** `[Q]` |
| Distribution | **Launch (attempted)** | Heavy launch/growth assets + scheduled agents; **activation unmeasured** `[OBS]` |
| Validation / PMF | **IDEA** | No interviews, WTP data, cohorts, or conversion evidence in repo `[Q]` |
| Security posture | **Pre-MVP gap** | 3 Critical anon-exposure issues `[FACT]` |
| Instrumentation | **Pre-Launch gap** | Funnel blind past `form_submitted` (partially fixed cycle 1) `[FACT]` |

## Why not "Scale"
The playbook's Scale gate requires *validated* product, distribution, and revenue loops with acceptable economics. PropertyDNA has built at Scale-scale but **cannot yet demonstrate** repeatable activation, willingness-to-pay, retention, or unit economics from repository evidence. Building breadth ahead of validation is the central risk.

## Stage confidence
**Medium-high** on the engineering classification (directly observed). **Medium** on the validation classification — absence of evidence in the repo is not proof of absence; the founder may hold conversion/WTP data outside the repo `[Q for founder]`.

## What would move the needle to a defensible "Launch"
1. A live, instrumented funnel (impression → search → match → report generated → viewed → paid) with ≥2 weeks of data.
2. ≥5 structured customer interviews per priority segment with WTP signal.
3. One monetization experiment with a real conversion number and a defined pass/fail threshold.
4. Security criticals closed (trust precondition for putting real users through the funnel).
