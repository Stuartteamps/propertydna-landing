#!/usr/bin/env tsx
/**
 * tools/seo-content/generate.ts
 *
 * Reads seed-queries.json, picks N queries (default: next 10 unwritten),
 * generates 1,200+ word blog articles via Anthropic API, writes each as
 * a Markdown file with frontmatter to tools/seo-content/queue/.
 *
 * Dan reviews / approves / publishes to /blog by copying into
 * app/frontend/src/data/blogPosts.ts.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... tsx tools/seo-content/generate.ts --count 10
 *   --count    number to generate (default 10)
 *   --topic    filter to a topic key
 *   --intent   filter by intent (informational / transactional)
 *
 * Output schema: each .md file has frontmatter (slug, title,
 * metaDescription, date, readTime, category, keywords) + the article body
 * in the same block format used by blogPosts.ts (p/h2/ul/callout).
 */
import fs from "fs";
import path from "path";
import https from "https";

const ROOT = path.resolve(import.meta.dirname);
const QUEUE_DIR = path.join(ROOT, "queue");
const SEED_PATH = path.join(ROOT, "seed-queries.json");

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("ANTHROPIC_API_KEY required");
  process.exit(1);
}

// ── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(flag: string, fallback?: string) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}
const COUNT = parseInt(arg("--count", "10") || "10", 10);
const TOPIC = arg("--topic");
const INTENT = arg("--intent");

// ── Prompt ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You write long-tail SEO articles for PropertyDNA — the institutional-grade property intelligence platform homebuyers were never supposed to have. Mission: defend buyers from information asymmetry. Free iOS app + free web reports.

Your articles must:
1. Be 1,200-1,800 words. Strict.
2. Have a clear answer in the first 2 paragraphs (Google AI Overview / Perplexity will pull this).
3. Use the buyer's voice — NOT industry copy. "Your agent works for the commission. We work for you." energy.
4. Include 3-7 H2 sections with substantive content. Each H2 answers a sub-question.
5. Include at least one data-driven specific (a price, a percentage, a number of permits, a flood-zone designation) — even if generalized.
6. Always end with a CTA: free DNA report on any address at thepropertydna.com, free iOS app at thepropertydna.com/app.
7. Never make up specific addresses or fake user testimonials.
8. Schema-org-friendly: clean H2 hierarchy, no skipped headings.

OUTPUT FORMAT: respond with ONLY valid JSON, no markdown fences. Schema:
{
  "slug": "kebab-case-slug-here",
  "title": "Plain Title String",
  "metaDescription": "150-180 char description",
  "category": "Buying" | "Selling" | "Investing" | "Market" | "Risk" | "Luxury" | "Launch" | "Florida" | "California",
  "readTime": 6,
  "keywords": ["array", "of", "10-15", "SEO", "keywords"],
  "sections": [
    {"type": "p", "text": "Paragraph text. Plain. No markdown."},
    {"type": "h2", "text": "Section Heading"},
    {"type": "ul", "items": ["Bullet one", "Bullet two"]},
    {"type": "callout", "text": "Pull quote — bold and shareable."}
  ]
}

Section types: p (paragraph), h2 (heading), ul (bullet list with .items array), ol (numbered list), callout (pull quote).
Generate 6-10 sections total. Mix types.`;

const ANTHROPIC_MODEL = "claude-sonnet-4-6"; // good cost/quality for blog drafting

// ── Anthropic API call ─────────────────────────────────────────────────────
function callAnthropic(userPrompt: string): Promise<string> {
  const body = JSON.stringify({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          if (data.error) return reject(new Error(JSON.stringify(data.error)));
          const text = data.content?.[0]?.text || "";
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  let queries: any[] = seed.queries || [];

  if (TOPIC) queries = queries.filter(q => q.topic === TOPIC);
  if (INTENT) queries = queries.filter(q => q.intent === INTENT);

  // Filter out queries already written (slug exists in queue)
  const existing = new Set(
    fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, ""))
  );

  const remaining = queries.filter(q => {
    // Derive expected slug from query
    const slug = q.query.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90);
    return !existing.has(slug);
  });

  const batch = remaining.slice(0, COUNT);
  if (batch.length === 0) {
    console.log("No new queries to generate. All filtered queries already drafted in queue/.");
    return;
  }

  console.log(`Generating ${batch.length} articles…`);

  for (const q of batch) {
    const userPrompt = `Target query: "${q.query}"
Topic key: ${q.topic}
${q.city ? `City: ${q.city}` : ""}
${q.zip ? `ZIP: ${q.zip}` : ""}
Intent: ${q.intent}

Write the article per the system prompt. Output ONLY the JSON object — no markdown fences, no leading text.`;

    process.stdout.write(`  · "${q.query.slice(0, 60)}…" `);
    let raw: string;
    try {
      raw = await callAnthropic(userPrompt);
    } catch (e) {
      console.log(`✗ API error: ${(e as Error).message}`);
      continue;
    }

    // Strip code fences if Claude wrapped them
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");

    let article: any;
    try {
      article = JSON.parse(cleaned);
    } catch (e) {
      console.log(`✗ JSON parse failed (${cleaned.length} chars)`);
      // Persist raw to inspect
      fs.writeFileSync(path.join(QUEUE_DIR, `_failed-${Date.now()}.txt`), raw);
      continue;
    }

    // Frontmatter + content
    const today = new Date().toISOString().slice(0, 10);
    const md = `---
slug: ${article.slug}
title: ${JSON.stringify(article.title)}
metaDescription: ${JSON.stringify(article.metaDescription)}
date: ${today}
readTime: ${article.readTime || 6}
category: ${article.category || "Buying"}
keywords: ${JSON.stringify(article.keywords || [])}
seed_topic: ${q.topic}
target_query: ${JSON.stringify(q.query)}
status: draft
---

# ${article.title}

${(article.sections || []).map((s: any) => {
  if (s.type === "h2") return `## ${s.text}`;
  if (s.type === "h3") return `### ${s.text}`;
  if (s.type === "ul") return s.items.map((i: string) => `- ${i}`).join("\n");
  if (s.type === "ol") return s.items.map((i: string, idx: number) => `${idx+1}. ${i}`).join("\n");
  if (s.type === "callout") return `> **${s.text}**`;
  return s.text;
}).join("\n\n")}

---

_Auto-generated draft. To publish: copy the frontmatter + sections array into \`app/frontend/src/data/blogPosts.ts\` per the existing post schema. Adjust the date, tweak the lede, double-check any specific numbers._
`;

    const outPath = path.join(QUEUE_DIR, `${article.slug}.md`);
    fs.writeFileSync(outPath, md);
    console.log(`✓ ${article.slug}.md`);
  }

  console.log(`\nDone. Drafts in ${QUEUE_DIR}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
