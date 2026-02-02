import type { SectionSegment } from "../types";

type ElevationSample = {
  distanceKm: number;
  elevationM: number;
};

type SegmentKind = "climb" | "flat" | "descent";

export type SegmentPreset = "grossier" | "moyen" | "fin";

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

type SegmentInterval = {
  kind: SegmentKind;
  lengthKm: number;
};

const SEGMENTATION_PRESETS: Record<SegmentPreset, SegmentConfig> = {
  grossier: {
    smoothingWindowKm: 0.6,
    slopeWindowKm: 0.6,
    slopeThresholds: {
      climb: 4,
      descent: -4,
    },
    minLengthKm: 3,
  },
  moyen: {
    smoothingWindowKm: 0.4,
    slopeWindowKm: 0.4,
    slopeThresholds: {
      climb: 3,
      descent: -3,
    },
    minLengthKm: 1.5,
  },
  fin: {
    smoothingWindowKm: 0.25,
    slopeWindowKm: 0.25,
    slopeThresholds: {
      climb: 2,
      descent: -2,
    },
    minLengthKm: 0.75,
  },
};

const byDistance = (a: ElevationSample, b: ElevationSample) => a.distanceKm - b.distanceKm;

const toKind = (slopePct: number, thresholds: SegmentConfig["slopeThresholds"]): SegmentKind => {
  if (slopePct >= thresholds.climb) return "climb";
  if (slopePct <= thresholds.descent) return "descent";
  return "flat";
};

const averageSpacingKm = (samples: ElevationSample[]) => {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const delta = samples[i].distanceKm - samples[i - 1].distanceKm;
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

  for (let i = 0; i < samples.length; i += 1) {
    prefix[i + 1] = prefix[i] + samples[i].elevationM;
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
    if (distance < targetKm) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
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
    return samples.length === 1
      ? [{ kind: "flat", lengthKm: 0 }]
      : [];
  }

  const smoothed = buildSmoothedElevations(samples, config.smoothingWindowKm);
  const slopes = buildSlopePercents(samples, smoothed, config.slopeWindowKm);

  const intervals: SegmentInterval[] = [];
  for (let i = 0; i < samples.length - 1; i += 1) {
    const segmentLength = samples[i + 1].distanceKm - samples[i].distanceKm;
    if (segmentLength <= 0) continue;
    const slope = slopes[i] ?? 0;
    const kind = toKind(slope, config.slopeThresholds);
    intervals.push({ kind, lengthKm: segmentLength });
  }

  return intervals;
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

const getElevationAtDistance = (samples: ElevationSample[], distanceKm: number) => {
  if (samples.length === 0) return 0;
  if (distanceKm <= samples[0].distanceKm) return samples[0].elevationM;
  if (distanceKm >= samples[samples.length - 1].distanceKm) {
    return samples[samples.length - 1].elevationM;
  }

  const index = findIndexAtDistance(samples, distanceKm);
  const leftIndex = Math.max(0, index - 1);
  const rightIndex = Math.min(samples.length - 1, index);
  const left = samples[leftIndex];
  const right = samples[rightIndex];
  if (right.distanceKm === left.distanceKm) return left.elevationM;
  const ratio = (distanceKm - left.distanceKm) / (right.distanceKm - left.distanceKm);
  return left.elevationM + (right.elevationM - left.elevationM) * ratio;
};

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
      if (delta >= 0) {
        acc.dPlus += delta;
      } else {
        acc.dMinus += Math.abs(delta);
      }
      return acc;
    },
    { dPlus: 0, dMinus: 0 }
  );
};

export function computeSegmentStats(
  segment: SectionSegment & { startDistanceKm?: number; endDistanceKm?: number },
  samples: ElevationSample[],
  paceModel?: PaceModel
): { distKm: number; dPlus: number; dMinus: number; etaSeconds: number } {
  if (samples.length === 0) {
    return { distKm: segment.segmentKm, dPlus: 0, dMinus: 0, etaSeconds: 0 };
  }

  const sorted = [...samples].sort(byDistance);
  const startDistance =
    typeof segment.startDistanceKm === "number" && Number.isFinite(segment.startDistanceKm)
      ? segment.startDistanceKm
      : sorted[0].distanceKm;
  const endDistance =
    typeof segment.endDistanceKm === "number" && Number.isFinite(segment.endDistanceKm)
      ? segment.endDistanceKm
      : startDistance + segment.segmentKm;
  const distKm = Math.max(0, endDistance - startDistance);
  const sectionSamples = sliceSamples(sorted, startDistance, endDistance);
  const { dPlus, dMinus } = computeElevationDelta(sectionSamples);

  const estimatedSeconds = paceModel?.estimateSeconds?.({ distKm, dPlus, dMinus });
  const baseSecondsPerKm =
    typeof paceModel?.secondsPerKm === "number" && Number.isFinite(paceModel.secondsPerKm)
      ? paceModel.secondsPerKm
      : typeof paceModel?.speedKph === "number" && paceModel.speedKph > 0
        ? 3600 / paceModel.speedKph
        : null;
  const etaSeconds =
    typeof estimatedSeconds === "number" && Number.isFinite(estimatedSeconds)
      ? estimatedSeconds
      : baseSecondsPerKm !== null
        ? distKm * baseSecondsPerKm
        : 0;

  return {
    distKm: Number(distKm.toFixed(3)),
    dPlus: Math.round(dPlus),
    dMinus: Math.round(dMinus),
    etaSeconds: Math.round(etaSeconds),
  };
}
