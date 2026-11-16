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
      expect.objectContaining({
        "@type": "MobileApplication",
        "@id": "https://pace-yourself.com/#app",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      }),
    ]);
  });

  it("describes the brand with both booklets and links the app stores", () => {
    const [organization] = buildHomeStructuredData()["@graph"];
    expect(organization.description).toContain("Livret coureur");
    expect(organization.description).toContain("Livret supporter");
    expect(organization.sameAs).toContain("https://play.google.com/store/apps/details?id=com.paceyourself.app");
  });
});
