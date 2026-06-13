#!/usr/bin/env tsx
/**
 * publish.ts
 *
 * Reads every .md in tools/seo-content/queue/, parses frontmatter + body,
 * converts back into the section schema used by blogPosts.ts, and injects
 * each post as a TypeScript object before the closing `];` of the
 * blogPosts array.
 *
 * Then moves the source MD from queue/ to published/ so it doesn't get
 * re-injected on the next run.
 *
 * Usage:
 *   npx tsx tools/seo-content/publish.ts [--dry-run] [--limit N]
 */
import fs from "fs";
import path from "path";

const ROOT          = path.resolve(import.meta.dirname);
const QUEUE_DIR     = path.join(ROOT, "queue");
const PUBLISHED_DIR = path.join(ROOT, "published");
const BLOG_FILE     = path.resolve(ROOT, "..", "..", "app", "frontend", "src", "data", "blogPosts.ts");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = ((() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1] || "999", 10) : 999;
})());

// ── Frontmatter + markdown parsing ────────────────────────────────────────

interface Article {
  slug: string;
  title: string;
  metaDescription: string;
  date: string;
  readTime: number;
  category: string;
  excerpt?: string;
  keywords?: string[];
  sections: Section[];
}

type Section =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; text: string };

function parseFrontmatter(raw: string): { frontmatter: any; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("No frontmatter block");
  const fm: any = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    let value: any = valueRaw.trim();
    // Try to parse JSON literals (arrays, quoted strings, numbers)
    if (value.startsWith("[") || value.startsWith('"') || /^-?\d+$/.test(value)) {
      try { value = JSON.parse(value); } catch { /* leave as string */ }
    }
    fm[key] = value;
  }
  return { frontmatter: fm, body: match[2] };
}

function parseBody(body: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let i = 0;

  // Skip the leading `# Title` line if present
  while (i < lines.length && lines[i].startsWith("# ")) i++;

  let para: string[] = [];
  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    if (text) sections.push({ type: "p", text });
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      flushPara();
      sections.push({ type: "h2", text: line.slice(3).trim() });
      i++; continue;
    }

    if (line.startsWith("### ")) {
      flushPara();
      sections.push({ type: "h3", text: line.slice(4).trim() });
      i++; continue;
    }

    if (line.startsWith("> **")) {
      flushPara();
      const callout = line.replace(/^>\s*\*\*/, "").replace(/\*\*\s*$/, "").trim();
      sections.push({ type: "callout", text: callout });
      i++; continue;
    }

    // Unordered list block
    if (/^[-*]\s/.test(line.trim())) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i++;
      }
      sections.push({ type: "ul", items });
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(line.trim())) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      sections.push({ type: "ol", items });
      continue;
    }

    // Boundary marker (auto-publisher cutoff)
    if (line.startsWith("---")) {
      flushPara();
      break;
    }

    if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line.trim());
    }
    i++;
  }
  flushPara();

  return sections;
}

// ── Generate TypeScript source for a single post ──────────────────────────

function serializeString(s: string): string {
  // Use double-quote with JSON-escape semantics for safety.
  return JSON.stringify(s);
}

function serializeArray(arr: string[]): string {
  return "[" + arr.map(serializeString).join(", ") + "]";
}

function tsForArticle(a: Article): string {
  const excerpt = a.excerpt || (a.sections.find(s => s.type === "p") as { text: string } | undefined)?.text?.slice(0, 220) || a.metaDescription;
  const sectionsTs = a.sections.map(s => {
    if (s.type === "ul" || s.type === "ol") {
      return `      { type: ${serializeString(s.type)}, items: ${serializeArray(s.items)} }`;
    }
    return `      { type: ${serializeString(s.type)}, text: ${serializeString((s as any).text)} }`;
  }).join(",\n");

  return `  {
    slug: ${serializeString(a.slug)},
    title: ${serializeString(a.title)},
    metaDescription: ${serializeString(a.metaDescription)},
    date: ${serializeString(a.date)},
    readTime: ${a.readTime},
    category: ${serializeString(a.category)},
    excerpt: ${serializeString(excerpt)},
    sections: [
${sectionsTs},
    ],
  },`;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  if (!fs.existsSync(QUEUE_DIR)) {
    console.log("No queue directory.");
    return;
  }
  const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith(".md")).sort();
  if (files.length === 0) {
    console.log("No drafts in queue.");
    return;
  }

  const batch = files.slice(0, LIMIT);
  console.log(`Found ${files.length} drafts. Publishing ${batch.length}…`);

  const blogSource = fs.readFileSync(BLOG_FILE, "utf8");
  const existingSlugs = new Set<string>();
  for (const m of blogSource.matchAll(/^\s*slug:\s*['"]([^'"]+)['"]/gm)) {
    existingSlugs.add(m[1]);
  }

  // Find the closing `];` of the blogPosts array (first occurrence after
  // `export const blogPosts: BlogPost[] = [`)
  const arrayStartIdx = blogSource.indexOf("export const blogPosts: BlogPost[] = [");
  if (arrayStartIdx < 0) throw new Error("Could not locate blogPosts array start");
  const closingIdx = blogSource.indexOf("\n];", arrayStartIdx);
  if (closingIdx < 0) throw new Error("Could not locate blogPosts array close");

  let injected = 0;
  let skipped = 0;
  const articleBlocks: string[] = [];
  const successFiles: string[] = [];
  const errorFiles: { file: string; err: string }[] = [];

  for (const file of batch) {
    const full = path.join(QUEUE_DIR, file);
    let raw: string;
    try { raw = fs.readFileSync(full, "utf8"); } catch (e) { errorFiles.push({ file, err: "read failed" }); continue; }

    let frontmatter: any, body: string;
    try { ({ frontmatter, body } = parseFrontmatter(raw)); }
    catch (e) { errorFiles.push({ file, err: "frontmatter parse: " + (e as Error).message }); continue; }

    if (!frontmatter.slug || !frontmatter.title) {
      errorFiles.push({ file, err: "missing slug or title" });
      continue;
    }

    if (existingSlugs.has(frontmatter.slug)) {
      console.log(`  ⊘ ${frontmatter.slug} already published — skipping`);
      skipped++;
      // Move it out of the queue so it doesn't get re-processed
      if (!DRY_RUN) fs.renameSync(full, path.join(PUBLISHED_DIR, file));
      continue;
    }

    let sections: Section[];
    try { sections = parseBody(body); }
    catch (e) { errorFiles.push({ file, err: "body parse: " + (e as Error).message }); continue; }

    if (sections.length < 3) {
      errorFiles.push({ file, err: `only ${sections.length} sections parsed` });
      continue;
    }

    const article: Article = {
      slug: frontmatter.slug,
      title: frontmatter.title,
      metaDescription: frontmatter.metaDescription,
      date: frontmatter.date,
      readTime: parseInt(String(frontmatter.readTime || 6), 10),
      category: frontmatter.category || "Buying",
      excerpt: frontmatter.excerpt,
      sections,
    };

    articleBlocks.push(tsForArticle(article));
    successFiles.push(file);
    existingSlugs.add(frontmatter.slug);  // prevent duplicate slugs in this batch
    injected++;
  }

  if (injected === 0) {
    console.log(`\nNothing to inject. Skipped: ${skipped}, errors: ${errorFiles.length}`);
    if (errorFiles.length) {
      for (const e of errorFiles) console.log(`  ✗ ${e.file}: ${e.err}`);
    }
    return;
  }

  const newSource =
    blogSource.slice(0, closingIdx) +
    "\n" + articleBlocks.join("\n\n") +
    blogSource.slice(closingIdx);

  if (DRY_RUN) {
    console.log(`\n[dry-run] Would inject ${injected} articles. ${skipped} already published. ${errorFiles.length} errors.`);
    if (errorFiles.length) for (const e of errorFiles) console.log(`  ✗ ${e.file}: ${e.err}`);
    console.log(`\n[dry-run] Sample of first injected block:\n${articleBlocks[0].slice(0, 400)}…`);
    return;
  }

  fs.writeFileSync(BLOG_FILE, newSource);
  for (const file of successFiles) {
    fs.renameSync(path.join(QUEUE_DIR, file), path.join(PUBLISHED_DIR, file));
  }

  console.log(`\n✅ Injected ${injected} articles into blogPosts.ts`);
  console.log(`   Moved ${successFiles.length} drafts queue/ → published/`);
  if (skipped > 0) console.log(`   Skipped ${skipped} already-published`);
  if (errorFiles.length > 0) {
    console.log(`   ${errorFiles.length} errors:`);
    for (const e of errorFiles) console.log(`     ✗ ${e.file}: ${e.err}`);
  }
}

main();
