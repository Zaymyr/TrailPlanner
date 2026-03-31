import type { RacePlannerTranslations } from "../../../../locales/types";
import type { ElevationPoint, FormValues } from "../types";
import { buildStandardPlannerGpx, haversineDistanceMeters, parseStandardGpx, type ParsedGpx } from "./gpx-standard";
import { hasLegacyPlannerState, parseLegacyGpx } from "./gpx-legacy";

export type { ParsedGpx };

export function buildFlatElevationProfile(distanceKm: number): ElevationPoint[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return [];

  return [
    { distanceKm: 0, elevationM: 0, lat: 45, lon: 3 },
    { distanceKm: Number(distanceKm.toFixed(2)), elevationM: 0, lat: 45.0001, lon: 3 },
  ];
}

export function buildPlannerGpx(values: FormValues, elevationProfile: ElevationPoint[]) {
  const profile = elevationProfile.length > 0 ? elevationProfile : buildFlatElevationProfile(values.raceDistanceKm);
  return buildStandardPlannerGpx(values, profile);
}

export function parseGpx(content: string, copy: RacePlannerTranslations): ParsedGpx {
  if (hasLegacyPlannerState(content)) {
    return parseLegacyGpx(content, copy);
  }

  return parseStandardGpx(content, copy);
}

export { haversineDistanceMeters };
