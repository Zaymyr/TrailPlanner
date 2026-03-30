import { haversineMeters, type GpxWaypoint } from "./parseGpx";

export type NormalizedImportedWaypoint = {
  name: string;
  distanceKm: number;
  kind: "start" | "finish" | "aid";
  sourceIndex: number;
};

export type NormalizedImportedWaypoints = {
  startName: string;
  finishName: string;
  aidStations: NormalizedImportedWaypoint[];
};

type Candidate = {
  sourceIndex: number;
  name: string;
  distanceKm: number;
  nearestMetersToTrackPoint: number;
  explicitStart: boolean;
  explicitFinish: boolean;
};

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeName = (value?: string | null) => stripAccents((value ?? "").toLowerCase().trim());

const isStartName = (name: string) => /\b(start|depart|departure)\b/.test(name);
const isFinishName = (name: string) => /\b(finish|arrivee|arrival|arrive|end)\b/.test(name);

const nearestTrackDistanceKm = (
  waypoint: GpxWaypoint,
  points: Array<{ lat: number; lng: number; distKmCum: number }>
) => {
  let nearest = points[0];
  let minMeters = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const meters = haversineMeters(waypoint.lat, waypoint.lng, point.lat, point.lng);
    if (meters < minMeters) {
      minMeters = meters;
      nearest = point;
    }
  }

  return { distanceKm: nearest.distKmCum, metersToTrack: minMeters };
};

export const normalizeImportedWaypoints = (
  points: Array<{ lat: number; lng: number; distKmCum: number }>,
  waypoints: Array<GpxWaypoint & { distanceKm?: number }>,
  defaults?: { startName?: string; finishName?: string }
): NormalizedImportedWaypoints => {
  const defaultStartName = defaults?.startName?.trim() || "Start";
  const defaultFinishName = defaults?.finishName?.trim() || "Finish";

  if (points.length === 0) {
    return { startName: defaultStartName, finishName: defaultFinishName, aidStations: [] };
  }

  const totalDistanceKm = points.at(-1)?.distKmCum ?? 0;
  const endpointThresholdKm = Math.max(0.15, Math.min(0.6, totalDistanceKm * 0.01));
  const duplicateThresholdKm = 0.2;

  const candidates: Candidate[] = waypoints
    .map((waypoint, sourceIndex) => {
      const nearest = nearestTrackDistanceKm(waypoint, points);
      const computedDistanceKm =
        typeof waypoint.distanceKm === "number" && Number.isFinite(waypoint.distanceKm)
          ? waypoint.distanceKm
          : nearest.distanceKm;
      const fallbackName = waypoint.desc?.trim() || `Aid station ${sourceIndex + 1}`;
      const name = waypoint.name?.trim() || fallbackName;
      const normalized = normalizeName(name);

      return {
        sourceIndex,
        name,
        distanceKm: Number(computedDistanceKm.toFixed(3)),
        nearestMetersToTrackPoint: nearest.metersToTrack,
        explicitStart: isStartName(normalized),
        explicitFinish: isFinishName(normalized),
      };
    })
    .filter((candidate) => Number.isFinite(candidate.distanceKm));

  const scoreStart = (candidate: Candidate) => {
    const proximity = Math.abs(candidate.distanceKm - 0);
    return {
      explicit: candidate.explicitStart ? 1 : 0,
      proximity,
      distance: candidate.distanceKm,
      meters: candidate.nearestMetersToTrackPoint,
    };
  };

  const scoreFinish = (candidate: Candidate) => {
    const proximity = Math.abs(totalDistanceKm - candidate.distanceKm);
    return {
      explicit: candidate.explicitFinish ? 1 : 0,
      proximity,
      distance: candidate.distanceKm,
      meters: candidate.nearestMetersToTrackPoint,
    };
  };

  const startCandidate = candidates
    .filter((candidate) => candidate.explicitStart || candidate.distanceKm <= endpointThresholdKm)
    .sort((a, b) => {
      const sa = scoreStart(a);
      const sb = scoreStart(b);
      return sb.explicit - sa.explicit || sa.proximity - sb.proximity || sa.meters - sb.meters || sa.distance - sb.distance;
    })[0];

  const finishCandidate = candidates
    .filter(
      (candidate) =>
        candidate.sourceIndex !== startCandidate?.sourceIndex &&
        (candidate.explicitFinish || Math.abs(totalDistanceKm - candidate.distanceKm) <= endpointThresholdKm)
    )
    .sort((a, b) => {
      const sa = scoreFinish(a);
      const sb = scoreFinish(b);
      return sb.explicit - sa.explicit || sa.proximity - sb.proximity || sa.meters - sb.meters || sb.distance - sa.distance;
    })[0];

  const startName = startCandidate?.name || defaultStartName;
  const finishName = finishCandidate?.name || defaultFinishName;

  const nearStart = (candidate: Candidate) => Math.abs(candidate.distanceKm) <= duplicateThresholdKm;
  const nearFinish = (candidate: Candidate) => Math.abs(totalDistanceKm - candidate.distanceKm) <= duplicateThresholdKm;

  const aidStations = candidates
    .filter((candidate) => candidate.sourceIndex !== startCandidate?.sourceIndex)
    .filter((candidate) => candidate.sourceIndex !== finishCandidate?.sourceIndex)
    .filter((candidate) => !nearStart(candidate) && !nearFinish(candidate))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            normalizeName(other.name) === normalizeName(candidate.name) &&
            Math.abs(other.distanceKm - candidate.distanceKm) <= 0.05
        ) === index
    )
    .map((candidate) => ({
      name: candidate.name,
      distanceKm: Number(candidate.distanceKm.toFixed(1)),
      kind: "aid" as const,
      sourceIndex: candidate.sourceIndex,
    }));

  return {
    startName,
    finishName,
    aidStations,
  };
};
