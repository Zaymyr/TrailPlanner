export type ElevationPoint = {
  distanceKm: number;
  elevationM: number;
};

export type SectionSegment = {
  segmentKm: number;
  label?: string;
  paceAdjustmentMinutesPerKm?: number;
  segmentMinutesOverride?: number;
};

export type SectionSubSegmentStats = {
  segmentIndex: number;
  startDistanceKm: number;
  endDistanceKm: number;
  distKm: number;
  dPlus: number;
  dMinus: number;
  etaSeconds: number;
};

export type SectionTotals = {
  distanceKm: number;
  dPlus: number;
  dMinus: number;
  etaSeconds: number;
};

type ElevationSample = {
  distanceKm: number;
  elevationM: number;
};

type SegmentKind = 'climb' | 'flat' | 'descent';

export type SegmentPreset = 'grossier' | 'moyen' | 'fin';

type SegmentConfig = {
  smoothingWindowKm: number;
  slopeWindowKm: number;
  slopeThresholds: {
    climb: number;
    descent: number;
  };
  minLengthKm: number;
};

type PaceModel = {
  estimateSeconds?: (input: { distKm: number; dPlus: number; dMinus: number }) => number;
  secondsPerKm?: number;
  speedKph?: number;
};

const CLIMB_EQUIVALENT_METERS_PER_FLAT_KM = 100;

type SegmentInterval = {
  kind: SegmentKind;
  lengthKm: number;
};

const SEGMENTATION_PRESETS: Record<SegmentPreset, SegmentConfig> = {
  grossier: {
    smoothingWindowKm: 0.6,
    slopeWindowKm: 0.6,
    slopeThresholds: { climb: 4, descent: -4 },
    minLengthKm: 3,
  },
  moyen: {
    smoothingWindowKm: 0.4,
    slopeWindowKm: 0.4,
    slopeThresholds: { climb: 3, descent: -3 },
    minLengthKm: 1.5,
  },
  fin: {
    smoothingWindowKm: 0.25,
    slopeWindowKm: 0.25,
    slopeThresholds: { climb: 2, descent: -2 },
    minLengthKm: 0.75,
  },
};

const byDistance = (a: ElevationSample, b: ElevationSample) => a.distanceKm - b.distanceKm;

const toKind = (slopePct: number, thresholds: SegmentConfig['slopeThresholds']): SegmentKind => {
  if (slopePct >= thresholds.climb) return 'climb';
  if (slopePct <= thresholds.descent) return 'descent';
  return 'flat';
};

const clampNumber = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

const averageSpacingKm = (samples: ElevationSample[]) => {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].distanceKm - samples[index - 1].distanceKm;
    if (delta > 0) total += delta;
  }
  return total > 0 ? total / (samples.length - 1) : 0;
};

const buildSmoothedElevations = (samples: ElevationSample[], windowKm: number): number[] => {
  if (samples.length === 0) return [];
  if (samples.length === 1) return [samples[0].elevationM];

  const spacing = averageSpacingKm(samples);
  const rawWindowSamples = spacing > 0 ? Math.round(windowKm / spacing) : 1;
  const windowSamples = Math.max(1, rawWindowSamples);
  const halfWindow = Math.floor(windowSamples / 2);
  const prefix: number[] = new Array(samples.length + 1).fill(0);

  for (let index = 0; index < samples.length; index += 1) {
    prefix[index + 1] = prefix[index] + samples[index].elevationM;
  }

  return samples.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(samples.length - 1, index + halfWindow);
    const count = end - start + 1;
    const sum = prefix[end + 1] - prefix[start];
    return sum / count;
  });
};

const findIndexAtDistance = (samples: ElevationSample[], targetKm: number) => {
  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const distance = samples[mid].distanceKm;
    if (distance === targetKm) return mid;
    if (distance < targetKm) low = mid + 1;
    else high = mid - 1;
  }

  return Math.max(0, Math.min(samples.length - 1, low));
};

const buildSlopePercents = (samples: ElevationSample[], smoothed: number[], windowKm: number): number[] => {
  if (samples.length === 0) return [];
  if (samples.length === 1) return [0];

  return samples.map((sample, index) => {
    const leftDistance = sample.distanceKm - windowKm;
    const rightDistance = sample.distanceKm + windowKm;
    const leftIndex = findIndexAtDistance(samples, leftDistance);
    const rightIndex = findIndexAtDistance(samples, rightDistance);
    const left = samples[leftIndex];
    const right = samples[rightIndex];
    const leftElevation = smoothed[leftIndex] ?? sample.elevationM;
    const rightElevation = smoothed[rightIndex] ?? sample.elevationM;
    const distanceDeltaKm = right.distanceKm - left.distanceKm;
    if (distanceDeltaKm <= 0) return 0;
    const elevationDelta = rightElevation - leftElevation;
    return (elevationDelta / (distanceDeltaKm * 1000)) * 100;
  });
};

const mergeSameKind = (intervals: SegmentInterval[]): SegmentInterval[] => {
  if (intervals.length === 0) return [];
  return intervals.reduce<SegmentInterval[]>((acc, interval) => {
    const last = acc.at(-1);
    if (last && last.kind === interval.kind) {
      last.lengthKm += interval.lengthKm;
      return acc;
    }
    acc.push({ ...interval });
    return acc;
  }, []);
};

const mergeShortSegments = (intervals: SegmentInterval[], minLengthKm: number): SegmentInterval[] => {
  if (intervals.length <= 1) return intervals;
  const merged = [...intervals];
  let index = 0;

  while (index < merged.length) {
    const current = merged[index];
    if (current.lengthKm >= minLengthKm) {
      index += 1;
      continue;
    }

    const prev = merged[index - 1];
    const next = merged[index + 1];

    if (!prev && !next) {
      index += 1;
      continue;
    }

    if (!prev && next) {
      next.lengthKm += current.lengthKm;
      merged.splice(index, 1);
      continue;
    }

    if (prev && !next) {
      prev.lengthKm += current.lengthKm;
      merged.splice(index, 1);
      index -= 1;
      continue;
    }

    if (prev && next) {
      const target = prev.lengthKm >= next.lengthKm ? prev : next;
      target.lengthKm += current.lengthKm;
      merged.splice(index, 1);
      index = Math.max(0, index - 1);
    }
  }

  return mergeSameKind(merged);
};

const normalizeSamples = (samples: ElevationSample[]): ElevationSample[] => {
  if (samples.length === 0) return [];
  const sorted = [...samples].filter(Boolean).sort(byDistance);
  const baseDistance = sorted[0]?.distanceKm ?? 0;
  return sorted.map((sample) => ({
    distanceKm: sample.distanceKm - baseDistance,
    elevationM: sample.elevationM,
  }));
};

const buildIntervals = (samples: ElevationSample[], config: SegmentConfig): SegmentInterval[] => {
  if (samples.length < 2) {
    return samples.length === 1 ? [{ kind: 'flat', lengthKm: 0 }] : [];
  }

  const smoothed = buildSmoothedElevations(samples, config.smoothingWindowKm);
  const slopes = buildSlopePercents(samples, smoothed, config.slopeWindowKm);
  const intervals: SegmentInterval[] = [];

  for (let index = 0; index < samples.length - 1; index += 1) {
    const segmentLength = samples[index + 1].distanceKm - samples[index].distanceKm;
    if (segmentLength <= 0) continue;
    const slope = slopes[index] ?? 0;
    const kind = toKind(slope, config.slopeThresholds);
    intervals.push({ kind, lengthKm: segmentLength });
  }

  return intervals;
};

export const buildSectionKey = (sectionIndex: number) => `section-${sectionIndex}`;

export function normalizeSectionSegments(segmentsToNormalize: SectionSegment[], totalKm: number) {
  if (!segmentsToNormalize.length) return [];

  const sanitized = segmentsToNormalize
    .map((segment) => ({
      ...segment,
      segmentKm: Math.max(0, Number(segment.segmentKm.toFixed(3))),
    }))
    .filter((segment) => segment.segmentKm > 0);

  if (sanitized.length === 0) return [];
  if (!Number.isFinite(totalKm) || totalKm <= 0) return sanitized;

  const currentTotal = sanitized.reduce((sum, segment) => sum + segment.segmentKm, 0);
  const delta = Number((totalKm - currentTotal).toFixed(3));
  if (Math.abs(delta) < 0.01) return sanitized;

  const lastIndex = sanitized.length - 1;
  const lastSegment = sanitized[lastIndex];
  const adjustedKm = Math.max(0.01, Number((lastSegment.segmentKm + delta).toFixed(3)));
  sanitized[lastIndex] = { ...lastSegment, segmentKm: adjustedKm };
  return sanitized;
}

export function getSectionSegments(
  sectionSegments: Record<string, SectionSegment[]> | undefined,
  sectionIndex: number,
  totalSectionKm: number,
) {
  const storedSegments = sectionSegments?.[buildSectionKey(sectionIndex)];
  if (storedSegments && storedSegments.length > 0) {
    return normalizeSectionSegments(storedSegments, totalSectionKm);
  }
  return [{ segmentKm: totalSectionKm }];
}

const getElevationAtDistance = (samples: ElevationSample[], distanceKm: number) => {
  if (samples.length === 0) return 0;
  if (distanceKm <= samples[0].distanceKm) return samples[0].elevationM;
  const last = samples[samples.length - 1];
  if (distanceKm >= last.distanceKm) return last.elevationM;

  const nextIndex = samples.findIndex((point) => point.distanceKm >= distanceKm);
  if (nextIndex <= 0) return samples[0].elevationM;

  const prevPoint = samples[nextIndex - 1];
  const nextPoint = samples[nextIndex] ?? prevPoint;
  const ratio =
    nextPoint.distanceKm === prevPoint.distanceKm
      ? 0
      : (distanceKm - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);

  return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
};

export const getElevationSlice = (
  profile: ElevationPoint[],
  startDistanceKm: number,
  endDistanceKm: number,
): ElevationPoint[] => {
  if (profile.length === 0) return [];

  const sorted = [...profile].sort(byDistance);
  const sliceStart = Math.min(startDistanceKm, endDistanceKm);
  const sliceEnd = Math.max(startDistanceKm, endDistanceKm);
  const points = [
    { distanceKm: sliceStart, elevationM: getElevationAtDistance(sorted, sliceStart) },
    ...sorted.filter((point) => point.distanceKm > sliceStart && point.distanceKm < sliceEnd),
    { distanceKm: sliceEnd, elevationM: getElevationAtDistance(sorted, sliceEnd) },
  ];
  return points.sort(byDistance);
};

export function autoSegmentSection(samples: ElevationSample[], preset: SegmentPreset): SectionSegment[] {
  const config = SEGMENTATION_PRESETS[preset];
  if (!config || samples.length === 0) return [];

  const normalizedSamples = normalizeSamples(samples);
  const intervals = buildIntervals(normalizedSamples, config);
  const merged = mergeSameKind(intervals);
  const filtered = mergeShortSegments(merged, config.minLengthKm);

  return filtered.map((segment) => ({
    segmentKm: Number(segment.lengthKm.toFixed(3)),
    label: segment.kind,
  }));
}

const sliceSamples = (samples: ElevationSample[], startKm: number, endKm: number) => {
  const sorted = [...samples].sort(byDistance);
  const points = [
    { distanceKm: startKm, elevationM: getElevationAtDistance(sorted, startKm) },
    ...sorted.filter((sample) => sample.distanceKm > startKm && sample.distanceKm < endKm),
    { distanceKm: endKm, elevationM: getElevationAtDistance(sorted, endKm) },
  ];
  return points.sort(byDistance);
};

const computeElevationDelta = (samples: ElevationSample[]): { dPlus: number; dMinus: number } => {
  if (samples.length < 2) return { dPlus: 0, dMinus: 0 };
  return samples.slice(1).reduce(
    (acc, sample, index) => {
      const prev = samples[index];
      const delta = sample.elevationM - prev.elevationM;
      if (delta >= 0) acc.dPlus += delta;
      else acc.dMinus += Math.abs(delta);
      return acc;
    },
    { dPlus: 0, dMinus: 0 },
  );
};

export function equivalentFlatDistanceKm(distKm: number, dPlus: number) {
  const safeDistanceKm = Number.isFinite(distKm) ? Math.max(0, distKm) : 0;
  const safeDPlus = Number.isFinite(dPlus) ? Math.max(0, dPlus) : 0;
  return safeDistanceKm + safeDPlus / CLIMB_EQUIVALENT_METERS_PER_FLAT_KM;
}

export function estimateEffortDurationSeconds(
  baseSecondsPerKm: number,
  input: { distKm: number; dPlus: number; dMinus: number },
) {
  if (!Number.isFinite(baseSecondsPerKm) || baseSecondsPerKm <= 0) return 0;
  return equivalentFlatDistanceKm(input.distKm, input.dPlus) * baseSecondsPerKm;
}

export function adjustedPaceMinutesPerKm(
  baseMinutesPerKm: number,
  input: { distKm: number; dPlus: number },
) {
  const safeDistanceKm = Number.isFinite(input.distKm) ? Math.max(0, input.distKm) : 0;
  if (!Number.isFinite(baseMinutesPerKm) || baseMinutesPerKm <= 0) return null;
  if (safeDistanceKm <= 0) return baseMinutesPerKm;

  return (equivalentFlatDistanceKm(safeDistanceKm, input.dPlus) * baseMinutesPerKm) / safeDistanceKm;
}

export function computeSegmentStats(
  segment: SectionSegment & { startDistanceKm?: number; endDistanceKm?: number },
  samples: ElevationSample[],
  paceModel?: PaceModel,
): { distKm: number; dPlus: number; dMinus: number; etaSeconds: number } {
  if (samples.length === 0) {
    const overrideSeconds =
      typeof segment.segmentMinutesOverride === 'number' && Number.isFinite(segment.segmentMinutesOverride)
        ? Math.max(0, segment.segmentMinutesOverride * 60)
        : 0;
    return { distKm: segment.segmentKm, dPlus: 0, dMinus: 0, etaSeconds: overrideSeconds };
  }

  const sorted = [...samples].sort(byDistance);
  const startDistance =
    typeof segment.startDistanceKm === 'number' && Number.isFinite(segment.startDistanceKm)
      ? segment.startDistanceKm
      : sorted[0].distanceKm;
  const endDistance =
    typeof segment.endDistanceKm === 'number' && Number.isFinite(segment.endDistanceKm)
      ? segment.endDistanceKm
      : startDistance + segment.segmentKm;
  const distKm = Math.max(0, endDistance - startDistance);
  const sectionSamples = sliceSamples(sorted, startDistance, endDistance);
  const { dPlus, dMinus } = computeElevationDelta(sectionSamples);

  const paceAdjustmentMinutesPerKm =
    typeof segment.paceAdjustmentMinutesPerKm === 'number' && Number.isFinite(segment.paceAdjustmentMinutesPerKm)
      ? segment.paceAdjustmentMinutesPerKm
      : 0;
  const paceAdjustmentSecondsPerKm = paceAdjustmentMinutesPerKm * 60;
  const estimatedSeconds = paceModel?.estimateSeconds?.({ distKm, dPlus, dMinus });
  const baseSecondsPerKm =
    typeof paceModel?.secondsPerKm === 'number' && Number.isFinite(paceModel.secondsPerKm)
      ? paceModel.secondsPerKm
      : typeof paceModel?.speedKph === 'number' && paceModel.speedKph > 0
        ? 3600 / paceModel.speedKph
        : null;
  const adjustedSecondsPerKm =
    baseSecondsPerKm !== null ? Math.max(0, baseSecondsPerKm + paceAdjustmentSecondsPerKm) : null;

  const overrideSeconds =
    typeof segment.segmentMinutesOverride === 'number' && Number.isFinite(segment.segmentMinutesOverride)
      ? Math.max(0, segment.segmentMinutesOverride * 60)
      : null;

  const etaSeconds =
    overrideSeconds !== null
      ? overrideSeconds
      : typeof estimatedSeconds === 'number' && Number.isFinite(estimatedSeconds)
        ? Math.max(0, estimatedSeconds + distKm * paceAdjustmentSecondsPerKm)
        : adjustedSecondsPerKm !== null
          ? Math.max(0, distKm * adjustedSecondsPerKm)
          : 0;

  return {
    distKm: Number(distKm.toFixed(3)),
    dPlus: Math.round(dPlus),
    dMinus: Math.round(dMinus),
    etaSeconds: Math.round(etaSeconds),
  };
}

export function recomputeSectionFromSubSections({
  segments,
  startDistanceKm,
  elevationProfile,
  paceModel,
}: {
  segments: SectionSegment[];
  startDistanceKm: number;
  elevationProfile: ElevationPoint[];
  paceModel?: PaceModel;
}): { totals: SectionTotals; segmentStats: SectionSubSegmentStats[] } {
  let cursor = Number.isFinite(startDistanceKm) ? startDistanceKm : 0;

  const segmentStats = segments.map((segment, index) => {
    const startDistance = cursor;
    const endDistance = startDistance + clampNumber(segment.segmentKm);
    cursor = endDistance;

    const stats = computeSegmentStats(
      {
        ...segment,
        startDistanceKm: startDistance,
        endDistanceKm: endDistance,
      },
      elevationProfile,
      paceModel,
    );

    return {
      segmentIndex: index,
      startDistanceKm: startDistance,
      endDistanceKm: endDistance,
      distKm: clampNumber(stats.distKm),
      dPlus: clampNumber(stats.dPlus),
      dMinus: clampNumber(stats.dMinus),
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
    { distanceKm: 0, dPlus: 0, dMinus: 0, etaSeconds: 0 },
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
