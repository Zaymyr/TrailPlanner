import sharp from "sharp";

export const IMAGE_UPLOAD_CACHE_CONTROL = "max-age=31536000";
export const OPTIMIZED_IMAGE_CONTENT_TYPE = "image/webp";
export const OPTIMIZED_IMAGE_EXTENSION = "webp";
export const OPTIMIZED_IMAGE_MAX_EDGE_PX = 1024;

const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

export class InvalidImageError extends Error {
  constructor() {
    super("Invalid or unsupported image file.");
    this.name = "InvalidImageError";
  }
}

export async function optimizeImageFile(file: File): Promise<ArrayBuffer> {
  try {
    const source = Buffer.from(await file.arrayBuffer());
    const pipeline = sharp(source, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    });
    const metadata = await pipeline.metadata();

    if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
      throw new InvalidImageError();
    }

    const optimized = await pipeline
      .rotate()
      .resize({
        width: OPTIMIZED_IMAGE_MAX_EDGE_PX,
        height: OPTIMIZED_IMAGE_MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78, alphaQuality: 80, effort: 5, smartSubsample: true })
      .toBuffer();

    const body = new Uint8Array(optimized.byteLength);
    body.set(optimized);
    return body.buffer;
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError();
  }
}
