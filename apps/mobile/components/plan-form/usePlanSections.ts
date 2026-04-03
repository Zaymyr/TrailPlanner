import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ElevationPoint, SectionSegment, SegmentPreset } from './profile-utils';
import { autoSegmentSection, buildSectionKey, getElevationSlice, normalizeSectionSegments } from './profile-utils';
import type { PlanFormValues, PlanTarget, SectionSummary } from './contracts';
import { buildPlanSectionSummary, getBaseSpeedKph } from './section-summary';

type Args = {
  values: PlanFormValues;
  setValues: Dispatch<SetStateAction<PlanFormValues>>;
  elevationProfile: ElevationPoint[];
};

const SPLIT_PRESET_ORDER: SegmentPreset[] = ['grossier', 'moyen', 'fin'];

export function usePlanSections({ values, setValues, elevationProfile }: Args) {
  const aidStationsSummaryKey = useMemo(
    () =>
      values.aidStations
        .map((station) => `${station.id ?? ''}|${station.distanceKm}|${station.pauseMinutes ?? 0}|${station.name}`)
        .join(';'),
    [values.aidStations],
  );

  const baseSpeedKph = useMemo(
    () => getBaseSpeedKph(values),
    [values.paceMinutes, values.paceSeconds, values.paceType, values.speedKph],
  );

  const buildSectionSummary = useCallback(
    (target: PlanTarget): SectionSummary | null =>
      buildPlanSectionSummary({
        values,
        elevationProfile,
        baseSpeedKph,
        target,
      }),
    [
      baseSpeedKph,
      elevationProfile,
      aidStationsSummaryKey,
      values.sectionSegments,
      values.sodiumIntakePerHour,
      values.targetIntakePerHour,
      values.waterIntakePerHour,
    ],
  );

  const getSplitReplacementSegmentsFromSummary = useCallback(
    (summary: SectionSummary, segmentIndex: number) => {
      const segment = summary.segments[segmentIndex];
      const segmentStat = summary.segmentStats[segmentIndex];
      if (!segment || !segmentStat || segment.segmentKm <= 0.02) return null;

      const segmentProfile = getElevationSlice(elevationProfile, segmentStat.startDistanceKm, segmentStat.endDistanceKm);
      if (segmentProfile.length <= 1) return null;

      for (const preset of SPLIT_PRESET_ORDER) {
        const replacementSegments = autoSegmentSection(segmentProfile, preset);
        if (replacementSegments.length <= 1) continue;

        return replacementSegments.map((replacementSegment) => ({
          ...replacementSegment,
          ...(typeof segment.paceAdjustmentMinutesPerKm === 'number'
            ? { paceAdjustmentMinutesPerKm: segment.paceAdjustmentMinutesPerKm }
            : {}),
        }));
      }

      return null;
    },
    [elevationProfile],
  );

  const getSplitReplacementSegments = useCallback(
    (target: PlanTarget, segmentIndex: number) => {
      const summary = buildSectionSummary(target);
      if (!summary) return null;
      return getSplitReplacementSegmentsFromSummary(summary, segmentIndex);
    },
    [buildSectionSummary, getSplitReplacementSegmentsFromSummary],
  );

  const canSplitSectionSegment = useCallback(
    (target: PlanTarget, segmentIndex: number) => Boolean(getSplitReplacementSegments(target, segmentIndex)?.length),
    [getSplitReplacementSegments],
  );

  const canRemoveSectionSegment = useCallback(
    (target: PlanTarget, segmentIndex: number) => {
      const summary = buildSectionSummary(target);
      return Boolean(summary && segmentIndex > 0 && summary.segments.length > 1);
    },
    [buildSectionSummary],
  );

  const getSectionSegmentControls = useCallback(
    (target: PlanTarget) => {
      const summary = buildSectionSummary(target);
      if (!summary) return [];

      return summary.segments.map((_, segmentIndex) => ({
        canSplit: Boolean(getSplitReplacementSegmentsFromSummary(summary, segmentIndex)?.length),
        canRemove: segmentIndex > 0 && summary.segments.length > 1,
      }));
    },
    [buildSectionSummary, getSplitReplacementSegmentsFromSummary],
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

      const propagatedSegments = getSplitReplacementSegments(target, segmentIndex);
      if (!propagatedSegments || propagatedSegments.length <= 1) return;

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
    [buildSectionSummary, getSplitReplacementSegments, setValues],
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
    canSplitSectionSegment,
    canRemoveSectionSegment,
    getSectionSegmentControls,
    updateSectionSegmentPaceAdjustment,
    splitSectionSegment,
    removeSectionSegment,
  };
}
