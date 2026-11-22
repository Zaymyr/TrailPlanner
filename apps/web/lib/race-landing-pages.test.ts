import { describe, expect, it } from "vitest";

import { DEMO_EVENT_ID } from "./demo-race";
import type { PublicRace } from "./public-races";
import {
  buildLandingCrossLinks,
  buildLandingDescription,
  buildLandingTitle,
  frenchRegions,
  getFrenchRegionBySlug,
  getIndexableMonthPages,
  getIndexableRegionPages,
  getLandingPagePath,
  getLandingRaces,
  getTodayInFrance,
  monthLandingCopy,
  paginateLandingRaces,
  parseLandingPageSegments,
  parseMonthSlug,
  regionLandingCopy,
} from "./race-landing-pages";

const TODAY = "2026-11-22";

const makeRace = (overrides: Partial<PublicRace> & Pick<PublicRace, "id">): PublicRace => ({
  eventId: null,
  editionId: null,
  eventEditionSlug: null,
  eventSlug: null,
  slug: overrides.id,
  name: overrides.id,
  eventName: null,
  date: "2027-05-10",
  location: null,
  locationCity: null,
  locationDepartment: null,
  locationRegion: null,
  locationCountry: null,
  regionSlug: null,
  searchTerms: [],
  distanceKm: 25,
  elevationGainM: null,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: null,
  eventWebsiteUrl: null,
  updatedAt: null,
  ...overrides,
});

const many = (count: number, overrides: Partial<PublicRace> = {}, prefix = "race") =>
  Array.from({ length: count }, (_, index) => makeRace({ id: `${prefix}-${index}`, ...overrides }));

describe("race landing pages", () => {
  it("keeps only dated upcoming formats and never the demo", () => {
    const races = [
      makeRace({ id: "today", date: TODAY }),
      makeRace({ id: "past", date: "2026-11-21" }),
      makeRace({ id: "undated", date: null }),
      makeRace({ id: "demo", eventId: DEMO_EVENT_ID, date: "2027-01-01" }),
    ];
    expect(getLandingRaces(races, TODAY).map((race) => race.id)).toEqual(["today"]);
  });

  it("indexes a region only from five upcoming formats with its normalized slug", () => {
    const races = [
      ...many(5, { regionSlug: "bretagne" }, "bzh"),
      ...many(4, { regionSlug: "corse" }, "corse"),
      ...many(3, { regionSlug: "corse", date: "2026-01-01" }, "corse-past"),
    ];
    expect(getIndexableRegionPages(races, TODAY).map(({ region, races: matching }) => [region.slug, matching.length])).toEqual([
      ["bretagne", 5],
    ]);
  });

  it("indexes upcoming months with at least five formats and readable French slugs", () => {
    const races = [
      ...many(5, { date: "2027-08-14" }, "aout"),
      ...many(4, { date: "2027-02-01" }, "fevrier"),
    ];
    expect(getIndexableMonthPages(races, TODAY).map(({ month }) => month.slug)).toEqual(["aout-2027"]);
    expect(parseMonthSlug("aout-2027")).toEqual(expect.objectContaining({ key: "2027-08", label: "août 2027" }));
    expect(parseMonthSlug("fevrier-2027")?.key).toBe("2027-02");
    expect(parseMonthSlug("2027-08")).toBeNull();
    expect(parseMonthSlug("brumaire-2027")).toBeNull();
  });

  it("parses optional pagination segments without duplicating page one", () => {
    expect(parseLandingPageSegments(undefined)).toBe(1);
    expect(parseLandingPageSegments([])).toBe(1);
    expect(parseLandingPageSegments(["page", "3"])).toBe(3);
    expect(parseLandingPageSegments(["page", "1"])).toBeNull();
    expect(parseLandingPageSegments(["page", "02"])).toBeNull();
    expect(parseLandingPageSegments(["3"])).toBeNull();
    expect(parseLandingPageSegments(["page", "2", "x"])).toBeNull();
    expect(getLandingPagePath("/courses/regions/bretagne", 1)).toBe("/courses/regions/bretagne");
    expect(getLandingPagePath("/courses/regions/bretagne", 2)).toBe("/courses/regions/bretagne/page/2");
  });

  it("paginates event groups with continuous ItemList positions", () => {
    const races = many(30);
    const first = paginateLandingRaces(races, 1);
    const third = paginateLandingRaces(races, 3);
    expect(first.totalPages).toBe(3);
    expect(first.groups).toHaveLength(12);
    expect(third.groups).toHaveLength(6);
    expect(third.firstRacePosition).toBe(25);
    expect(third.raceCount).toBe(30);
  });

  it("keeps every title within 60 characters and every description within 160", () => {
    for (const region of frenchRegions) {
      const copy = regionLandingCopy(region, 146);
      for (const page of [1, 2, 12]) {
        expect(buildLandingTitle(copy.titleCandidates, page).length).toBeLessThanOrEqual(60);
        expect(buildLandingDescription(copy.description, page).length).toBeLessThanOrEqual(160);
      }
    }
    const month = parseMonthSlug("septembre-2027");
    expect(month).not.toBeNull();
    const monthCopy = monthLandingCopy(month!, 105);
    expect(buildLandingTitle(monthCopy.titleCandidates, 1)).toBe("Trail en septembre 2027 : calendrier des courses");
    expect(buildLandingTitle(monthCopy.titleCandidates, 3)).toBe("Trail en septembre 2027 : calendrier des courses – page 3");
    expect(buildLandingTitle(regionLandingCopy(getFrenchRegionBySlug("provence-alpes-cote-d-azur")!, 5).titleCandidates, 1).length).toBeLessThanOrEqual(60);
  });

  it("cross-links the indexable distance, region and month pages", () => {
    const races = many(6, { regionSlug: "occitanie", date: "2027-03-02", distanceKm: 90 });
    const groups = buildLandingCrossLinks(races, TODAY, "/courses/regions/occitanie");
    expect(groups.map((group) => group.links.map((link) => link.href))).toEqual([
      ["/courses/distances/ultra-trail"],
      ["/courses/regions/occitanie"],
      ["/courses/mois/mars-2027"],
    ]);
    expect(groups[1].links[0].current).toBe(true);
  });

  it("computes today in Europe/Paris", () => {
    expect(getTodayInFrance(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
  });
});
