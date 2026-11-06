# PropertyDNA — Current State Map

**Date:** 2026-07-11 · **Audit:** Founder OS, cycle 1 · **Branch:** `claude/propertydna-founder-os-j79t5r`

Evidence labels: `[FACT]` verified in repo · `[OBS]` repository observation · `[HYP]` founder/model hypothesis · `[Q]` open question.

## What PropertyDNA actually is today
A mature, deployed, multi-surface property-intelligence platform — **not** an early prototype:
- `[FACT]` React/Vite SPA (`app/frontend`, 67 routes/pages) + Capacitor iOS/Android wrappers, deployed on Netlify.
- `[FACT]` 161 Netlify serverless functions (`netlify/functions/`) covering the report pipeline, valuation engine, ~20 state property indexers, Stripe, email (Resend), Constant Contact newsletter, CRM/lead capture, and ~8 scheduled "agent" functions.
- `[FACT]` Supabase Postgres, 38 migrations. Prior audit (`docs/architecture/phase1-audit.md`) claims ~10M indexed `property_master` rows across 20 states.
- `[FACT]` Live Stripe (price IDs for report/consumer/pro/investor/enterprise in `.env.example`), GA4 analytics (`G-S09N9KX1D6`).
- `[FACT]` 61 passing unit tests (valuation fixtures, HPI, luxury index) via vitest.

## What works (verified)
- `[FACT]` **Critical journey is structurally complete.** address+email → `queue-report.js` (creates pending row + `view_token`, emails link, fires enrichment) → `enrich-report.js` → `save-report` (marks `completed`/`insufficient_data`) → `ReportViewByToken.tsx` polls `get-report-by-token.js` every 20s ×15 and renders.
- `[FACT]` **Valuation refuses to fabricate.** <3 comps or missing subject facts → `valuationConfidence:"insufficient"`, `marketValue=null`, honest "Still Gathering Data" UI (`enrich-report.js:494-519`, `ReportViewByToken.tsx:260-280`).
- `[FACT]` Leakage-safe backtest exists: `backtest-accuracy.js?live=1` uses only comps with sale date strictly before the subject's, excludes the subject, nulls the anchor (`:222-253`).
- `[FACT]` Tests + typecheck-of-new-code + lint pass.

## Partially implemented
- `[OBS]` **Two divergent valuation stacks:** the comp engine (`_valuation-engine.js`, used by enrich-report/avm) and a percentage-stacking DNA stack in `save-report.js`. The `Methodology.tsx` "5-phase pipeline" describes the latter, not the headline path — unreconciled.
- `[OBS]` Backtest by-property-type collapses to `unknown` (`property_intelligence` has no type column, `backtest-accuracy.js:511-515`); no per-city segmentation despite `Accuracy.tsx` claiming "n≥50 per market."
- `[OBS]` Owner-correction flow (`capture-owner-claim.js`, owner portal) exists but governance table is world-readable (see risk register H3).

## Broken / mocked / silently wrong
- `[FACT]` **Risk overlays default to "no risk" for 49 states.** `buildEarthquakeRisk`/`buildWildfireRisk` return hardcoded `Low` for non-CA, `fetchFemaFlood` defaults missing zone → `X / Minimal Hazard` (`save-report.js:103-140`) — yet label the source "USGS"/"CalFire". `BuyerProtection.tsx:266-276` can render "No material findings" from missing data → an affirmative false all-clear.
- `[FACT]` **14 pre-existing TypeScript errors** (`tsc` not gating the Vite build) across 11 files — technical-debt / drift risk.
- `[OBS]` Enrichment is fire-and-forget (`queue-report.js:347`); if the enrich Lambda dies after receiving the body, the row is never flipped and recovery depends on external cron, not the request. In-product "Check Now" only re-fetches; there is no user-triggered re-enrich.

## Lacks evidence
- `[Q]` No repository evidence of validated demand: no interview notes, no willingness-to-pay data, no cohort/retention data, no real conversion numbers. Many marketing/launch assets exist (`launch-assets/`, `AUDIENCE_ENGAGEMENT_OS.md`) but activation is unmeasured.
- `[FACT]` **Funnel is blind from `form_submitted` onward** — before this cycle, no GA event for report generated, report viewed, or purchase. GA4 could not see a single conversion or dollar.

## Highest-leverage observations
1. **Security:** anon key (public in bundle) can read all reports/profiles and all OAuth refresh tokens (risk register C1/C2/C3). Highest-severity, self-contained fix available.
2. **Instrumentation:** the conversion funnel is unmeasurable — you cannot validate anything without it. (Partially fixed this cycle.)
3. **Trust:** risk overlays presenting hardcoded defaults as sourced data is a credibility + liability exposure that undercuts the core "transparent, evidence-based" promise.
