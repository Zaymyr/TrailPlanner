import {
  estimateEffortDurationSeconds,
  getElevationSlice,
  getSectionSegments,
  recomputeSectionFromSubSections,
} from './profile-utils';
import type { ElevationPoint } from './profile-utils';
import type { PlanFormValues, PlanTarget, SectionSummary } from './contracts';

export function getBaseSpeedKph(values: Pick<PlanFormValues, 'paceType' | 'paceMinutes' | 'paceSeconds' | 'speedKph'>) {
  return values.paceType === 'pace'
    ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
    : Math.max(values.speedKph, 0.1);
}

type BuildArgs = {
  values: PlanFormValues;
  elevationProfile: ElevationPoint[];
  baseSpeedKph: number;
  target: PlanTarget;
};

export function buildPlanSectionSummary({
  values,
  elevationProfile,
  baseSpeedKph,
  target,
}: BuildArgs): SectionSummary | null {
  const sectionIndex = target === 'start' ? 0 : target;
  const fromStation = values.aidStations[sectionIndex];
  const toStation = values.aidStations[sectionIndex + 1];

  if (!fromStation || !toStation) return null;

  const startKm = fromStation.distanceKm;
  const endKm = toStation.distanceKm;
  const distanceKm = Math.max(0, endKm - startKm);
  const pauseMinutes = Math.max(0, fromStation.pauseMinutes ?? 0);
  const storedSegments = values.sectionSegments?.[`section-${sectionIndex}`];
  const hasStoredSegments = Boolean(storedSegments?.length);
  const segments = getSectionSegments(values.sectionSegments, sectionIndex, distanceKm);
  const profilePoints =
    elevationProfile.length > 0
      ? getElevationSlice(elevationProfile, startKm, endKm)
      : [
          { distanceKm: startKm, elevationM: 0 },
          { distanceKm: endKm, elevationM: 0 },
        ];
  const recomputed = recomputeSectionFromSubSections({
    segments,
    startDistanceKm: startKm,
    elevationProfile: profilePoints,
    paceModel: {
      secondsPerKm: 3600 / baseSpeedKph,
      estimateSeconds: ({ distKm, dPlus, dMinus }) =>
        estimateEffortDurationSeconds(3600 / baseSpeedKph, { distKm, dPlus, dMinus }),
    },
  });
  const durationMin = recomputed.totals.etaSeconds / 60 + pauseMinutes;

  return {
    sectionIndex,
    startKm,
    endKm,
    distanceKm,
    durationMin,
    targetCarbsG: values.targetIntakePerHour * (durationMin / 60),
    targetSodiumMg: values.sodiumIntakePerHour * (durationMin / 60),
    targetWaterMl: values.waterIntakePerHour * (durationMin / 60),
    profilePoints,
    segments,
    segmentStats: recomputed.segmentStats,
    hasStoredSegments,
  };
}
