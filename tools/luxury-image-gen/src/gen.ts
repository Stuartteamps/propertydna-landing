import "dotenv/config";
import https from "https";
import path from "path";
import fs from "fs";
import { createSocialImage } from "./createImage.js";

const SUPABASE_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) {
  console.error("SUPABASE_SERVICE_KEY required");
  process.exit(1);
}

interface Dossier {
  apn: string;
  address: string;
  city: string;
  architect_attribution: string | null;
  pedigree_neighborhood: string | null;
  year_built: number | null;
}

function sbGet<T>(p: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    https
      .request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
        },
        (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(d) as T);
            } catch {
              reject(new Error(`Bad JSON: ${d.slice(0, 200)}`));
            }
          });
        },
      )
      .on("error", reject)
      .end();
  });
}

function buildPrompt(d: Dossier): string {
  // Architect-driven prompt
  const ARCHITECT_STYLE: Record<string, string> = {
    "Albert Frey":
      "Frey-style desert modernism, boulder-integrated foundation, low horizontal roofline, exposed steel structure, native palms, dramatic San Jacinto mountains backdrop",
    "John Lautner":
      "Lautner-style organic modernism, sweeping concrete dome or curved roof, dramatic hillside cantilever, sunken living room, Indian Canyons setting",
    "Richard Neutra":
      "Neutra-style International Style modernism, low pavilions, water reflecting pool, glass-walled, Kaufmann House aesthetic",
    "William Krisel":
      "Krisel-style butterfly roof, Alexander Construction tract modern, breeze-block screen wall, Vista Las Palmas vibe",
    "Donald Wexler":
      "Wexler-style steel-frame modernism, prefab steel architecture, Sunny View Drive aesthetic",
    "E. Stewart Williams":
      "E. Stewart Williams Desert Modernism, integrated boulders, dramatic stone-and-glass blend",
    "Hugh Kaptur":
      "Kaptur-style late Desert Modernism, restrained Hollywood-celebrity-era cool",
    "William F. Cody":
      "Cody-style Desert Modernism, golf-course-adjacent, refined elegance",
    "Charles DuBois":
      "DuBois Polynesian A-frame, Swiss Miss-style architecture, Vista Las Palmas",
  };

  const archStyle = d.architect_attribution
    ? ARCHITECT_STYLE[d.architect_attribution] ||
      "Palm Springs mid-century modern architecture"
    : "Palm Springs mid-century modern architecture";

  return `
Ultra-luxury Palm Springs real estate editorial image for ${d.city}.
${archStyle}.
${d.year_built ? `Period: ${d.year_built} architecture.` : ""}
Warm golden hour light, cinematic shadows, deep blue desert sky.
Palm Springs Life magazine editorial style, architectural photography
in the spirit of Slim Aarons and Julius Shulman.
Negative space at the lower third for text overlay.
No logos, no signage, no fake addresses, no text inside the image.
Vertical 9:16 composition, photoreal, high detail.
`.trim();
}

async function run() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[args.indexOf("--limit") + 1] || "5", 10);

  console.log(`Fetching top ${limit} A-tier dossiers...`);
  const rows = await sbGet<Dossier[]>(
    `/rest/v1/property_master?pedigree_tier=eq.A&has_provenance_dossier=eq.true&select=apn,address,city,architect_attribution,pedigree_neighborhood,year_built&order=provenance_score.desc.nullslast&limit=${limit}`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("No A-tier dossiers returned from Supabase");
    process.exit(1);
  }
  console.log(`Got ${rows.length} dossiers.\n`);

  const outDir =
    "/Users/danstuart/propertydna-landing/app/frontend/public/social/ai-hero";
  fs.mkdirSync(outDir, { recursive: true });

  const manifest: Array<{ apn: string; address: string; publicUrl: string }> = [];
  for (const d of rows) {
    const filename = `${d.apn}.png`;
    process.stdout.write(`  ${d.address}... `);
    try {
      const result = await createSocialImage({
        prompt: buildPrompt(d),
        filename,
        size: "1024x1536",
        quality: "high",
        outputDir: outDir,
      });
      console.log("✓");
      manifest.push({
        apn: d.apn,
        address: d.address,
        publicUrl: result.publicUrl || "",
      });
    } catch (e) {
      console.log("✗", (e as Error).message);
    }
  }

  const manifestPath = path.join(
    "/Users/danstuart/propertydna-landing/tools/browser-agent/data",
    "ai-hero-manifest.json",
  );
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      { generated_at: new Date().toISOString(), images: manifest },
      null,
      2,
    ),
  );
  console.log(`\n✓ ${manifest.length} images generated`);
  console.log(`  Files:    ${outDir}/<apn>.png`);
  console.log(`  Manifest: ${manifestPath}`);
}

run().catch((e: Error) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
