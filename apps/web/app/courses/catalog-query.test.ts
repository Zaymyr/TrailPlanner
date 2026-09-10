import { describe, expect, it } from "vitest";

import type { PublicRace } from "../../lib/public-races";
import {
  CATALOG_GROUPS_PER_PAGE,
  getCatalogHref,
  getCatalogView,
  isCanonicalPaginationQuery,
  parseCatalogQuery,
} from "./catalog-query";

const makeRace = (index: number, overrides: Partial<PublicRace> = {}): PublicRace => ({
  id: `race-${index}`,
  eventId: `event-${index}`,
  editionId: `edition-${index}`,
  slug: `race-${index}`,
  name: `Race ${index}`,
  eventName: `Event ${index}`,
  date: "2027-01-01",
  location: "France",
  searchTerms: ["France"],
  distanceKm: 42,
  elevationGainM: 1_000,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: null,
  updatedAt: null,
  ...overrides,
});

describe("server-rendered race catalog query", () => {
  it("normalizes untrusted query values and bounds search text", () => {
    expect(parseCatalogQuery({ distance: "invalid", period: "invalid", page: "-4" })).toEqual({
      search: "",
      distance: "all",
      period: "upcoming",
      page: 1,
    });
    expect(parseCatalogQuery({ q: " x".repeat(80) }).search).toHaveLength(100);
  });

  it("paginates complete event groups without serializing the full catalog", () => {
    const races = Array.from({ length: CATALOG_GROUPS_PER_PAGE + 2 }, (_, index) => makeRace(index));
    const first = getCatalogView(races, parseCatalogQuery(), "2026-09-10");
    const second = getCatalogView(races, parseCatalogQuery({ page: "2" }), "2026-09-10");

    expect(first.groups).toHaveLength(CATALOG_GROUPS_PER_PAGE);
    expect(first.filteredRaceCount).toBe(races.length);
    expect(first.totalPages).toBe(2);
    expect(second.groups).toHaveLength(2);
    expect(second.firstRacePosition).toBe(CATALOG_GROUPS_PER_PAGE + 1);
  });

  it("preserves filters in pagination links and omits default parameters", () => {
    expect(getCatalogHref(parseCatalogQuery(), 1)).toBe("/courses");
    expect(
      getCatalogHref(parseCatalogQuery({ q: "Puy de Dôme", distance: "trail", period: "all" }), 2),
    ).toBe("/courses?q=Puy+de+D%C3%B4me&distance=trail&period=all&page=2");
  });

  it("indexes only the clean catalog URL and normalized page URLs", () => {
    expect(isCanonicalPaginationQuery({}, parseCatalogQuery())).toBe(true);
    expect(isCanonicalPaginationQuery({ page: "2" }, parseCatalogQuery({ page: "2" }))).toBe(true);
    expect(isCanonicalPaginationQuery({ page: "01" }, parseCatalogQuery({ page: "01" }))).toBe(false);
    expect(isCanonicalPaginationQuery({ page: "invalid" }, parseCatalogQuery({ page: "invalid" }))).toBe(false);
    expect(isCanonicalPaginationQuery({ tracking: "x" } as CatalogSearchParams, parseCatalogQuery())).toBe(false);
  });

  it("filters across the full data set before taking a page", () => {
    const races = Array.from({ length: 20 }, (_, index) =>
      makeRace(index, { location: index === 19 ? "Annecy" : "Lyon", searchTerms: [] }),
    );
    const view = getCatalogView(races, parseCatalogQuery({ q: "Annecy" }), "2026-09-10");

    expect(view.filteredRaceCount).toBe(1);
    expect(view.groups[0]?.races[0]?.id).toBe("race-19");
  });
});
