import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ElevationPoint, SectionSegment } from './profile-utils';
import { autoSegmentSection, buildSectionKey, getElevationSlice, getSectionSegments, normalizeSectionSegments, recomputeSectionFromSubSections } from './profile-utils';
import type { PlanFormValues, PlanTarget, SectionSummary } from './contracts';

type Args = {
  values: PlanFormValues;
  setValues: Dispatch<SetStateAction<PlanFormValues>>;
  elevationProfile: ElevationPoint[];
};

export function usePlanSections({ values, setValues, elevationProfile }: Args) {
  const baseSpeedKph = useMemo(
    () =>
      values.paceType === 'pace'
        ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
        : Math.max(values.speedKph, 0.1),
    [values.paceMinutes, values.paceSeconds, values.paceType, values.speedKph],
  );

  const buildSectionSummary = useCallback(
    (target: PlanTarget): SectionSummary | null => {
      const sectionIndex = target === 'start' ? 0 : target;
      const fromStation = values.aidStations[sectionIndex];
      const toStation = values.aidStations[sectionIndex + 1];

      if (!fromStation || !toStation) return null;

      const startKm = fromStation.distanceKm;
      const endKm = toStation.distanceKm;
      const distanceKm = Math.max(0, endKm - startKm);
      const hasStoredSegments = Boolean(values.sectionSegments?.[buildSectionKey(sectionIndex)]?.length);
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
        paceModel: { secondsPerKm: 3600 / baseSpeedKph },
      });
      const durationMin = recomputed.totals.etaSeconds / 60;

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
    },
    [
      baseSpeedKph,
      elevationProfile,
      values.aidStations,
      values.sectionSegments,
      values.sodiumIntakePerHour,
      values.targetIntakePerHour,
      values.waterIntakePerHour,
    ],
  );

  const updateSectionSegmentPaceAdjustment = useCallback(
    (target: PlanTarget, segmentIndex: number, paceAdjustmentMinutesPerKm: number | undefined) => {
      const summary = buildSectionSummary(target);
      if (!summary) return;

      const sectionKey = buildSectionKey(summary.sectionIndex);
      const nextSegments = summary.segments.map((segment, index) =>
        index === segmentIndex
          ? {
              ...segment,
              ...(paceAdjustmentMinutesPerKm === undefined
                ? { paceAdjustmentMinutesPerKm: undefined }
                : { paceAdjustmentMinutesPerKm }),
            }
          : segment,
      );

      setValues((prev) => ({
        ...prev,
        sectionSegments: {
          ...(prev.sectionSegments ?? {}),
          [sectionKey]: nextSegments,
        },
      }));
    },
    [buildSectionSummary, setValues],
  );

  const splitSectionSegment = useCallback(
    (target: PlanTarget, segmentIndex: number) => {
      const summary = buildSectionSummary(target);
      if (!summary) return;

      const segment = summary.segments[segmentIndex];
      const segmentStat = summary.segmentStats[segmentIndex];
      if (!segment || !segmentStat || segment.segmentKm <= 0.02) return;

      const segmentProfile = getElevationSlice(elevationProfile, segmentStat.startDistanceKm, segmentStat.endDistanceKm);
      let replacementSegments = segmentProfile.length > 1 ? autoSegmentSection(segmentProfile, 'moyen') : [];

      if (replacementSegments.length <= 1) {
        const firstKm = Number((segment.segmentKm / 2).toFixed(3));
        const secondKm = Number((segment.segmentKm - firstKm).toFixed(3));
        if (firstKm > 0.01 && secondKm > 0.01) {
          replacementSegments = [{ segmentKm: firstKm }, { segmentKm: secondKm }];
        }
      }

      if (replacementSegments.length <= 1) return;

      const propagatedSegments = replacementSegments.map((replacementSegment) => ({
        ...replacementSegment,
        ...(typeof segment.paceAdjustmentMinutesPerKm === 'number'
          ? { paceAdjustmentMinutesPerKm: segment.paceAdjustmentMinutesPerKm }
          : {}),
      }));
      const sectionKey = buildSectionKey(summary.sectionIndex);
      const nextSegments = normalizeSectionSegments(
        [
          ...summary.segments.slice(0, segmentIndex),
          ...propagatedSegments,
          ...summary.segments.slice(segmentIndex + 1),
        ],
        summary.distanceKm,
      );

      setValues((prev) => ({
        ...prev,
        sectionSegments: {
          ...(prev.sectionSegments ?? {}),
          [sectionKey]: nextSegments,
        },
      }));
    },
    [buildSectionSummary, elevationProfile, setValues],
  );

  const removeSectionSegment = useCallback(
    (target: PlanTarget, segmentIndex: number) => {
      const summary = buildSectionSummary(target);
      if (!summary || segmentIndex <= 0 || summary.segments.length <= 1) return;

      const previousSegment = summary.segments[segmentIndex - 1];
      const currentSegment = summary.segments[segmentIndex];
      if (!previousSegment || !currentSegment) return;

      const mergedSegment: SectionSegment = {
        ...previousSegment,
        segmentKm: Number((previousSegment.segmentKm + currentSegment.segmentKm).toFixed(3)),
      };
      const sectionKey = buildSectionKey(summary.sectionIndex);
      const nextSegments = normalizeSectionSegments(
        [
          ...summary.segments.slice(0, segmentIndex - 1),
          mergedSegment,
          ...summary.segments.slice(segmentIndex + 1),
        ],
        summary.distanceKm,
      );

      setValues((prev) => ({
        ...prev,
        sectionSegments: {
          ...(prev.sectionSegments ?? {}),
          [sectionKey]: nextSegments,
        },
      }));
    },
    [buildSectionSummary, setValues],
  );

  return {
    baseSpeedKph,
    buildSectionSummary,
    updateSectionSegmentPaceAdjustment,
    splitSectionSegment,
    removeSectionSegment,
  };
}
