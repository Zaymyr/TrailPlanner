import type { FuelProduct } from "../../../../lib/product-types";

import type { AidStationDraft, GpxPreview, RelayPointDraft, StationProduct } from "./types";

export const ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS = 5 * 60 * 1000;
export const ORGANIZER_RACE_SIDECARS_STALE_TIME_MS = 2 * 60 * 1000;
export const ORGANIZER_GPX_PREVIEW_STALE_TIME_MS = 10 * 60 * 1000;

export type OrganizerRaceSidecars = {
  aidStations: AidStationDraft[];
  relayPoints: RelayPointDraft[];
  stationProducts: StationProduct[];
};

type CacheEntry<T> = {
  value: T;
  writtenAt: number;
};

let productCatalogEntry: CacheEntry<FuelProduct[]> | null = null;
const raceSidecarEntries = new Map<string, CacheEntry<OrganizerRaceSidecars>>();
const gpxPreviewEntries = new Map<string, Map<string, CacheEntry<GpxPreview>>>();

const readFreshEntry = <T>(entry: CacheEntry<T> | undefined | null, staleTimeMs: number, now: number) => {
  if (!entry || now - entry.writtenAt >= staleTimeMs) return null;
  return entry.value;
};

export const readOrganizerProductCatalogCache = (now = Date.now()) => {
  const value = readFreshEntry(productCatalogEntry, ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS, now);
  if (!value && productCatalogEntry) productCatalogEntry = null;
  return value;
};

export const writeOrganizerProductCatalogCache = (products: FuelProduct[], now = Date.now()) => {
  productCatalogEntry = { value: products, writtenAt: now };
};

export const invalidateOrganizerProductCatalogCache = () => {
  productCatalogEntry = null;
};

export const readOrganizerRaceSidecarsCache = (raceId: string, now = Date.now()) => {
  const entry = raceSidecarEntries.get(raceId);
  const value = readFreshEntry(entry, ORGANIZER_RACE_SIDECARS_STALE_TIME_MS, now);
  if (!value && entry) raceSidecarEntries.delete(raceId);
  return value;
};

export const writeOrganizerRaceSidecarsCache = (
  raceId: string,
  sidecars: OrganizerRaceSidecars,
  now = Date.now()
) => {
  raceSidecarEntries.set(raceId, { value: sidecars, writtenAt: now });
};

export const invalidateOrganizerRaceSidecarsCache = (raceId: string) => {
  raceSidecarEntries.delete(raceId);
};

export const readOrganizerGpxPreviewCache = (
  raceId: string,
  gpxStoragePath: string | null | undefined,
  now = Date.now()
) => {
  if (!gpxStoragePath) return null;
  const entriesForRace = gpxPreviewEntries.get(raceId);
  const entry = entriesForRace?.get(gpxStoragePath);
  const value = readFreshEntry(entry, ORGANIZER_GPX_PREVIEW_STALE_TIME_MS, now);
  if (!value && entry) {
    entriesForRace?.delete(gpxStoragePath);
    if (entriesForRace?.size === 0) gpxPreviewEntries.delete(raceId);
  }
  return value;
};

export const writeOrganizerGpxPreviewCache = (
  raceId: string,
  gpxStoragePath: string,
  preview: GpxPreview,
  now = Date.now()
) => {
  const entriesForRace = gpxPreviewEntries.get(raceId) ?? new Map<string, CacheEntry<GpxPreview>>();
  entriesForRace.set(gpxStoragePath, { value: preview, writtenAt: now });
  gpxPreviewEntries.set(raceId, entriesForRace);
};

export const invalidateOrganizerGpxPreviewCache = (raceId: string) => {
  gpxPreviewEntries.delete(raceId);
};

export const invalidateOrganizerRaceDataCache = (raceId: string) => {
  invalidateOrganizerRaceSidecarsCache(raceId);
  invalidateOrganizerGpxPreviewCache(raceId);
};

export const clearOrganizerDataCache = () => {
  invalidateOrganizerProductCatalogCache();
  raceSidecarEntries.clear();
  gpxPreviewEntries.clear();
};
