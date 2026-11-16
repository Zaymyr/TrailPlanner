import { describe, expect, it } from "vitest";

import { buildEventEditionDescription, buildEventEditionStructuredData } from "./event-structured-data";

const edition = {
  eventName: "Festival des Cimes",
  editionYear: 2026,
  startDate: "2026-09-12",
  endDate: "2026-09-13",
  location: "Annecy",
  thumbnailUrl: null,
  websiteUrl: "https://festival.example/",
  formats: [
    { slug: "trail-20-km", name: "Trail 20 km", date: "2026-09-12", distanceKm: 20 },
    { slug: "trail-42-km", name: "Trail 42 km", date: "2026-09-13", distanceKm: 42 },
  ],
} as never;

describe("event edition structured data", () => {
  it("publishes one parent SportsEvent with factual child formats", () => {
    const data = buildEventEditionStructuredData(edition, "https://pace-yourself.com/courses/evenements/festival-des-cimes-2026");

    expect(data).toEqual(expect.objectContaining({
      "@type": "SportsEvent",
      startDate: "2026-09-12",
      endDate: "2026-09-13",
      location: { "@type": "Place", name: "Annecy" },
      image: ["https://pace-yourself.com/branding/social-preview-v2.png"],
    }));
    // Bare references: Google must not validate formats as partial Events.
    expect(data.subEvent).toEqual([
      { "@id": "https://pace-yourself.com/courses/trail-20-km#event" },
      { "@id": "https://pace-yourself.com/courses/trail-42-km#event" },
    ]);
    expect(buildEventEditionDescription(edition)).toContain("2 formats de 20 à 42 km");
  });

  it("adds a structured address from normalized format locality", () => {
    const data = buildEventEditionStructuredData({
      ...edition,
      formats: [{ ...(edition as { formats: object[] }).formats[0], locationCity: "Annecy", locationRegion: "Auvergne-Rhône-Alpes", locationCountry: "France" }],
    } as never, "https://pace-yourself.com/courses/evenements/festival-des-cimes-2026");

    expect(data.location).toEqual({
      "@type": "Place",
      name: "Annecy",
      address: { "@type": "PostalAddress", addressLocality: "Annecy", addressRegion: "Auvergne-Rhône-Alpes", addressCountry: "France" },
    });
  });

  it("omits unknown optional fields", () => {
    const data = buildEventEditionStructuredData({ ...edition, location: null, websiteUrl: null } as never, "https://localhost:3000/courses/evenements/festival-des-cimes-2026");
    const serialized = JSON.stringify(data);

    expect(data).not.toHaveProperty("location");
    expect(data).not.toHaveProperty("offers");
    expect(serialized).not.toMatch(/price|priceCurrency|availability|postalCode/);
    expect(data.subEvent[0]["@id"]).toBe("https://localhost:3000/courses/trail-20-km#event");
  });
});
