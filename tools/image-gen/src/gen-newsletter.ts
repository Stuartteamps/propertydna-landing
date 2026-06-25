import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { createSocialImage } from "./createImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Land images directly in the deploy tree so they serve from Netlify CDN at
// https://thepropertydna.com/social/newsletter/latest-*.jpg
const OUT = path.resolve(__dirname, "../../../app/frontend/public/social/newsletter");

// Each prompt is matched to the actual copy in send-cc-newsletter.js so the
// image reinforces the section text instead of being generic stock.
const JOBS: { filename: string; prompt: string }[] = [
  {
    // Week of 2026-06-25 — top hero. Sweeping aspirational Coachella Valley luxury
    // at the height of summer; reinforces the "PropertyDNA is live" banner above it.
    filename: "latest-hero.jpg",
    prompt: `A breathtaking aerial golden-hour view over the Coachella Valley in
high summer — a sweeping vista of ultra-luxury desert estates with resort pools
glinting, emerald golf greens and palm-lined boulevards threading between them,
the dramatic Santa Rosa and San Jacinto mountains glowing in warm evening light,
deep blue sky above. Aspirational, cinematic, expensive. Architectural Digest
meets Robb Report editorial aerial photography. Photorealistic. No text, no logos,
no watermarks, no people. Wide horizontal composition with clean negative space
in the upper third for a headline overlay.`,
  },
  {
    // Week of 2026-06-25 — brutal late-June dry heat (100-118°F), cloudless, NOT monsoon yet
    filename: "latest-weather.jpg",
    prompt: `Coachella Valley desert under a brutal late-June heat wave — a blinding
white-hot afternoon sun high in a perfectly cloudless deep-blue sky, intense heat
shimmer rippling off the bone-dry desert floor, towering date palms standing
perfectly still in the breathless heat, the jagged San Jacinto mountains stark
through the heat haze, sun-bleached sand and rock. Ultra-photorealistic editorial
photography shot on a high-end DSLR, razor-sharp detail, harsh natural midday
light, hyper-realistic, in the style of Palm Springs Life magazine — not an
illustration. No text, no logos, no watermarks, no people. Horizontal 3:2
composition with clean negative space in the upper third for a headline overlay.`,
  },
  {
    // Week of 2026-06-25 — matches the events copy: downtown Palm Springs summer
    // evening (VillageFest Thursdays + ShortFest week on Palm Canyon Drive)
    filename: "latest-events.jpg",
    prompt: `Downtown Palm Springs on a warm summer Thursday evening — historic Palm
Canyon Drive glowing at dusk, vintage mid-century neon marquee signs and warm
string lights against a deepening violet desert sky, towering palms uplit from
below, an elegant lively street-fair atmosphere with outdoor cafe tables, the
San Jacinto mountains darkening behind. Ultra-photorealistic editorial
photography shot on a high-end DSLR, razor-sharp detail, warm cinematic evening
light, hyper-realistic, in the style of Condé Nast Traveler — not an
illustration. No text, no logos, no watermarks, no recognizable faces.
Horizontal 3:2 composition with negative space in the upper third for a headline
overlay.`,
  },
  {
    // matches "West Valley New Listings": Palm Springs + Cathedral City, updated design homes
    filename: "latest-west-valley.jpg",
    prompt: `Ultra-luxury Palm Springs mid-century modern home exterior at golden hour.
Clean architectural lines, floor-to-ceiling glass walls, a sleek infinity pool,
sculptural desert landscaping, the San Jacinto mountains rising behind.
Architectural Digest editorial photography. Photorealistic, cinematic light.
No text, no logos, no watermarks, no people. Horizontal 3:2 composition with
negative space for a headline overlay.`,
  },
  {
    // matches "East Valley New Listings": La Quinta, Palm Desert, Rancho Mirage estates
    filename: "latest-east-valley.jpg",
    prompt: `Ultra-luxury desert estate in La Quinta or Palm Desert at golden hour.
Expansive contemporary-Mediterranean architecture, manicured grounds, a large
resort-style pool, framed dramatically by the Santa Rosa mountains. Bloomberg
Wealth meets Architectural Digest editorial style. Photorealistic, opulent but
tasteful. No text, no logos, no watermarks, no people. Horizontal 3:2
composition with negative space for a headline overlay.`,
  },
];

async function run() {
  // Optional CLI args: filenames (or unique substrings) of the jobs to run.
  // e.g. `tsx src/gen-newsletter.ts weather events` regenerates only those two.
  const filters = process.argv.slice(2);
  const jobs = filters.length
    ? JOBS.filter((j) => filters.some((f) => j.filename.includes(f)))
    : JOBS;
  console.log(`Generating ${jobs.length} newsletter image(s) -> ${OUT}`);
  for (const job of jobs) {
    const t0 = Date.now();
    const r = await createSocialImage({
      prompt: job.prompt,
      filename: job.filename,
      outputDir: OUT,
      size: "1536x1024", // landscape banner for email
      quality: "high",
      jpeg: { width: 1000, quality: 82 },
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
