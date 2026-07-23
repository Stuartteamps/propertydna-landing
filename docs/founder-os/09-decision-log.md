# Decision Log

## Cycle 1 — 2026-07-11

- **DL-1 — Ship instrumentation, not the security migration, as the executable change.** The security criticals are higher severity, but applying RLS/JWT changes to live production is an access-control change (founder-approval gated) and could break the live app if mis-sequenced. The funnel instrumentation is additive, reversible, and unblocks all future validation. *Decision: instrument now; deliver security as a reviewed, ready-to-run migration + top founder decision.*
- **DL-2 — Draft migration 039 but do NOT execute it.** Migrations here are applied manually; a file does not run itself. I verified it is behaviorally safe (frontend never reads the affected tables with the anon key; server functions use the service key which bypasses RLS). Applying it is the founder's call (+ requires token rotation after C2). *Rationale: respects the "changes to access controls require human approval" boundary while giving the founder a one-command fix.*
- **DL-3 — Centralize tracking in `lib/track.ts`.** The `window.pdnaTrack` try/catch was being re-inlined per caller. A single typed helper reduces drift and enforces the no-PII rule. *Reversible.*
- **DL-4 — Do not touch the two divergent valuation stacks this cycle.** Reconciling them (R3) is correctness-sensitive and needs its own tested increment; premature change risks the one thing that works (honest valuation). *Deferred to B-15.*
- **DL-5 — No fabricated metrics or interviews.** All baselines marked UNKNOWN until pulled from GA4/Supabase/Stripe. Customer-discovery system to be built, interviews marked pending.
- **DL-6 — Classify stage as MIXED (engineering Scale-shaped, validation Idea/MVP)** rather than "Scale," per the playbook's validated-learning test.

## Open decisions requiring founder (Daniel)
1. **Approve running migration 039** (close C1/C2/H1/H2) + schedule CC/Google **token rotation** immediately after. — *highest priority*
2. **Approve the C3 coordinated change** (get-reports JWT + Dashboard bearer).
3. **Confirm data licensing** for MLS/assessor **display + redistribution** per jurisdiction before scaling display or publishing accuracy (D5).
4. **Confirm** whether validated demand/WTP/conversion data exists outside the repo (affects stage confidence).

## Cycle 2 — 2026-07-11 (founder responded to decisions)
- **Founder APPROVED decision 1 (migration 039) and decision 2 (C3).** Recorded.
- **DL-7 — Executed C3 + safely-reversible backlog (B-03/B-09/B-13) via orchestrated Workflow.** Multiple agents on disjoint files, adversarial verify per item, bounded auto-fix. Conductor independently re-verified diffs (hazard backend, auth event no-PII, all-clear gating) + ran tsc/tests/build.
- **DL-8 — Did NOT run migration 039 or rotate tokens.** The agent has no production Supabase/Constant Contact/Google credentials and must not hold them. Approval clears the gate; execution is a founder action (runbook in the migration file). Not claiming it as done.
- **DL-9 — Did NOT merge to `main` / deploy to production.** Branch-scope rule + prod deploy is outward-facing. Changes pushed to `claude/propertydna-founder-os-j79t5r` only. Recommend running 039 first, then promoting the branch so C3 auth + closed RLS land together.
