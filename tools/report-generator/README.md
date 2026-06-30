# PropertyDNA Buyer Intelligence Report — reusable generator

Turns a normalized property **config (JSON)** into the premium, self-contained
Buyer Intelligence Report (web + mobile responsive + print/PDF) used for
50220 Via Puente and 9520 Ekwanok. One template, many properties.

```
node tools/report-generator/generate.js <config.json> --pdf
```

Outputs:
- `app/frontend/public/listings/r-<token>.html` — the report (public, no-login, `noindex`, 30-day client-side expiry gate)
- `app/frontend/public/listings/r-<token>.pdf` — print-quality PDF (with `--pdf`)
- prints the shareable URL + email subject

To **publish**, commit those two files and push (Netlify serves
`public/listings/` at `https://www.thepropertydna.com/listings/r-<token>.html`).
PDFs of signed/sensitive documents are **not** hosted — only the report.

## Files
- `render.js` — pure, dependency-free renderer. `renderReport(data) -> html`. Exports `src()`, `unavail()`, `esc()` helpers. All CSS/chrome lives here.
- `generate.js` — CLI: mints token + 30-day expiry, writes HTML, renders PDF, prints URLs.
- `examples/example-config.json` — worked example exercising every block type.

## Data model (`config.json`)
```jsonc
{
  "theme": "gold" | "teal",            // gold = luxury accent, teal = value accent
  "meta":  { "title": "...", "description": "...", "token": "optional" },
  "hero":  {
    "title": "9520 Ekwanok Drive",
    "addr2": "Mission Lakes Country Club · Desert Hot Springs, CA 92240",
    "tags":  [ { "b": "$395,000", "text": "list price" }, ... ],
    "badges":[ { "tone": "gold|g|a", "text": "..." } ],
    "note":  "html string shown as a callout under the hero"
  },
  "sections": [ { "num": "01", "id": "summary", "title": "...", "subtitle": "...",
                  "page": false,           // true => page-break before (print)
                  "blocks": [ ... ] } ],
  "footer": { "line": "html", "disclaimer": "html" }
}
```

### Block types (inside `section.blocks[]`)
| type | shape | renders |
|------|-------|---------|
| `stats` | `{ tiles:[{lab,val,sub,tone}] }` | 3-up stat tiles (`tone`: gold/teal/green) |
| `cards` | `{ cols:2\|3\|4, keep:bool, cards:[{h3\|h4, html}] }` | card grid |
| `table` | `{ head:[str\|{label,num}], rows:[[cell]\|{subject,cells}] }` | bordered table; `subject:true` highlights the subject row; `num:true` right-aligns |
| `scores`| `{ items:[{nm,val,max=10,warn}] }` | labelled score bars |
| `kv`    | `{ title, items:[{k,v}] }` | key/value card |
| `list`  | `{ h3, color, tone:'pos'\|'con', items:[html] }` | bulleted card |
| `prose` | `{ html }` | lead paragraph |
| `note`  | `{ html }` | muted footnote/callout |
| `ribbon`| `{ badges:[{tone,text}] }` | badge row |
| `legend`| `{ tags:['mls','dna','mkt','risk','cmty','geo'] }` | source-chip legend |
| `html`  | `{ html }` | raw escape hatch |

Cell/`html` fields accept inline HTML, so embed source chips directly:
`<span class="src mls">MLS</span>`, `<span class="src dna">DNA</span>`, etc.
Use `<span class="unavail">Data unavailable.</span>` for anything unverifiable.

## Source-tag convention
`MLS` (listing + assessor) · `DNA` (PropertyDNA model) · `MKT` (market stats/comps) ·
`RISK` (climate/hazard) · `CMTY` (community/club/golf) · `GEO` (geography/proximity).

## Integrity rules (enforced by authoring, not code)
- Never invent. If a fact isn't in the MLS sheet or a cited source, mark it `Data unavailable.`
- Separate **verified MLS facts** from interpretation/observation.
- Listing photos from secured flexmls share links are usually not machine-readable → make **no** AI photo-derived claims unless you actually have the images.
- The PropertyDNA value is a comparative model output, **not** a USPAP appraisal — always say so.

## Optional: Claude-drafted narrative (`draft-narrative.js`)

The prose sections (one-paragraph read, why-it-stands-out, buyer advantages,
strengths/considerations, final recommendation) can be drafted by Claude
(`claude-opus-4-8`) from the **verified** data packet instead of hand-authored:

```bash
ANTHROPIC_API_KEY=… node tools/report-generator/draft-narrative.js property-data.json > narrative.json
```

`property-data.json` = the verified facts + research the agent already gathered
(MLS fields, valuation, comps, community, risk, proximity, buyer profile, any
pricing directive). The model returns `{ oneParagraphRead, whyItStandsOut[],
buyerAdvantages[], strengths[], considerations[], recommendation }` as HTML
fragments with inline source chips — slot them straight into the section blocks.

**Integrity is enforced in the prompt:** uses only provided facts, never invents,
writes `Data unavailable.` for gaps, keeps verified vs. observed separate, and
honors a pricing directive only where the evidence supports it. It still requires
human/agent review before publish — Claude writes the prose, the data stays the source of truth.

Needs `ANTHROPIC_API_KEY`; raw `https` (no SDK) so it runs without `npm install`.

## The agent

The `buyer-report-builder` agent automates the full pipeline (research → config →
generate → publish → email). See `.claude/agents/buyer-report-builder.md`.
