import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { createSocialImage } from "./createImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// IG/social images live at /social/photo/YYYY-MM-DD.jpg (Buffer + the content
// calendar reference this path). Served from Netlify CDN.
const OUT = path.resolve(__dirname, "../../../app/frontend/public/social/photo");

// Each prompt is matched to that day's post copy so the image reinforces the
// hook instead of being generic. Clean negative space (top third) is reserved
// so a bold headline can be overlaid for the carousel format. No baked-in text
// (gpt-image-1 text rendering is unreliable; we overlay copy separately).
const JOBS: { date: string; prompt: string }[] = [
  {
    // 5/28 — "70% of celebrity-owned claims aren't documentable. We verify 30%."
    date: "2026-05-28",
    prompt: `Iconic Palm Springs celebrity estate at twilight: a glamorous mid-century
modern home with warm glowing interior light, sleek clean architecture, a
sparkling pool, palm trees silhouetted against a deep blue-and-violet dusk sky.
Old-Hollywood luxury and intrigue. Architectural Digest editorial photography,
cinematic and aspirational. No text, no logos, no watermarks, no people.
Vertical 9:16 composition with strong clean negative space in the top third
for a bold headline overlay.`,
  },
  {
    // 5/29 — Frank Sinatra's Palm Springs homes (Twin Palms, piano-shaped pool)
    date: "2026-05-29",
    prompt: `A glamorous 1947 mid-century modern Palm Springs estate at golden hour with
a distinctive piano-shaped swimming pool, clean horizontal architecture,
desert landscaping, San Jacinto mountains behind. Rat-Pack-era sophistication
and warmth. Architectural Digest editorial photography, cinematic. No text, no
logos, no watermarks, no people. Vertical 9:16 composition with clean negative
space in the top third for a headline overlay.`,
  },
  {
    // 5/30 — Albert Frey's Frey House II (built around a granite boulder)
    date: "2026-05-30",
    prompt: `A radically minimalist glass-and-steel desert house perched on a rocky
hillside above Palm Springs, built into the natural granite boulders, with a
huge boulder integrated inside, floor-to-ceiling glass, sweeping valley view at
golden hour. Albert Frey desert-modernism. Architectural photography, serene
and iconic. No text, no logos, no watermarks, no people. Vertical 9:16
composition with clean negative space in the top third for a headline overlay.`,
  },
  {
    // 5/31 — Elrod House (John Lautner, Diamonds Are Forever)
    date: "2026-05-31",
    prompt: `A dramatic John-Lautner-style concrete house on a Palm Springs ridge at dusk:
a sweeping circular concrete canopy roof with radiating beams, vast curved
glass walls, infinity pool merging with the desert view below, cinematic and
futuristic. Architectural Digest editorial photography, moody twilight. No
text, no logos, no watermarks, no people. Vertical 9:16 composition with clean
negative space in the top third for a headline overlay.`,
  },
];

async function run() {
  const only = process.argv[2]; // optional: a single YYYY-MM-DD
  const jobs = only ? JOBS.filter((j) => j.date === only) : JOBS;
  console.log(`Generating ${jobs.length} social image(s) -> ${OUT}`);
  for (const job of jobs) {
    const t0 = Date.now();
    const r = await createSocialImage({
      prompt: job.prompt,
      filename: `${job.date}.jpg`,
      outputDir: OUT,
      size: "1024x1536", // portrait for IG/Reels
      quality: "high",
      jpeg: { width: 1080, quality: 88 },
    });
    console.log(
      `  ${r.filename}  ${(r.bytes / 1024).toFixed(0)} KB  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  }
  console.log("Done.");
}

run().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
