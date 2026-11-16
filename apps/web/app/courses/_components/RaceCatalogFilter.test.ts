import { describe, expect, it } from "vitest";

import type { PublicRace } from "../../../lib/public-races";
import { getEventDateLabel, getEventLocationLabel } from "./catalog-display";

const race = (overrides: Partial<PublicRace>): PublicRace => ({
  id: crypto.randomUUID(),
  eventId: "11111111-1111-4111-8111-111111111111",
  editionId: "22222222-2222-4222-8222-222222222222",
  slug: "format",
  name: "Format",
  eventName: "Événement",
  date: "2026-11-28",
  location: "Saint-Étienne – Lyon",
  locationCity: "Lyon",
  locationDepartment: null,
  locationRegion: null,
  locationCountry: "France",
  searchTerms: [],
  distanceKm: 80,
  elevationGainM: 2300,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: null,
  eventWebsiteUrl: null,
  updatedAt: null,
  ...overrides,
});

describe("catalog event labels", () => {
  it("formats a compact range within one month", () => {
    expect(getEventDateLabel([
      race({ date: "2026-11-27" }),
      race({ date: "2026-11-28" }),
    ])).toBe("27–28 nov. 2026");
  });

  it("formats a compact range across months and years", () => {
    expect(getEventDateLabel([
      race({ date: "2026-11-30" }),
      race({ date: "2026-12-01" }),
    ])).toBe("30 nov. – 1 déc. 2026");
    expect(getEventDateLabel([
      race({ date: "2026-12-31" }),
      race({ date: "2027-01-01" }),
    ])).toBe("31 déc. 2026 – 1 janv. 2027");
  });

  it("uses the normalized common city when format locations differ", () => {
    expect(getEventLocationLabel([
      race({ location: "Saint-Étienne – Lyon", locationCity: "Lyon" }),
      race({ location: "Sainte-Catherine – Lyon", locationCity: "Lyon" }),
    ])).toBe("Lyon");
  });

  it("counts distinct departure locations when there is no common city", () => {
    expect(getEventLocationLabel([
      race({ location: "Chamonix", locationCity: null }),
      race({ location: "Courmayeur", locationCity: null }),
      race({ location: "Chamonix", locationCity: null }),
    ])).toBe("2 lieux de départ");
  });
});

describe("format label within its event", () => {
  it("drops a repeated event prefix for display only", async () => {
    const { getFormatLabelWithinEvent } = await import("./catalog-display");
    expect(getFormatLabelWithinEvent("SaintéLyon — SaintéTic", "SaintéLyon")).toBe("SaintéTic");
    expect(getFormatLabelWithinEvent("Ultra-Trail Kosciuszko by UTMB - Kosci 50K", "Ultra-Trail Kosciuszko by UTMB")).toBe("Kosci 50K");
    expect(getFormatLabelWithinEvent("Trail du Lac", "Festival des Cimes")).toBe("Trail du Lac");
    expect(getFormatLabelWithinEvent("SaintéLyon", "SaintéLyon")).toBe("SaintéLyon");
    expect(getFormatLabelWithinEvent("Course", null)).toBe("Course");
  });
});
