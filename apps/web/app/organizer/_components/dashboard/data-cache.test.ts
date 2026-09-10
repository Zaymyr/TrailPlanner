import { beforeEach, describe, expect, it } from "vitest";

import type { FuelProduct } from "../../../../lib/product-types";
import {
  clearOrganizerDataCache,
  invalidateOrganizerGpxPreviewCache,
  invalidateOrganizerProductCatalogCache,
  invalidateOrganizerRaceDataCache,
  invalidateOrganizerRaceSidecarsCache,
  ORGANIZER_GPX_PREVIEW_STALE_TIME_MS,
  ORGANIZER_GPX_PREVIEW_PATH_CACHE_CAPACITY,
  ORGANIZER_GPX_PREVIEW_RACE_CACHE_CAPACITY,
  ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS,
  ORGANIZER_RACE_SIDECARS_CACHE_CAPACITY,
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

  it("bounds sidecars with least-recently-used eviction", () => {
    for (let index = 0; index < ORGANIZER_RACE_SIDECARS_CACHE_CAPACITY; index += 1) {
      writeOrganizerRaceSidecarsCache(`race-${index}`, buildSidecars(`race-${index}`), 1_000 + index);
    }
    expect(readOrganizerRaceSidecarsCache("race-0", 2_000)).not.toBeNull();

    writeOrganizerRaceSidecarsCache("race-overflow", buildSidecars("race-overflow"), 2_001);

    expect(readOrganizerRaceSidecarsCache("race-0", 2_002)).not.toBeNull();
    expect(readOrganizerRaceSidecarsCache("race-1", 2_002)).toBeNull();
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

  it("bounds GPX paths per race with least-recently-used eviction", () => {
    for (let index = 0; index < ORGANIZER_GPX_PREVIEW_PATH_CACHE_CAPACITY; index += 1) {
      writeOrganizerGpxPreviewCache("race-1", `path-${index}.gpx`, buildPreview(index), 1_000 + index);
    }
    expect(readOrganizerGpxPreviewCache("race-1", "path-0.gpx", 2_000)).not.toBeNull();

    writeOrganizerGpxPreviewCache("race-1", "path-overflow.gpx", buildPreview(99), 2_001);

    expect(readOrganizerGpxPreviewCache("race-1", "path-0.gpx", 2_002)).not.toBeNull();
    expect(readOrganizerGpxPreviewCache("race-1", "path-1.gpx", 2_002)).toBeNull();
  });

  it("bounds GPX races with least-recently-used eviction", () => {
    for (let index = 0; index < ORGANIZER_GPX_PREVIEW_RACE_CACHE_CAPACITY; index += 1) {
      writeOrganizerGpxPreviewCache(`race-${index}`, "route.gpx", buildPreview(index), 1_000 + index);
    }
    expect(readOrganizerGpxPreviewCache("race-0", "route.gpx", 2_000)).not.toBeNull();

    writeOrganizerGpxPreviewCache("race-overflow", "route.gpx", buildPreview(99), 2_001);

    expect(readOrganizerGpxPreviewCache("race-0", "route.gpx", 2_002)).not.toBeNull();
    expect(readOrganizerGpxPreviewCache("race-1", "route.gpx", 2_002)).toBeNull();
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
