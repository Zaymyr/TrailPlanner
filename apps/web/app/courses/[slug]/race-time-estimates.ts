import {
  REFERENCE_FLAT_PACES,
  estimateCourseTime,
  formatDurationHm,
} from "../../(planner)/race-planner/utils/quick-estimate";
import type { PublicRaceDetail } from "../../../lib/public-race-detail";

export type ReferenceEstimate = {
  key: string;
  label: string;
  flatPaceMinPerKm: number;
  totalSeconds: number;
};

/**
 * Reference finishing times for three runner levels, computed with the same
 * effort model as the planner. They are only published when the course has a
 * known distance and D+, so the page never invents a duration from missing facts.
 */
export function buildReferenceEstimates(
  race: Pick<PublicRaceDetail, "distanceKm" | "elevationGainM" | "elevationLossM" | "routePreview" | "aidStations">,
): ReferenceEstimate[] {
  if (race.distanceKm === null || race.distanceKm <= 0 || race.elevationGainM === null) return [];
  const course = {
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    elevationLossM: race.elevationLossM ?? race.routePreview?.stats.lossM ?? null,
    points: race.routePreview?.points ?? null,
    aidStations: race.aidStations.map((station) => ({ name: station.name, distanceKm: station.distanceKm })),
  };
  return REFERENCE_FLAT_PACES.flatMap((level) => {
    const result = estimateCourseTime(course, level.flatPaceMinPerKm);
    return result ? [{ key: level.key, label: level.label, flatPaceMinPerKm: level.flatPaceMinPerKm, totalSeconds: result.totalSeconds }] : [];
  });
}

export function formatReferenceRange(estimates: ReferenceEstimate[]) {
  if (estimates.length < 2) return null;
  const sorted = [...estimates].sort((a, b) => a.totalSeconds - b.totalSeconds);
  return `${formatDurationHm(sorted[0].totalSeconds)} à ${formatDurationHm(sorted[sorted.length - 1].totalSeconds)}`;
}
