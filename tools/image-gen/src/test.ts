import "dotenv/config";
import { createSocialImage } from "./createImage.js";

async function run() {
  const t0 = Date.now();
  const image = await createSocialImage({
    filename: "palm-springs-luxury-listing.png",
    prompt: `
Ultra-luxury Palm Springs real estate editorial image.
Modern desert architecture, warm golden hour light, cinematic shadows,
Palm Springs Life magazine style, negative space at top for text overlay,
high-end broker marketing, no logos, no text, no watermarks.
Vertical 9:16 composition, photorealistic, architectural photography.
    `,
  });
  console.log(
    `Image created: ${image.filePath} (${(image.bytes / 1024).toFixed(0)} KB) in ${(
      (Date.now() - t0) / 1000
    ).toFixed(1)}s`,
  );
}

run().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
