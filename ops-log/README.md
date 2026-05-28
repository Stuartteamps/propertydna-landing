# PropertyDNA Ops Log

**Mission:** Protect homebuyers & sellers from predatory agents by giving them
asymmetric data on the biggest purchase of their lives. Every task here serves
that — or it doesn't ship.

## Why this folder exists

Tasks have been marked "done" that were only *coded*, not actually *live*.
This log closes that gap. One rule:

> **Nothing is "DONE" without a verification command that proves it's live.**

## Status taxonomy

| Status | Meaning |
|--------|---------|
| ✅ **LIVE** | Verified working in production. Has a re-runnable verify command + observed result. |
| ⚠️ **DORMANT** | Code is written/committed but NOT active in production (missing env var, unrun migration, unflipped switch). The dangerous one — looks done, isn't. |
| 🔴 **BLOCKED** | Can't proceed without an external input (API key, Dan decision, third-party). Names the exact blocker. |
| ⬜ **TODO** | Not started. |

## How to use

- `COMPLETED-LOG.md` — running log, newest first. Every entry has a **Verify:** line.
- When I claim something is done, it goes here with the command to prove it.
- A ⚠️ DORMANT entry is a standing reminder that the job isn't finished.
