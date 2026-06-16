import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createSocialImage } from "./createImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../app/frontend/public/social/photo");
const CALENDAR = path.resolve(__dirname, "../../../tools/browser-agent/data/content-calendar.json");

// ── Dan's PDIv3 prompt system ────────────────────────────────────────────────
const PDIV3_BASE = `Ultra-photorealistic luxury real estate marketing imagery. Architectural Digest + RH + Aman Resorts + Apple keynote aesthetic. Natural lighting only. Real-world materials, accurate reflections, physically correct shadows, HDR photography, full-frame Sony A1, 35mm/50mm lens, f/4-f/8, editorial composition, luxury branding, high dynamic range, cinematic depth, premium color grading, realistic human scale, no CGI look, no cartoon styling, no oversaturation, no distorted architecture, no warped lines, no fake furniture. Palm Springs luxury market aesthetic. Modern, sophisticated, aspirational, wealthy clientele. Magazine cover quality. Hyper-detailed. Photoreal.`;

const NEG = `Avoid: CGI, rendering, cartoon, illustration, low resolution, blurry, distorted architecture, crooked walls, fake lighting, watermarks, text overlays, duplicate objects, extra limbs, unrealistic landscaping, oversaturated colors. Clean negative space in the top third for headline overlay. No text or logos in the image.`;

function pdiv3(scene: string): string {
  return `${PDIV3_BASE}\n\nScene: ${scene}\n\n${NEG}`;
}

// ── 35 scene prompts mapped to the calendar dates 6/15-7/19 ──────────────────
// Each scene is matched to the post archetype + topic so the image reinforces
// the hook. Scenes are diversified across architecture, lifestyle, intelligence/
// data, mission, and editorial-quiet aesthetics.
const SCENES: Record<string, string> = {
  "2026-06-15": "Founder voice. A sophisticated home office bathed in golden-hour light, floor-to-ceiling glass overlooking a Palm Springs valley vista, dark walnut desk with single open laptop showing a clean dashboard, leather chair empty, single cup of espresso, San Jacinto mountains in background, editorial calm.",
  "2026-06-16": "Three luxury homes shown side-by-side in a triptych grid: a contemporary mid-century estate in California desert at sunset (Thunderbird Heights aesthetic), a coastal modern home in Tampa Florida at dawn with palm trees, a stately Greenwich Connecticut shingle-style estate in autumn. Editorial real estate cover.",
  "2026-06-17": "Florida coastal luxury home with a foreboding undertone — beautiful waterfront architecture but with subtle storm clouds gathering on the horizon, hurricane preparedness aesthetic, late afternoon light, palm trees swaying, glassy water in foreground, no people. Sophisticated insurance crisis editorial.",
  "2026-06-18": "Editorial split scene: on one side, a stylized counter floating above an agent's head showing rising dollars; on the other side, a confident buyer at a Palm Springs front door with a tablet in hand showing property intelligence. Cinematic high-contrast, magazine editorial composition.",
  "2026-06-19": "Five floating data cards in an editorial composition over a luxurious Palm Springs mid-century home interior: permit history, flood zone designation, deed history, hazard score, comp set ring. Each card crisp, minimal, Bloomberg Terminal meets Apple keynote. No actual text in cards.",
  "2026-06-20": "A buyer family standing victoriously in front of a Palm Springs luxury estate at golden hour, holding hands, looking at the house. Warm celebration, no faces visible (back to camera). Sophisticated aspirational lifestyle photography. Saved buyer story aesthetic.",
  "2026-06-21": "An open-house Saturday morning in Thunderbird Heights, mid-century estate, immaculate landscaping, ornamental gate with PropertyDNA tablet-format invitation card on a pedestal in foreground, mountains in soft background haze, no people, warm welcoming editorial.",
  "2026-06-22": "Sunday-reflective: a quiet wide-angle Palm Springs neighborhood at dawn, no people, ribbons of mist over the desert valley, mid-century homes barely visible in soft pastel light, contemplative editorial photography.",
  "2026-06-23": "Methodology visualized: 47 floating data source icons (county shields, FEMA logo silhouette, USGS-style topo lines, satellite imagery thumbnails) arranged in clean Apple-keynote grid over a black backdrop, with one Palm Springs luxury home photographed in clear sharp focus at the center. Sophisticated tech editorial.",
  "2026-06-24": "Off-market opportunity aesthetic: a partially-obscured luxury estate behind tall gates, glimpse of architecture through wrought-iron, palm tree shadows, twilight, exclusive private market feel, no for-sale signs. Mysterious sophisticated editorial.",
  "2026-06-25": "Pain hook: a confident young couple at a Palm Springs front-door threshold, looking at each other questioning, modern house in background, subtle warning shadows. Editorial drama, no faces visible (silhouettes only). Cinematic.",
  "2026-06-26": "Behind-the-scenes: Sophisticated workspace at night with multiple monitor displays showing a property index visualization with US map highlighting AZ, CA, NV, WA, TX, CT, FL, NY in soft amber. Dark elegant office, single warm desk lamp, Apple keynote aesthetic, no people.",
  "2026-06-27": "Florida luxury home walk-away moment: empty white-stucco coastal estate at midday with hurricane storm shutters partially closed, no people, palm trees, clean editorial framing. Subtle tension of an insurance-crisis market.",
  "2026-06-28": "Editorial sketch-comedy split frame: on left, an agent's elegant office with a clipboard showing only 3 highlighted entries; on right, the same scene with 17 entries spread across a wide desk. Sophisticated dual-panel magazine illustration, photorealistic.",
  "2026-06-29": "Mission statement aesthetic: clean editorial wide shot of a Palm Springs mid-century home in early morning golden hour, no people, perfect symmetry, mountain backdrop, single phrase of magazine-cover composition. Aspirational.",
  "2026-06-30": "Month-end recap visualization: floating bar charts and trend lines elegantly overlaid on a wide Palm Springs valley vista at sunset, mid-century estates in the foreground, sophisticated Bloomberg Terminal meets Architectural Digest aesthetic. Data-storytelling editorial.",
  "2026-07-01": "Monthly kickoff: a clean modern Palm Springs front door opening to reveal warm interior glow, fresh July sunlight, calendar page turning aesthetic implied, optimistic editorial. No people.",
  "2026-07-02": "Comparison side-by-side: on the left, a Zillow-style price chart over a generic suburban home (slightly off, lower contrast); on the right, a PropertyDNA confidence-interval visualization over a beautifully photographed Palm Springs luxury estate. Premium dual-panel editorial.",
  "2026-07-03": "Future vision: a sleek modern Palm Springs estate with floating digital interface elements showing 'BUY' and 'SELL' buttons in elegant minimalist style, glowing data streams overlay, Apple meets Bloomberg Terminal aesthetic, no people, golden hour.",
  "2026-07-04": "Independence Day editorial: an iconic mid-century modern American home at dusk with sparklers in the foreground out of focus, subtle American flag colors in sunset reflections on glass, sophisticated aspirational lifestyle. No people visible.",
  "2026-07-05": "Stale listing dawn shot: a luxury Coachella Valley home with a 'days-on-market' indicator subtly overlaid in elegant Bloomberg-terminal styling, golden morning light, no for-sale sign, editorial market-intelligence aesthetic.",
  "2026-07-06": "Permit history visualization: a luxury Palm Springs property with an elegant timeline of permit markers floating over the architecture (no actual text), data overlay aesthetic, premium real estate intelligence editorial. No people.",
  "2026-07-07": "Save story scene: a Cathedral City modern home photographed at golden hour with a 'PASSED' editorial elegance, then a second cleaner home down the street being approached by a family silhouette. Sophisticated two-act narrative composition.",
  "2026-07-08": "Sketch comedy redux: an editorial editorial split panel showing a Zillow-style screen showing only a price with confused users in silhouette, vs a PropertyDNA dashboard showing comprehensive intelligence over a luxury home. Sophisticated magazine illustration.",
  "2026-07-09": "Founder reading user-submitted stories: a sophisticated office desk with elegant printed letters and notes in a leather folder, warm lamp light, single coffee, no people. Empathetic editorial calm.",
  "2026-07-10": "AI angle: advanced real estate intelligence platform visualized as glowing property data streams flowing across Coachella Valley luxury homes, predictive analytics dashboard, luxury technology brand, Apple meets Bloomberg Terminal aesthetic. No text in interface.",
  "2026-07-11": "Comparison agent's CMA vs algorithm: editorial dual frame with elegant data ribbons. Left: a single sheet of paper with 3 elegantly framed photos. Right: a wide screen showing 17 properties on a map of half-mile ring. Sophisticated luxury data editorial.",
  "2026-07-12": "Mission statement: a wide cinematic shot of a Palm Springs valley with a single luxury mid-century home in foreground, vast desert landscape, perfect editorial calm. Aspirational mission framing. No people.",
  "2026-07-13": "Sunday reflective: a luxury real estate agent overlooking city lights at dusk from a modern glass office in Palm Springs, premium branding, aspirational entrepreneur lifestyle. Silhouette only, no face visible. Sophisticated editorial.",
  "2026-07-14": "Educational close: three elegantly composed data cards floating over a Palm Springs luxury estate at dawn — insurance carrier tier, permit history, comp spread. Clean magazine-cover composition. No actual text.",
  "2026-07-15": "Founder voice: a buyer holding an elegant tablet showing a clean intelligence report, warm interior of a Palm Springs mid-century home, kitchen island in background, no faces. Sophisticated editorial lifestyle.",
  "2026-07-16": "AI installations metric visualization: floating elegant data display showing growth trajectory over a Palm Springs valley sunset, Apple keynote aesthetic, no people. Premium tech editorial.",
  "2026-07-17": "Greenwich Connecticut shingle-style estate at autumn dusk with confident data overlay aesthetic, premium Northeast luxury editorial, warm exterior lights. Nationwide aspirational.",
  "2026-07-18": "Mission close: a wide editorial panoramic shot of the American suburban landscape at sunset with subtle digital intelligence overlay woven through homes, sophisticated tech-meets-housing aesthetic. No people.",
  "2026-07-19": "Sunday think-piece: a sleek Palm Springs modernist home interior at sunset with a single open book on a leather chair, mountains visible through floor-to-ceiling glass, editorial reflective calm. No people.",
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const calendar = JSON.parse(fs.readFileSync(CALENDAR, "utf8"));

  const dates = Object.keys(SCENES).sort();
  console.log(`Generating ${dates.length} PDIv3 images → ${OUT_DIR}\n`);

  const updates: { date: string; image: string }[] = [];
  let success = 0, failed = 0;

  for (const date of dates) {
    const filename = `${date}.jpg`;
    const filePath = path.join(OUT_DIR, filename);
    const scene = SCENES[date];

    process.stdout.write(`  [${date}] generating… `);
    try {
      await createSocialImage({
        prompt: pdiv3(scene),
        filename,
        outputDir: OUT_DIR,
        size: "1024x1536",
        quality: "high",
        jpeg: { width: 1080, quality: 88 },
      });
      const bytes = fs.statSync(filePath).size;
      console.log(`✓ (${Math.round(bytes/1024)}KB)`);
      success++;
      updates.push({ date, image: `https://thepropertydna.com/social/photo/${filename}` });
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      failed++;
    }
  }

  // Update calendar to point at the new images
  for (const post of calendar.posts) {
    const u = updates.find(x => x.date === post.date);
    if (u) post.image = u.image;
  }
  fs.writeFileSync(CALENDAR, JSON.stringify(calendar, null, 2));

  console.log(`\n✅ Done. ${success} succeeded, ${failed} failed.`);
  console.log(`Calendar updated to point at ${updates.length} new images.`);
}

main().catch(err => { console.error(err); process.exit(1); });
