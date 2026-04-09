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

function buildFallbackSectionProfile(
  startKm: number,
  endKm: number,
  raceDistanceKm: number,
  raceElevationGainM: number,
): ElevationPoint[] {
  const safeStartKm = Number.isFinite(startKm) ? startKm : 0;
  const safeEndKm = Number.isFinite(endKm) ? endKm : safeStartKm;
  const sectionDistanceKm = Math.max(0, safeEndKm - safeStartKm);
  const safeRaceDistanceKm = Math.max(raceDistanceKm, safeEndKm, 0.01);
  const safeRaceElevationGainM = Number.isFinite(raceElevationGainM) ? Math.max(0, raceElevationGainM) : 0;
  const sectionElevationGainM =
    safeRaceDistanceKm > 0 ? (safeRaceElevationGainM * sectionDistanceKm) / safeRaceDistanceKm : 0;

  if (sectionDistanceKm <= 0 || sectionElevationGainM <= 0) {
    return [
      { distanceKm: safeStartKm, elevationM: 0 },
      { distanceKm: safeEndKm, elevationM: 0 },
    ];
  }

  const midKm = Number((safeStartKm + sectionDistanceKm / 2).toFixed(3));
  const endElevationM = Number(sectionElevationGainM.toFixed(1));

  return [
    { distanceKm: safeStartKm, elevationM: 0 },
    { distanceKm: midKm, elevationM: Number((sectionElevationGainM * 0.45).toFixed(1)) },
    { distanceKm: safeEndKm, elevationM: endElevationM },
  ];
}

export function buildPlanSectionSummary({
  values,
  elevationProfile,
  baseSpeedKph,
  target,
}: BuildArgs): SectionSummary | null {
  const sectionIndex = target === 'start' ? 0 : target;
  if (sectionIndex < 0 || sectionIndex >= values.aidStations.length - 1) return null;

  let elapsedCursorSeconds = 0;

  for (let currentSectionIndex = 0; currentSectionIndex < values.aidStations.length - 1; currentSectionIndex += 1) {
    const fromStation = values.aidStations[currentSectionIndex];
    const toStation = values.aidStations[currentSectionIndex + 1];
    if (!fromStation || !toStation) return null;

    const startKm = fromStation.distanceKm;
    const endKm = toStation.distanceKm;
    const distanceKm = Math.max(0, endKm - startKm);
    const pauseMinutes = Math.max(0, fromStation.pauseMinutes ?? 0);
    const storedSegments = values.sectionSegments?.[`section-${currentSectionIndex}`];
    const hasStoredSegments = Boolean(storedSegments?.length);
    const profilePoints =
      elevationProfile.length > 1
        ? getElevationSlice(elevationProfile, startKm, endKm)
        : buildFallbackSectionProfile(startKm, endKm, values.raceDistanceKm, values.elevationGain);
    const segments = getSectionSegments(values.sectionSegments, currentSectionIndex, distanceKm);
    const recomputed = recomputeSectionFromSubSections({
      segments,
      startDistanceKm: startKm,
      startElapsedSeconds: elapsedCursorSeconds,
      elevationProfile: profilePoints,
      paceModel: {
        secondsPerKm: 3600 / baseSpeedKph,
        estimateSeconds: ({ distKm, dPlus, dMinus, elapsedBeforeSeconds }) =>
          estimateEffortDurationSeconds(3600 / baseSpeedKph, {
            distKm,
            dPlus,
            dMinus,
            elapsedBeforeSeconds,
            fatigueLevel: values.fatigueLevel,
          }),
      },
    });
    const durationMin = recomputed.totals.etaSeconds / 60 + pauseMinutes;

    if (currentSectionIndex === sectionIndex) {
      return {
        sectionIndex: currentSectionIndex,
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

    elapsedCursorSeconds += recomputed.totals.etaSeconds + pauseMinutes * 60;
  }

  return null;
}
