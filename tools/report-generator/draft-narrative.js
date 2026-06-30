#!/usr/bin/env node
'use strict';
/**
 * draft-narrative — Claude-drafted prose for the Buyer Intelligence Report.
 *
 *   node tools/report-generator/draft-narrative.js property-data.json > narrative.json
 *
 * Input: a JSON object of VERIFIED facts + research the agent has already gathered
 * (MLS fields, valuation, comps, community, risk, proximity). Output: institutional
 * narrative blocks (JSON) the agent merges into the generator config (see
 * tools/report-generator/README.md). Claude writes the prose; it does not invent facts.
 *
 * Model: claude-opus-4-8, adaptive thinking, structured output. Requires ANTHROPIC_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const { callClaude } = require('../_anthropic');

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['oneParagraphRead', 'whyItStandsOut', 'buyerAdvantages', 'strengths', 'considerations', 'recommendation'],
  properties: {
    oneParagraphRead: { type: 'string', description: 'One tight paragraph (HTML fragment). The honest, evidence-led read.' },
    whyItStandsOut: {
      type: 'array', description: '4–6 differentiation cards.',
      items: { type: 'object', additionalProperties: false, required: ['title', 'html'],
        properties: { title: { type: 'string' }, html: { type: 'string', description: 'HTML fragment, 1–2 sentences, with inline source chips.' } } },
    },
    buyerAdvantages: {
      type: 'array', description: '4–6 buyer-advantage cards keyed to the buyer profile.',
      items: { type: 'object', additionalProperties: false, required: ['title', 'html'],
        properties: { title: { type: 'string' }, html: { type: 'string' } } },
    },
    strengths: { type: 'array', items: { type: 'string', description: 'HTML bullet fragment with a source chip.' } },
    considerations: { type: 'array', items: { type: 'string', description: 'HTML bullet — a real consideration paired with factual context, never discouraging.' } },
    recommendation: { type: 'string', description: 'Balanced 2–3 paragraph conclusion (HTML fragment).' },
  },
};

const SYSTEM = `You are PropertyDNA's institutional research writer. You turn a structured packet of
VERIFIED property facts into the prose sections of a Buyer Intelligence Report for a high-net-worth buyer.

VOICE: institutional investment research — calm, precise, evidence-led. Apple/Fidelity, never a real-estate flyer.
No hype words ("stunning", "dream", "must-see"). Persuade through facts, not adjectives.

HARD INTEGRITY RULES (non-negotiable):
- Use ONLY facts present in the provided JSON. NEVER invent a number, feature, comp, or claim.
- If a fact needed for a sentence is missing, write "Data unavailable." rather than guessing — do not work around it.
- Keep VERIFIED MLS/assessor facts separate from interpretation. Do not assert photo-derived finishes.
- The PropertyDNA value is a comparative model output, not an appraisal — never imply otherwise.
- Tag major claims inline with the matching source chip span, exactly:
  <span class="src mls">MLS</span>, <span class="src dna">DNA</span>, <span class="src mkt">MKT</span>,
  <span class="src risk">RISK</span>, <span class="src">CMTY</span>, <span class="src">GEO</span>.
  Use the chip whose source the fact actually came from in the JSON (mls/assessor→MLS, valuation→DNA,
  market/comps→MKT, climate/hazard→RISK, community/club→CMTY, proximity→GEO).
- Output HTML fragments only (allowed: <b>, <em>, <span>, <br>). No <script>, no full documents, no markdown.
- If the packet includes a pricing directive (e.g. support the list price), honor it ONLY where the evidence
  genuinely supports it; if it does not, stay honest and say why. Never fabricate support.`;

async function draftNarrative(data) {
  const user = `Write the report narrative from this verified packet. Honor every integrity rule.

PROPERTY DATA (JSON):
${JSON.stringify(data, null, 2)}`;
  return callClaude({ system: SYSTEM, user, schema: SCHEMA, effort: 'high', maxTokens: 8000 });
}

async function main() {
  const p = process.argv[2];
  if (!p) { console.error('Usage: node draft-narrative.js <property-data.json>'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  const out = await draftNarrative(data);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { draftNarrative, SCHEMA };
