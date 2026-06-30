#!/usr/bin/env node
'use strict';
/**
 * generate-viral — Claude-powered viral content + re-permission email.
 *
 *   node tools/content-gen/generate-viral.js [context.json] > kit.json
 *
 * Produces, as structured JSON:
 *   - viral content pieces (hook + platform + body + CTA), mission-aligned
 *   - a value-first re-permission / re-engagement email (the fix for the
 *     54-unsubscribe spike — pull people in instead of blasting a cold list)
 *
 * Pass an optional context.json to ground the content in real numbers/listings
 * (see DEFAULT_CONTEXT below for the shape). Anything not supplied is left as a
 * bracketed placeholder — the model is told never to invent stats.
 *
 * Model: claude-opus-4-8, adaptive thinking, structured output. Requires ANTHROPIC_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const { callClaude } = require('../_anthropic');

const DEFAULT_CONTEXT = {
  brand: 'PropertyDNA (powered by IntellaGraph AI)',
  mission: 'Put the data on the buyer\'s and seller\'s side — defend people from predatory agents on the biggest purchase of their lives. "Take Ownership of Housing."',
  proofPoints: [
    '140M+ U.S. homes indexed; real county records, comps, and sale history',
    'Free PropertyDNA report on any address',
    'Verified luxury provenance: 17 confirmed celebrity Palm Springs estates',
  ],
  audience: 'Coachella Valley homeowners, buyers, sellers, and agents',
  channels: ['Instagram/TikTok (Reels)', 'X', 'LinkedIn', 'Email'],
  recentExamples: [
    '50220 Via Puente, La Quinta — $2.5M lakefront; list at $554/sf vs. the La Quinta luxury average of $783/sf',
    '9520 Ekwanok, Desert Hot Springs — $395k; $465 HOA includes unlimited golf for two; $175/sf vs. the DHS median $221/sf',
  ],
  list_problem: '2,628-contact Constant Contact list, mostly cold/scraped; a product-launch blast drew 54 unsubscribes (~2%) and 0 new opt-ins.',
  pieceCount: 5,
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pieces', 'reengagementEmail'],
  properties: {
    pieces: {
      type: 'array', description: 'Viral content pieces.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'platform', 'format', 'hook', 'body', 'cta'],
        properties: {
          title: { type: 'string', description: 'Short internal label.' },
          platform: { type: 'string', description: 'e.g. Instagram/TikTok Reel, X, LinkedIn.' },
          format: { type: 'string', description: 'e.g. 30s video script, carousel, single post.' },
          hook: { type: 'string', description: 'First 3 seconds / first line — the scroll-stopper.' },
          body: { type: 'string', description: 'The piece copy or script (plain text, line breaks ok).' },
          cta: { type: 'string', description: 'Call to action (drives the free-report opt-in).' },
        },
      },
    },
    reengagementEmail: {
      type: 'object', additionalProperties: false,
      required: ['subject', 'preheader', 'bodyText', 'bodyHtml'],
      properties: {
        subject: { type: 'string' },
        preheader: { type: 'string' },
        bodyText: { type: 'string', description: 'Plain-text version.' },
        bodyHtml: { type: 'string', description: 'Simple inline-styled HTML email body.' },
      },
    },
  },
};

const SYSTEM = `You are PropertyDNA's growth-content lead. You write VIRAL, factual content and lifecycle email
that pull people in — never spammy blasts. The brand's edge is real data; the data is the gift, not the pitch.

PRINCIPLES:
- Mission first: the data belongs to the buyer/seller, not the agent across the table. Empower, don't sell.
- Lead with a sharp, specific HOOK and one concrete, surprising, true data point.
- Value-first: every piece earns the follow/opt-in by being useful or revealing on its own.
- For the re-engagement email: this goes to a COLD, mostly-scraped list that just bled unsubscribes. So make it a
  RE-PERMISSION email — warm, honest about why they're hearing from us, one clear "stay in / tap to keep getting
  local market intel" action, and an easy graceful exit. No launch-hype, no "we're live." It must read like a gift,
  give people a reason to stay, and not be embarrassing if a stranger reads it.

HARD RULES:
- NEVER invent statistics, prices, or claims. Use only numbers/examples present in the provided context.
- If you need a number that isn't provided, leave a clear bracketed placeholder like [median $/sf] — do not guess.
- Keep claims defensible and on-brand; no fear-mongering, no attacking individuals.
- Output plain text for copy fields and simple inline-styled HTML for bodyHtml (no <script>, no external assets).`;

async function generateViralKit(context = DEFAULT_CONTEXT) {
  const ctx = { ...DEFAULT_CONTEXT, ...context };
  const user = `Generate ${ctx.pieceCount} viral pieces across these channels: ${ctx.channels.join(', ')},
plus one re-permission/re-engagement email. Ground everything in this context; invent nothing.

CONTEXT (JSON):
${JSON.stringify(ctx, null, 2)}`;
  return callClaude({ system: SYSTEM, user, schema: SCHEMA, effort: 'medium', maxTokens: 8000 });
}

async function main() {
  const p = process.argv[2];
  const context = p ? JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')) : DEFAULT_CONTEXT;
  const out = await generateViralKit(context);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { generateViralKit, SCHEMA, DEFAULT_CONTEXT };
