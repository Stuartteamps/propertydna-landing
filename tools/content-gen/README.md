# Content generation (Claude-powered)

Claude (`claude-opus-4-8`, adaptive thinking, structured output) writing on-brand,
**factual** content. Zero-dependency — runs under bare `node` via the shared
`tools/_anthropic.js` helper. Needs `ANTHROPIC_API_KEY` in the environment.

## `generate-viral.js` — viral content + re-permission email

The engine behind the newsletter fix: pull people in with content worth opting
into, instead of blasting a cold list (the 54-unsubscribe problem).

```bash
ANTHROPIC_API_KEY=… node tools/content-gen/generate-viral.js [context.json] > kit.json
```

Returns JSON:
- `pieces[]` — viral pieces `{ title, platform, format, hook, body, cta }` across Reels / X / LinkedIn, each built on one true, specific data point and driving the free-report opt-in.
- `reengagementEmail` — `{ subject, preheader, bodyText, bodyHtml }`: a **value-first re-permission** email for the cold segment (warm, honest about why they're hearing from us, one "stay in" action, graceful exit).

Pass a `context.json` to ground the content in real numbers/listings (shape =
`DEFAULT_CONTEXT` in the script). **The model is instructed never to invent a
statistic** — anything you don't supply comes back as a bracketed placeholder
(e.g. `[median $/sf]`) for you to fill.

## Integrity

The system prompts forbid fabricated stats, fear-mongering, and attacking
individuals. Output is plain text + simple inline-styled HTML (no scripts/assets).

## Notes
- Default model `claude-opus-4-8`; override with `ANTHROPIC_MODEL=claude-sonnet-4-6` for cheaper runs.
- Raw `https` (not the SDK) to match the repo convention and run without `npm install`.
- See `tools/report-generator/draft-narrative.js` for the report-writing counterpart.
