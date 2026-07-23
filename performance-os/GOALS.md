# Arete — Autonomous Hardening Goals & Progress

Full authorization to commit/push. Orchestrated: one adversarial audit workflow (31 agents:
6 Sonnet-5 finders → 24 Opus verifiers → Opus synthesis) produced a verified 12-item backlog,
then implemented top-down in the main loop with a test/lint/typecheck gate after every change.
Deploy of the running service still needs your Fly/Apple tokens; every change is committed so it
goes live on your next `fly deploy` / `eas build`.

## Measurable goals — FINAL
| # | Goal | Metric | Baseline | Final | Status |
|---|------|--------|----------|-------|--------|
| G1 | Backend tests pass | pytest | 53 / 0 | 77 / 0 | 🟢 +24 |
| G2 | Backend lint clean | ruff errors | 0 | 0 | 🟢 |
| G3 | Mobile typecheck clean | tsc errors | 0 | 0 | 🟢 |
| G4 | Mobile tests pass | jest | 9 / 0 | 15 / 0 | 🟢 +6 |
| G5 | Security review | unaddressed critical/high | 2 crit / 5 high | 0 | 🟢 |
| G6 | Spec-completeness gaps | verified gaps closed | — | 12 / 12 backlog | 🟢 |
| G7 | Production readiness | verified issues addressed | — | all high addressed | 🟢 |
| G8 | Real AI default (Sonnet 5) | prod config | mock | anthropic/claude-sonnet-5 | 🟢 |

## Backlog — all 12 items shipped
| # | Item | Sev | Commit |
|---|------|-----|--------|
| 1 | Fail-closed SECRET_KEY (JWT-forgery bypass) | critical | security cluster |
| 2 | User timezone for all day-scoped data | high | timezone |
| 3 | DELETE /account cascades to every table | high | security cluster |
| 4 | Mobile workout logging screen | high | mobile cluster |
| 5 | Mobile journal screen | high | mobile cluster |
| 6 | Notification subsystem + quiet hours | high | notifications |
| 7 | Weekly nutrition adjustment endpoint | med | feature cluster |
| 8 | Full micronutrient persistence | med | feature cluster |
| 9 | Per-user AI rate limiting | med | security cluster |
| 10 | Expired-token bootstrap → /login | med | mobile cluster |
| 11 | Env-gated CORS + upload hardening | med | security cluster |
| 12 | Pagination + N+1 fixes | med | pagination |

## Verification method (graph, executed)
```
Audit (6 Sonnet-5 dimension finders)
  → Verify each finding (24 Opus skeptics, default-refute) → 24 confirmed
    → Synthesize ranked backlog (Opus) → 12 items
      → Implement top-down (main loop) → gate: pytest + ruff + tsc + jest after each
        → commit/push green increments (8 commits) → backlog drained
```

## Progress log
- Prod AI default → Claude Sonnet 5.
- Security cluster (#1,#3,#9,#11), feature cluster (#7,#8), pagination (#12),
  timezone (#2), mobile cluster (#4,#5,#10), notifications (#6) — all shipped + tested.
- 3 Alembic migrations added (adjustment cols, profile tz, notification tables).
- Net: 53→77 backend tests, 9→15 mobile tests, 0 lint/type errors, 0 unaddressed crit/high.
