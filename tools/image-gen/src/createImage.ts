import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// gpt-image-1 supported sizes. Portrait 1024x1536 = 9:16-ish for IG/Reels/Stories.
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export interface CreateImageOpts {
  prompt: string;
  filename?: string;
  outputDir?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  // When set, the PNG is re-encoded to a width-bounded JPEG (smaller, email-safe).
  // The returned filename keeps whatever extension you pass in `filename`.
  jpeg?: { width?: number; quality?: number };
}

export interface CreateImageResult {
  filePath: string;
  filename: string;
  bytes: number;
}

/**
 * Generate one image with gpt-image-1 and write it to disk as a real file.
 * Returns the absolute path so callers can copy it into the deploy tree.
 */
export async function createSocialImage({
  prompt,
  filename = "social-image.png",
  outputDir = path.join(process.cwd(), "generated"),
  size = "1024x1536",
  quality = "high",
  jpeg,
}: CreateImageOpts): Promise<CreateImageResult> {
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    quality,
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("No image returned from OpenAI");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, filename);
  const png = Buffer.from(imageBase64, "base64");

  let out: Buffer = png;
  if (jpeg) {
    out = await sharp(png)
      .resize({ width: jpeg.width ?? 800, withoutEnlargement: true })
      .jpeg({ quality: jpeg.quality ?? 82, mozjpeg: true })
      .toBuffer();
  }
  fs.writeFileSync(filePath, out);

  return { filePath, filename, bytes: out.length };
}
