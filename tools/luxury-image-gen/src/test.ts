import "dotenv/config";
import { createSocialImage } from "./createImage.js";

async function run() {
  const image = await createSocialImage({
    filename: "palm-springs-luxury-listing.png",
    outputDir: "/Users/danstuart/propertydna-landing/app/frontend/public/social/ai-test",
    size: "1024x1536",
    quality: "high",
    prompt: `
Ultra-luxury Palm Springs real estate editorial image.
Modern mid-century desert architecture, warm golden hour light, cinematic shadows,
Palm Springs Life magazine style, negative space on the lower third for text overlay,
high-end broker marketing, no logos, no fake text in image.
Vertical 9:16 composition.
    `.trim(),
  });

  console.log("✓ Image created:", image.filePath);
  if (image.publicUrl) console.log("  Public URL:", image.publicUrl);
}

run().catch((e: Error) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
