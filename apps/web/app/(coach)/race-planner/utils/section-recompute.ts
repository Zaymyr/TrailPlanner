import type { ElevationPoint, SectionSegment } from "../types";
import { computeSegmentStats } from "./segmentation";

type PaceModel = {
  estimateSeconds?: (input: {
    distKm: number;
    dPlus: number;
    dMinus: number;
    elapsedBeforeSeconds?: number;
  }) => number;
  secondsPerKm?: number;
  speedKph?: number;
};

export type SectionSubSegmentStats = {
  segmentIndex: number;
  startDistanceKm: number;
  endDistanceKm: number;
  distKm: number;
  dPlus: number;
  dMinus: number;
  elapsedStartSeconds: number;
  etaSeconds: number;
};

export type SectionTotals = {
  distanceKm: number;
  dPlus: number;
  dMinus: number;
  etaSeconds: number;
};

const clampNumber = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function recomputeSectionFromSubSections({
  segments,
  startDistanceKm,
  elevationProfile,
  paceModel,
  startElapsedSeconds = 0,
}: {
  segments: SectionSegment[];
  startDistanceKm: number;
  elevationProfile: ElevationPoint[];
  paceModel?: PaceModel;
  startElapsedSeconds?: number;
}): { totals: SectionTotals; segmentStats: SectionSubSegmentStats[] } {
  let cursor = Number.isFinite(startDistanceKm) ? startDistanceKm : 0;
  const sortedElevationProfile = [...elevationProfile].sort((a, b) => a.distanceKm - b.distanceKm);
  let elapsedCursorSeconds =
    typeof startElapsedSeconds === "number" && Number.isFinite(startElapsedSeconds) ? Math.max(0, startElapsedSeconds) : 0;

  const segmentStats = segments.map((segment, index) => {
    const startDistance = cursor;
    const endDistance = startDistance + clampNumber(segment.segmentKm);
    cursor = endDistance;
    const segmentElapsedStartSeconds = elapsedCursorSeconds;

    const stats = computeSegmentStats(
      {
        ...segment,
        startDistanceKm: startDistance,
        endDistanceKm: endDistance,
      },
      sortedElevationProfile,
      paceModel,
      sortedElevationProfile,
      segmentElapsedStartSeconds
    );
    elapsedCursorSeconds += clampNumber(stats.etaSeconds);

    return {
      segmentIndex: index,
      startDistanceKm: startDistance,
      endDistanceKm: endDistance,
      distKm: clampNumber(stats.distKm),
      dPlus: clampNumber(stats.dPlus),
      dMinus: clampNumber(stats.dMinus),
      elapsedStartSeconds: clampNumber(segmentElapsedStartSeconds),
      etaSeconds: clampNumber(stats.etaSeconds),
    };
  });

  const totals = segmentStats.reduce(
    (acc, segment) => {
      acc.distanceKm += segment.distKm;
      acc.dPlus += segment.dPlus;
      acc.dMinus += segment.dMinus;
      acc.etaSeconds += segment.etaSeconds;
      return acc;
    },
    { distanceKm: 0, dPlus: 0, dMinus: 0, etaSeconds: 0 }
  );

  return {
    totals: {
      distanceKm: Number(totals.distanceKm.toFixed(3)),
      dPlus: Math.round(totals.dPlus),
      dMinus: Math.round(totals.dMinus),
      etaSeconds: Math.round(totals.etaSeconds),
    },
    segmentStats,
  };
}
