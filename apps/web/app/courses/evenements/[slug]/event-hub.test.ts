import { describe, expect, it } from "vitest";

import {
  buildEventHubDescription,
  buildEventHubMetadataTitle,
  getEventEditionCanonicalPath,
  getEventHubName,
} from "./event-hub";
import { buildEventEditionStructuredData } from "./event-structured-data";

const featured = {
  slug: "grand-raid-reunion-2026-2026",
  eventSlug: "grand-raid-reunion",
  eventName: "GRAND RAID RÉUNION 2026",
  editionYear: 2026,
  startDate: "2026-10-15",
  endDate: "2026-10-18",
  location: "Saint-Pierre",
  thumbnailUrl: null,
  websiteUrl: "https://grandraid.example/",
  formats: [
    { slug: "zembrocal", name: "Zembrocal", distanceKm: 26.5 },
    { slug: "diagonale-des-fous", name: "Diagonale des Fous", distanceKm: 175 },
  ],
} as never;

const hub = { eventName: "GRAND RAID RÉUNION 2026", featured } as never;

describe("event hub", () => {
  it("canonicalizes every edition to its permanent hub, or to itself without a hub slug", () => {
    expect(getEventEditionCanonicalPath({ slug: "festival-2026", eventSlug: "festival" })).toBe("/courses/evenements/festival");
    expect(getEventEditionCanonicalPath({ slug: "festival-2026", eventSlug: null })).toBe("/courses/evenements/festival-2026");
  });

  it("drops a trailing edition year from the permanent name", () => {
    expect(getEventHubName("GRAND RAID RÉUNION 2026")).toBe("GRAND RAID RÉUNION");
    expect(getEventHubName("La 6000D")).toBe("La 6000D");
    expect(getEventHubName("2026")).toBe("2026");
  });

  it("titles the hub with the upcoming year only and stays within SEO limits", () => {
    expect(buildEventHubMetadataTitle(hub, 2026)).toBe("GRAND RAID RÉUNION 2026 : formats, parcours et ravitos");
    expect(buildEventHubMetadataTitle(hub, null)).toBe("GRAND RAID RÉUNION : formats, parcours et ravitos");
    const longHub = { eventName: "Ultra Trail des Montagnes du Haut Pays et de la Grande Vallée" } as never;
    expect(buildEventHubMetadataTitle(longHub, 2027).length).toBeLessThanOrEqual(60);
    const description = buildEventHubDescription(hub, false);
    expect(description).toContain("prochaine édition le 15 octobre 2026, 2 formats de 26,5 à 175 km");
    expect(description.length).toBeLessThanOrEqual(160);
    expect(buildEventHubDescription(hub, true)).toContain("dernière édition");
  });

  it("publishes the featured edition under its edition @id with the hub as page", () => {
    const data = buildEventEditionStructuredData(
      featured,
      "https://pace-yourself.com/courses/evenements/grand-raid-reunion-2026-2026",
      new Date("2026-09-01T00:00:00Z"),
      "https://pace-yourself.com/courses/evenements/grand-raid-reunion",
    );
    expect(data).toEqual(expect.objectContaining({
      "@id": "https://pace-yourself.com/courses/evenements/grand-raid-reunion-2026-2026#event",
      url: "https://pace-yourself.com/courses/evenements/grand-raid-reunion",
      mainEntityOfPage: "https://pace-yourself.com/courses/evenements/grand-raid-reunion",
      eventStatus: "https://schema.org/EventScheduled",
    }));
  });
});
