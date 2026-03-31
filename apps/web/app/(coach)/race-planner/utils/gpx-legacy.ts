import type { RacePlannerTranslations } from "../../../../locales/types";
import type { ElevationPoint, FormValues } from "../types";
import { dedupeAidStations, sanitizeAidStations, sanitizeElevationProfile, sanitizePlannerValues } from "./plan-sanitizers";
import { parseStandardGpx, type ParsedGpx } from "./gpx-standard";

type PlannerStatePayload = {
  version?: number;
  values?: Partial<FormValues>;
  elevationProfile?: ElevationPoint[];
};

const decodeBase64 = (input: string) => {
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(input)));
  }
  return Buffer.from(input, "base64").toString("utf-8");
};

export function extractLegacyPlannerState(content: string): { state: PlannerStatePayload | null; invalid: boolean } {
  const encoded =
    content.match(/<trailplanner:state>([\s\S]*?)<\/trailplanner:state>/i)?.[1]?.trim() ??
    content.match(/<plannerState>([\s\S]*?)<\/plannerState>/i)?.[1]?.trim() ??
    null;

  if (!encoded) {
    return { state: null, invalid: false };
  }

  try {
    const decodedJson = decodeBase64(encoded);
    const payload = JSON.parse(decodedJson) as PlannerStatePayload;
    return { state: payload, invalid: false };
  } catch (error) {
    console.error("Unable to parse planner state from GPX", error);
    return { state: null, invalid: true };
  }
}

export const hasLegacyPlannerState = (content: string) => /<(trailplanner:state|plannerState)>/i.test(content);

export function parseLegacyGpx(content: string, copy: RacePlannerTranslations): ParsedGpx {
  const { state: plannerState, invalid } = extractLegacyPlannerState(content);
  if (invalid) {
    throw new Error(copy.gpx.errors.invalidPlannerState);
  }

  let parsedTrack: Omit<ParsedGpx, "plannerValues"> | null = null;

  try {
    parsedTrack = parseStandardGpx(content, copy);
  } catch {
    parsedTrack = null;
  }

  if (!parsedTrack && !plannerState) {
    throw new Error(copy.gpx.errors.noTrackPoints);
  }

  const sanitizedPlannerValues = sanitizePlannerValues(plannerState?.values);
  const profileFromState = sanitizeElevationProfile(plannerState?.elevationProfile);
  const elevationProfile = profileFromState.length > 0 ? profileFromState : parsedTrack?.elevationProfile ?? [];
  const distanceFromProfile = elevationProfile.at(-1)?.distanceKm;
  const baseDistance =
    sanitizedPlannerValues?.raceDistanceKm ?? parsedTrack?.distanceKm ?? (distanceFromProfile ?? 0) ?? 0;

  const aidStationsFromState = sanitizeAidStations(sanitizedPlannerValues?.aidStations);
  const baseAidStations = aidStationsFromState.length > 0 ? aidStationsFromState : parsedTrack?.aidStations ?? [];

  const aidStationsWithFinish = dedupeAidStations([
    ...baseAidStations,
    { name: copy.defaults.finish, distanceKm: Number(baseDistance.toFixed(1)), waterRefill: true },
  ]);

  return {
    distanceKm: Number(baseDistance.toFixed(1)),
    aidStations: aidStationsWithFinish,
    elevationProfile,
    plannerValues: sanitizedPlannerValues,
  };
}
