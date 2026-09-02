import { describe, expect, it } from "vitest";

import { buildLegalMetadata } from "./metadata";

describe("legal metadata", () => {
  it("uses a self-referencing canonical and keeps incomplete legal pages out of the index", () => {
    const metadata = buildLegalMetadata({
      path: "/legal/privacy",
      title: "Politique de confidentialité | Pace Yourself",
      description: "Description",
    });

    expect(metadata.alternates).toEqual({ canonical: "/legal/privacy" });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.openGraph).toMatchObject({
      url: new URL("https://pace-yourself.com/legal/privacy"),
      images: [expect.objectContaining({ url: "/landing/secondary.png" })],
    });
    expect(metadata.twitter).toMatchObject({
      title: "Politique de confidentialité | Pace Yourself",
      images: ["/landing/secondary.png"],
    });
  });
});
