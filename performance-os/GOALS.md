# Arete — Autonomous Hardening Goals & Progress

Full authorization to commit/push. Orchestrated with multi-agent workflows (audit → verify →
implement → re-verify), models chosen per task for token efficiency (Sonnet 5 finders, Opus
verify/synthesis, Fable/Haiku mechanical). Deploy of the running service still needs your Fly/Apple
tokens; every change here lands so it's live on your next `fly deploy` / `eas build`.

## Measurable goals (gate = must stay green)
| # | Goal | Metric | Baseline | Target | Status |
|---|------|--------|----------|--------|--------|
| G1 | Backend tests pass | pytest passed/failed | 53 / 0 | ≥53 / 0, grow coverage | 🟢 53/0 |
| G2 | Backend lint clean | ruff errors | 0 | 0 | 🟢 |
| G3 | Mobile typecheck clean | tsc errors | 0 | 0 | 🟢 |
| G4 | Mobile tests pass | jest passed/failed | 9 / 0 | ≥9 / 0 | 🟢 9/0 |
| G5 | Security review | unaddressed high/critical | unknown | 0 | ⏳ auditing |
| G6 | Spec-completeness gaps closed | verified gaps implemented | unknown | top-priority set | ⏳ auditing |
| G7 | Production readiness | verified issues addressed | unknown | 0 high | ⏳ auditing |
| G8 | Real AI default (Sonnet 5) | prod config | mock | anthropic/claude-sonnet-5 | 🟢 set |

## Method (graph)
```
Audit (6 parallel dimensions, Sonnet 5)
  → Verify each finding (adversarial, Opus)
    → Synthesize + rank (Opus) → prioritized backlog with per-task specs
      → Implement top disjoint items (main loop, verified per change)
        → Re-run full gate (tests/lint/typecheck) → commit/push
          → loop until backlog of high-value verified items is drained
```

## Progress log
- Set production AI default to Claude Sonnet 5 (`fly.toml`); local dev stays mock (keyless).
- Launching audit workflow across correctness, security, spec-completeness, test-coverage,
  mobile-completeness, production-readiness.
