import { beforeEach, describe, expect, it } from "vitest";

import type { FuelProduct } from "../../../../lib/product-types";
import {
  clearOrganizerDataCache,
  invalidateOrganizerGpxPreviewCache,
  invalidateOrganizerProductCatalogCache,
  invalidateOrganizerRaceDataCache,
  invalidateOrganizerRaceSidecarsCache,
  ORGANIZER_GPX_PREVIEW_STALE_TIME_MS,
  ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS,
  ORGANIZER_RACE_SIDECARS_STALE_TIME_MS,
  readOrganizerGpxPreviewCache,
  readOrganizerProductCatalogCache,
  readOrganizerRaceSidecarsCache,
  writeOrganizerGpxPreviewCache,
  writeOrganizerProductCatalogCache,
  writeOrganizerRaceSidecarsCache,
  type OrganizerRaceSidecars,
} from "./data-cache";
import type { GpxPreview } from "./types";

const product: FuelProduct = {
  id: "product-1",
  slug: "gel-citron",
  name: "Gel citron",
  caloriesKcal: 100,
  carbsGrams: 25,
  sodiumMg: 100,
  proteinGrams: 0,
  fatGrams: 0,
  fuelType: "gel",
};

const buildSidecars = (raceId: string): OrganizerRaceSidecars => ({
  aidStations: [
    {
      id: `station-${raceId}`,
      name: `Ravito ${raceId}`,
      distanceKm: 10,
      waterRefill: true,
      solidRefill: true,
      assistanceAllowed: false,
      organizerDetails: {},
    },
  ],
  relayPoints: [],
  stationProducts: [],
});

const buildPreview = (distanceKm: number): GpxPreview => ({
  stats: { distanceKm, gainM: 1000, lossM: 900, minAltM: 200, maxAltM: 1200 },
  elevationProfile: [{ distanceKm: 0, elevationM: 200 }],
  detectedAidStations: [],
});

describe("organizer dashboard data cache", () => {
  beforeEach(() => clearOrganizerDataCache());

  it("returns a catalog miss, then a hit until its explicit stale time expires", () => {
    expect(readOrganizerProductCatalogCache(1_000)).toBeNull();

    writeOrganizerProductCatalogCache([product], 1_000);

    expect(readOrganizerProductCatalogCache(1_000 + ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS - 1)).toEqual([product]);
    expect(readOrganizerProductCatalogCache(1_000 + ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS)).toBeNull();
  });

  it("invalidates the product catalog explicitly", () => {
    writeOrganizerProductCatalogCache([product], 1_000);
    invalidateOrganizerProductCatalogCache();
    expect(readOrganizerProductCatalogCache(1_001)).toBeNull();
  });

  it("isolates race sidecars and expires only the stale race entry", () => {
    const raceOne = buildSidecars("race-1");
    const raceTwo = buildSidecars("race-2");
    writeOrganizerRaceSidecarsCache("race-1", raceOne, 1_000);
    writeOrganizerRaceSidecarsCache("race-2", raceTwo, 1_001);

    expect(readOrganizerRaceSidecarsCache("race-1", 1_001)).toBe(raceOne);
    expect(readOrganizerRaceSidecarsCache("race-2", 1_001)).toBe(raceTwo);
    expect(readOrganizerRaceSidecarsCache("race-1", 1_000 + ORGANIZER_RACE_SIDECARS_STALE_TIME_MS)).toBeNull();
    expect(readOrganizerRaceSidecarsCache("race-2", 1_000 + ORGANIZER_RACE_SIDECARS_STALE_TIME_MS)).toBe(raceTwo);
  });

  it("invalidates one race's sidecars without touching another race", () => {
    writeOrganizerRaceSidecarsCache("race-1", buildSidecars("race-1"), 1_000);
    writeOrganizerRaceSidecarsCache("race-2", buildSidecars("race-2"), 1_000);

    invalidateOrganizerRaceSidecarsCache("race-1");

    expect(readOrganizerRaceSidecarsCache("race-1", 1_001)).toBeNull();
    expect(readOrganizerRaceSidecarsCache("race-2", 1_001)).not.toBeNull();
  });

  it("keys GPX previews by race and storage path so replacement misses naturally", () => {
    const oldPreview = buildPreview(42);
    const otherRacePreview = buildPreview(80);
    writeOrganizerGpxPreviewCache("race-1", "event/race/old.gpx", oldPreview, 1_000);
    writeOrganizerGpxPreviewCache("race-2", "event/race/old.gpx", otherRacePreview, 1_000);

    expect(readOrganizerGpxPreviewCache("race-1", "event/race/old.gpx", 1_001)).toBe(oldPreview);
    expect(readOrganizerGpxPreviewCache("race-1", "event/race/new.gpx", 1_001)).toBeNull();
    expect(readOrganizerGpxPreviewCache("race-2", "event/race/old.gpx", 1_001)).toBe(otherRacePreview);
  });

  it("expires and explicitly invalidates GPX previews per race", () => {
    writeOrganizerGpxPreviewCache("race-1", "race-1.gpx", buildPreview(42), 1_000);
    writeOrganizerGpxPreviewCache("race-2", "race-2.gpx", buildPreview(80), 1_000);

    expect(
      readOrganizerGpxPreviewCache("race-1", "race-1.gpx", 1_000 + ORGANIZER_GPX_PREVIEW_STALE_TIME_MS)
    ).toBeNull();
    invalidateOrganizerGpxPreviewCache("race-2");
    expect(readOrganizerGpxPreviewCache("race-2", "race-2.gpx", 1_001)).toBeNull();
  });

  it("invalidates all race-specific data and supports a complete clear", () => {
    writeOrganizerProductCatalogCache([product], 1_000);
    writeOrganizerRaceSidecarsCache("race-1", buildSidecars("race-1"), 1_000);
    writeOrganizerGpxPreviewCache("race-1", "race-1.gpx", buildPreview(42), 1_000);

    invalidateOrganizerRaceDataCache("race-1");
    expect(readOrganizerRaceSidecarsCache("race-1", 1_001)).toBeNull();
    expect(readOrganizerGpxPreviewCache("race-1", "race-1.gpx", 1_001)).toBeNull();
    expect(readOrganizerProductCatalogCache(1_001)).toEqual([product]);

    clearOrganizerDataCache();
    expect(readOrganizerProductCatalogCache(1_001)).toBeNull();
  });
});
