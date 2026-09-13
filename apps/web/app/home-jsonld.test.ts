import { describe, expect, it } from "vitest";

import { buildHomeStructuredData } from "./home-structured-data";

describe("homepage structured data", () => {
  it("links the website to the canonical Pace Yourself organization", () => {
    const data = buildHomeStructuredData();

    expect(data["@graph"]).toEqual([
      expect.objectContaining({
        "@type": "Organization",
        "@id": "https://pace-yourself.com/#organization",
        url: "https://pace-yourself.com",
      }),
      expect.objectContaining({
        "@type": "WebSite",
        "@id": "https://pace-yourself.com/#website",
        publisher: { "@id": "https://pace-yourself.com/#organization" },
      }),
    ]);
  });
});
