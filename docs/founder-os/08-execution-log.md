# Execution Log

## Cycle 1 — 2026-07-11 — Discovery + funnel instrumentation
**Branch:** `claude/propertydna-founder-os-j79t5r`

### Steps performed
1. Repo/business discovery: git state, 161 functions, 38 migrations, 67 routes, tests, analytics, netlify config. Established baseline (61 tests pass, build passes, 14 pre-existing TS errors).
2. Parallel read-only audits (security, valuation/eval, critical-journey/instrumentation) — findings folded into `03-risk-register.md`, `05`, `06`.
3. Traced critical journey; confirmed it works structurally and degrades honestly.
4. **Change shipped (safely reversible, additive):** conversion-funnel instrumentation.
   - New `app/frontend/src/lib/track.ts` — centralized, typed, PII-safe GA4 helper.
   - `ReportViewByToken.tsx` — `report_viewed` (activation) via once-guarded effect.
   - `ReportPending.tsx` — `purchase` (only client-side revenue-confirm point).
   - `PriceCheck.tsx` — `avm_result` on success + error (lead magnet was 100% dark).
5. **Artifact drafted (NOT applied):** `supabase/migrations/039_security_rls_hardening.sql` — closes C1/C2/H1/H2. Requires founder review + manual run + token rotation.

### Acceptance criteria (cycle 1 fix)
- [x] Funnel has client events for report-viewed, purchase, avm result.
- [x] No PII in event params (coarse signals only).
- [x] No new TypeScript errors (still 14 pre-existing; touched files lint clean).
- [x] 61/61 tests pass. Production build passes.
- [x] Additive only — no behavioral change to the report/payment flow; events no-op if GA disabled.

### Validation evidence
```
npx vitest run           → 3 files, 61 passed
npx tsc --noEmit         → 14 errors (all pre-existing; none in track.ts/ReportPending/PriceCheck/RVBT new lines)
npx eslint <4 files>     → exit 0
npm run build            → exit 0
```

### Rollback
Revert the 4 frontend files + delete `track.ts`; the events are additive with no dependents. Migration 039 was never executed.

### Security review of the change (cycle 1)
- `track.ts` swallows all errors, never throws, no-ops when `__pdnaSkipGA`. No secrets. No PII forwarded (verified each call site passes only status/matched/plan/state booleans+enums). No new network endpoints. No auth surface touched.

---

## Cycle 2 — 2026-07-11 — Founder-approved fixes via multi-agent orchestration
**Branch:** `claude/propertydna-founder-os-j79t5r`

Founder approved decisions 1 (migration 039) and 2 (C3). Executed the safely-reversible
code items through an orchestrated Workflow (3 implement agents on disjoint files →
adversarial verify per item → bounded auto-fix), plus C3 by hand.

### Changes shipped
- **C3 (IDOR fix)** — `get-reports.js` now requires a Supabase bearer, verifies it via
  `/auth/v1/user`, derives the email from the token, ignores `body.email`, and gates the
  owner god-view on the verified identity. `Dashboard.tsx` sends the session token.
- **B-03 (hazard trust, D1)** — `save-report.js`: non-CA seismic/wildfire and absent FEMA
  zones now return explicit `{score:null,label:'Not assessed',status:'unavailable',source:null}`
  instead of a fake "Low"/"Minimal Hazard" mislabeled USGS/CalFire/FEMA. `buildRiskProfile`
  averages only assessed hazards (no NaN). `BuyerProtection.tsx` gates the "No material
  findings" all-clear behind `!anyHazardUnavailable` and adds an explicit "Not assessed —
  not an all-clear" block. Genuine CA/real-data logic preserved exactly.
- **B-09 (funnel stage 7)** — `auth.tsx` fires `sign_up`/`sign_in` on SIGNED_IN (once per
  transition), non-PII (`method` provider only).
- **B-13 (tech debt R2)** — all 14 pre-existing TypeScript errors fixed; `tsc` now 0 project-wide.
- **Migration 039** — marked APPROVED with apply + token-rotation runbook. NOT executed by
  the agent (no prod DB credentials); founder runs it in the Supabase SQL editor.

### Validation
```
node --check get-reports.js / save-report.js → OK
npx tsc --noEmit  → 0 errors  (was 14)
npx vitest run    → 61 passed
npm run build     → exit 0
```
Workflow: 6 agents, 0 errors, all 3 items CONFIRMED_GOOD by adversarial verify.

### Not done (still founder-gated / out of scope)
- Running migration 039 + rotating CC/Google tokens (founder action in Supabase/consoles).
- Merge to `main` / production deploy (not authorized — everything stays on the feature branch).
- H3/M1–M5 hardening, D3/D4 remain in backlog.

### Rollback
Revert the cycle-2 files; all changes are additive or behavior-preserving except the
intended C3 auth requirement (which is matched by the Dashboard token send in the same commit).

---

## Cycle 3 — 2026-07-12 — Finish safely-reversible backlog (orchestrated)
**Branch:** `claude/propertydna-founder-os-j79t5r` · Workflow: 10 agents, 0 errors, all 5 items CONFIRMED_GOOD.

### Changes shipped
- **B-05 (governance D2)** — `_valuation-engine.js`, `_valuation_profile.js`, `neighborhood-compare.js`: the unreproducible "97% / 1,459-sold / leave-one-out validated" language is relabeled as an ASPIRATIONAL, not-yet-validated TARGET + a governance guardrail comment. **Comments/doc-strings only** — verified zero non-comment changes; valuation fixtures stay green.
- **B-10 (data integrity D3)** — `backtest-accuracy.js`: default (non-blind) path now emits a `methodology` field in the JSON output flagging it as a calibration check (blind numbers require `?live=1`); `defensibleAccuracyPct` relabeled non-standard and shown alongside within5/10/20; the self-referential consensus ground-truth filter now defaults **OFF** (opt-in via `?consensusFilter=1`, with an effect note).
- **B-14 (security M1/M2)** — `stripe-webhook.js` now fails **closed** (400 if secret unset, signature missing, or verify fails); `debug-report.js` denies when `INTERNAL_API_KEY` is unset.
- **B-16 (security M5)** — `netlify.toml`: additive site-wide `[[headers]]` — HSTS, nosniff, Referrer-Policy, X-Frame-Options, and a **report-only** CSP (non-blocking). CORS tightening (M4) deferred.
- **B-06 (measurement)** — new `netlify/functions/ops-weekly-metrics.js`: INTERNAL_API_KEY-gated (fails closed), aggregates last-7-day funnel from Supabase `kpi_events`/`property_reports`/`payments`/`subscriptions`; GA4-only stages report the literal `UNKNOWN — GA4 only` (no fabrication); every db call degrades to `UNKNOWN` on error.

### Validation
```
node --check (7 functions) → all OK
npx tsc --noEmit → 0 errors
npx vitest run   → 61 passed
npm run build    → exit 0
```
Conductor independently verified: webhook fail-closed diff, B-05 comments-only (0 executable-line changes), report-only CSP, metrics fail-closed + UNKNOWN markers.

### Still founder-gated (unchanged)
Run migration 039 + rotate CC/Google tokens (no prod credentials here). Merge to `main` / production deploy.
