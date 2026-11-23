import type { AidStation, ElevationPoint } from "../types";

/** Row returned by `GET /api/race-catalog/[id]/aid-stations` (public catalog aid stations). */
export type CatalogAidStationRow = {
  id?: string;
  name: string;
  km: number;
  water_available?: boolean | null;
  solid_available?: boolean | null;
  assistance_allowed?: boolean | null;
  order_index?: number | null;
};

/** Positive elevation sum along a profile, in metres. */
export function elevationGainFromProfile(profile: ElevationPoint[]): number {
  let gain = 0;
  for (let index = 1; index < profile.length; index += 1) {
    const delta = profile[index].elevationM - profile[index - 1].elevationM;
    if (Number.isFinite(delta) && delta > 0) gain += delta;
  }
  return Math.round(gain);
}

/**
 * Aid stations of a catalog race for the local (visitor) plan, mapped like `POST /api/plans/from-catalog`
 * does for an account: ordered, without the finish, inside the course distance.
 */
export function mapCatalogAidStations(rows: CatalogAidStationRow[], raceDistanceKm: number): AidStation[] {
  return [...rows]
    .filter((row) => Number.isFinite(row.km) && row.km > 0 && (!(raceDistanceKm > 0) || row.km < raceDistanceKm))
    .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0) || left.km - right.km)
    .map((row) => ({
      name: row.name,
      distanceKm: row.km,
      ...(row.id ? { sourceAidStationId: row.id } : {}),
      waterRefill: row.water_available !== false,
      solidRefill: row.solid_available !== false,
      assistanceAllowed: row.assistance_allowed !== false,
    }));
}

/**
 * D+ shown in the visitor preview: the catalog value the quick estimate used, else the GPX profile gain,
 * else the planner default. Never the planner default when the race has a real profile.
 */
export function resolvePreviewElevationGain(
  catalogElevationGainM: number | null | undefined,
  profile: ElevationPoint[],
  fallback: number,
): number {
  if (typeof catalogElevationGainM === "number" && Number.isFinite(catalogElevationGainM) && catalogElevationGainM >= 0) {
    return Math.round(catalogElevationGainM);
  }
  if (profile.length > 1) return elevationGainFromProfile(profile);
  return fallback;
}
