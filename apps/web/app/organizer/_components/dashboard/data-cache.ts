import type { FuelProduct } from "../../../../lib/product-types";

import type { AidStationDraft, GpxPreview, RelayPointDraft, StationProduct } from "./types";

export const ORGANIZER_PRODUCT_CATALOG_STALE_TIME_MS = 5 * 60 * 1000;
export const ORGANIZER_RACE_SIDECARS_STALE_TIME_MS = 2 * 60 * 1000;
export const ORGANIZER_GPX_PREVIEW_STALE_TIME_MS = 10 * 60 * 1000;
export const ORGANIZER_RACE_SIDECARS_CACHE_CAPACITY = 20;
export const ORGANIZER_GPX_PREVIEW_RACE_CACHE_CAPACITY = 20;
export const ORGANIZER_GPX_PREVIEW_PATH_CACHE_CAPACITY = 3;

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

const purgeExpiredEntries = <T>(entries: Map<string, CacheEntry<T>>, staleTimeMs: number, now: number) => {
  for (const [key, entry] of entries) {
    if (now - entry.writtenAt >= staleTimeMs) entries.delete(key);
  }
};

const touchEntry = <T>(entries: Map<string, T>, key: string, value: T) => {
  entries.delete(key);
  entries.set(key, value);
};

const enforceCapacity = <T>(entries: Map<string, T>, capacity: number) => {
  while (entries.size > capacity) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (oldestKey === undefined) return;
    entries.delete(oldestKey);
  }
};

const purgeExpiredGpxEntries = (now: number) => {
  for (const [raceId, entriesForRace] of gpxPreviewEntries) {
    purgeExpiredEntries(entriesForRace, ORGANIZER_GPX_PREVIEW_STALE_TIME_MS, now);
    if (entriesForRace.size === 0) gpxPreviewEntries.delete(raceId);
  }
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
  else if (entry) touchEntry(raceSidecarEntries, raceId, entry);
  return value;
};

export const writeOrganizerRaceSidecarsCache = (
  raceId: string,
  sidecars: OrganizerRaceSidecars,
  now = Date.now()
) => {
  purgeExpiredEntries(raceSidecarEntries, ORGANIZER_RACE_SIDECARS_STALE_TIME_MS, now);
  touchEntry(raceSidecarEntries, raceId, { value: sidecars, writtenAt: now });
  enforceCapacity(raceSidecarEntries, ORGANIZER_RACE_SIDECARS_CACHE_CAPACITY);
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
  } else if (entry && entriesForRace) {
    touchEntry(entriesForRace, gpxStoragePath, entry);
    touchEntry(gpxPreviewEntries, raceId, entriesForRace);
  }
  return value;
};

export const writeOrganizerGpxPreviewCache = (
  raceId: string,
  gpxStoragePath: string,
  preview: GpxPreview,
  now = Date.now()
) => {
  purgeExpiredGpxEntries(now);
  const entriesForRace = gpxPreviewEntries.get(raceId) ?? new Map<string, CacheEntry<GpxPreview>>();
  touchEntry(entriesForRace, gpxStoragePath, { value: preview, writtenAt: now });
  enforceCapacity(entriesForRace, ORGANIZER_GPX_PREVIEW_PATH_CACHE_CAPACITY);
  touchEntry(gpxPreviewEntries, raceId, entriesForRace);
  enforceCapacity(gpxPreviewEntries, ORGANIZER_GPX_PREVIEW_RACE_CACHE_CAPACITY);
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
