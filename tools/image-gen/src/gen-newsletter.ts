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
    // matches buildWeatherText(): late-May highs upper-90s/100s, clear skies, strong desert sun
    filename: "latest-weather.jpg",
    prompt: `Coachella Valley desert on a hot, brilliantly sunny late-May afternoon.
Cloudless deep-blue sky, intense golden sun, tall palm trees, the Santa Rosa
mountains shimmering in heat haze, pristine and dry. Editorial travel
photography in the style of Palm Springs Life magazine. Photorealistic,
warm tones. No text, no logos, no watermarks, no people. Horizontal 3:2
composition with clean negative space in the upper third for a headline overlay.`,
  },
  {
    // matches "Things To Do This Week": post-festival calm, golden-hour patios, farmers markets, galleries
    filename: "latest-events.jpg",
    prompt: `Palm Springs lifestyle at golden hour after festival season: an inviting
upscale outdoor restaurant patio with warm string lights, mid-century modern
furniture, desert plants, and a relaxed early-evening glow. Distant palm trees
and mountains. Editorial lifestyle photography in the style of Condé Nast
Traveler. Photorealistic, warm and aspirational. No text, no logos, no
watermarks, no recognizable faces. Horizontal 3:2 composition with negative
space for a headline overlay.`,
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
  console.log(`Generating ${JOBS.length} newsletter images -> ${OUT}`);
  for (const job of JOBS) {
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
