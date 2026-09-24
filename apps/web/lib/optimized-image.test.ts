import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  InvalidImageError,
  OPTIMIZED_IMAGE_MAX_EDGE_PX,
  optimizeImageFile,
} from "./optimized-image";

describe("optimizeImageFile", () => {
  it("normalizes a large raster image to a bounded WebP", async () => {
    const source = await sharp({
      create: {
        width: 1800,
        height: 1200,
        channels: 3,
        background: { r: 32, g: 128, b: 72 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImageFile(new File([source], "cover.png", { type: "image/png" }));
    const metadata = await sharp(optimized).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(OPTIMIZED_IMAGE_MAX_EDGE_PX);
    expect(metadata.height).toBeLessThanOrEqual(OPTIMIZED_IMAGE_MAX_EDGE_PX);
    expect(optimized.byteLength).toBeLessThan(source.byteLength);
  });

  it("rejects a payload that is not a decodable raster image", async () => {
    await expect(
      optimizeImageFile(new File(["not-an-image"], "fake.png", { type: "image/png" }))
    ).rejects.toBeInstanceOf(InvalidImageError);
  });
});
