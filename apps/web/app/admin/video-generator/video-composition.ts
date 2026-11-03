import { z } from "zod";

import type { VideoAidStation } from "../../../lib/video-generator";
import {
  easeInOut,
  getChaseCameraPose,
  getOverviewCameraPose,
  interpolateCameraPose,
  type AnimationViewport,
  type CameraPose,
  type PreparedAnimationPath,
} from "./route-animation";

export const VIDEO_DURATION_PRESETS = [30, 45, 60, 90] as const;
export const VIDEO_FPS = 30;
export const INTRO_DURATION_MS = 3_000;
export const OUTRO_DURATION_MS = 3_000;
export const AID_LABEL_DURATION_MS = 2_500;
export const AID_LABEL_MIN_DURATION_MS = 1_200;

export const VIDEO_RESOLUTIONS = {
  "540p": { width: 540, height: 960 },
  "1080p": { width: 1080, height: 1920 },
} as const;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Serializable on purpose: the same object must reproduce the same render later (export jobs).
export const videoCompositionSettingsSchema = z.object({
  version: z.literal(1).default(1),
  durationSeconds: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).default(45),
  resolution: z.enum(["540p", "1080p"]).default("540p"),
  viewport: z.enum(["portrait", "landscape"]).default("portrait"),
  revealMode: z.enum(["progressive", "full"]).default("progressive"),
  mapStyle: z.enum(["classic", "standard"]).default("classic"),
  showTitle: z.boolean().default(true),
  showDistance: z.boolean().default(true),
  showElevation: z.boolean().default(true),
  showAidStations: z.boolean().default(true),
  showProfile: z.boolean().default(true),
  showCurrentKm: z.boolean().default(true),
  routeColor: hexColorSchema.default("#d9ff57"),
  accentColor: hexColorSchema.default("#ff8a3d"),
  showLogo: z.boolean().default(true),
  showCta: z.boolean().default(true),
  introEnabled: z.boolean().default(true),
  outroEnabled: z.boolean().default(true),
  disabledAidStationIds: z.array(z.string()).default([]),
});

export type VideoCompositionSettings = z.infer<typeof videoCompositionSettingsSchema>;
export type VideoPhase = "intro" | "flyover" | "outro";

export const DEFAULT_VIDEO_COMPOSITION_SETTINGS: VideoCompositionSettings = videoCompositionSettingsSchema.parse({});

export type ScheduledAidLabel = {
  id: string;
  name: string;
  distanceKm: number;
  startMs: number;
  endMs: number;
};

export type VideoTimeline = {
  totalMs: number;
  introMs: number;
  flyoverMs: number;
  outroMs: number;
  totalDistanceKm: number;
  averageSpeedMps: number;
  sampleDistancesKm: number[];
  cumulativeTimeFraction: number[];
  aidStations: Array<VideoAidStation & { arrivalMs: number }>;
  aidLabels: ScheduledAidLabel[];
};

export type VideoFrameState = {
  timeMs: number;
  phase: VideoPhase;
  phaseProgress: number;
  distanceKm: number;
  routeProgress: number;
  aidLabel: ScheduledAidLabel | null;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const findUpperIndex = (values: number[], value: number) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
};

const interpolateTable = (inputs: number[], outputs: number[], value: number) => {
  if (inputs.length === 0) return 0;
  if (value <= inputs[0]) return outputs[0];
  const last = inputs.length - 1;
  if (value >= inputs[last]) return outputs[last];
  const upper = findUpperIndex(inputs, value);
  const lower = Math.max(0, upper - 1);
  const span = inputs[upper] - inputs[lower];
  const ratio = span > 0 ? (value - inputs[lower]) / span : 1;
  return outputs[lower] + (outputs[upper] - outputs[lower]) * ratio;
};

const movingAverage = (values: number[], radius: number) => {
  if (radius <= 0 || values.length === 0) return values;
  const prefix = [0];
  values.forEach((value) => prefix.push(prefix[prefix.length - 1] + value));
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    return (prefix[end + 1] - prefix[start]) / (end - start + 1);
  });
};

/**
 * Relative time spent per kilometre. Climbs, steep descents and enabled aid stations slow the
 * flyover down; the weights are smoothed so the speed never changes abruptly on screen.
 */
export const computePacingWeights = (
  path: PreparedAnimationPath,
  aidStationDistancesKm: number[],
) => {
  const { samples, totalDistanceKm } = path;
  if (samples.length < 2 || totalDistanceKm <= 0) return samples.map(() => 1);
  const spacingKm = totalDistanceKm / (samples.length - 1);
  const gradeRadius = Math.max(1, Math.round(0.15 / spacingKm));
  const aidSigmaKm = Math.max(0.25, totalDistanceKm * 0.005);

  const weights = samples.map((sample, index) => {
    const before = samples[Math.max(0, index - gradeRadius)];
    const after = samples[Math.min(samples.length - 1, index + gradeRadius)];
    const runM = (after.distanceKm - before.distanceKm) * 1_000;
    const grade = runM > 0 ? (after.elevationM - before.elevationM) / runM : 0;
    const climb = 1.4 * clamp(grade / 0.15, 0, 1);
    const descent = 0.5 * clamp(-grade / 0.2, 0, 1);
    const aid = aidStationDistancesKm.reduce((sum, stationKm) => {
      const offset = (sample.distanceKm - stationKm) / aidSigmaKm;
      return sum + 2 * Math.exp(-(offset * offset) / 2);
    }, 0);
    return 1 + climb + descent + Math.min(aid, 2);
  });

  const smoothingRadius = Math.max(1, Math.round((totalDistanceKm * 0.01) / spacingKm));
  return movingAverage(weights, smoothingRadius);
};

const scheduleAidLabels = (
  stations: Array<VideoAidStation & { arrivalMs: number }>,
  flyoverEndMs: number,
): ScheduledAidLabel[] => {
  const labels: ScheduledAidLabel[] = [];
  [...stations]
    .sort((left, right) => left.arrivalMs - right.arrivalMs)
    .forEach((station) => {
      const startMs = station.arrivalMs;
      if (startMs >= flyoverEndMs) return;
      const previous = labels[labels.length - 1];
      if (previous && startMs < previous.endMs) {
        // Collision: shorten the previous label when both can stay readable, otherwise keep the
        // earlier one and drop this station rather than stacking two labels.
        if (startMs - previous.startMs < AID_LABEL_MIN_DURATION_MS) return;
        previous.endMs = startMs;
      }
      labels.push({
        id: station.id,
        name: station.name,
        distanceKm: station.distanceKm,
        startMs,
        endMs: Math.min(flyoverEndMs, startMs + AID_LABEL_DURATION_MS),
      });
    });
  return labels.filter((label) => label.endMs - label.startMs >= AID_LABEL_MIN_DURATION_MS);
};

export const buildVideoTimeline = (
  path: PreparedAnimationPath,
  aidStations: VideoAidStation[],
  settings: VideoCompositionSettings,
): VideoTimeline => {
  const totalMs = settings.durationSeconds * 1_000;
  const introMs = settings.introEnabled ? INTRO_DURATION_MS : 0;
  const outroMs = settings.outroEnabled ? OUTRO_DURATION_MS : 0;
  const flyoverMs = Math.max(1, totalMs - introMs - outroMs);
  const totalDistanceKm = path.totalDistanceKm;
  const disabled = new Set(settings.disabledAidStationIds);
  const enabledStations = aidStations.filter((station) =>
    !disabled.has(station.id) && station.distanceKm > 0 && station.distanceKm < totalDistanceKm);

  const sampleDistancesKm = path.samples.map((sample) => sample.distanceKm);
  const weights = computePacingWeights(path, enabledStations.map((station) => station.distanceKm));
  const cumulative = [0];
  for (let index = 1; index < path.samples.length; index += 1) {
    const stepKm = sampleDistancesKm[index] - sampleDistancesKm[index - 1];
    cumulative.push(cumulative[index - 1] + stepKm * (weights[index - 1] + weights[index]) / 2);
  }
  const totalWeight = cumulative[cumulative.length - 1] ?? 0;
  const cumulativeTimeFraction = totalWeight > 0
    ? cumulative.map((value) => value / totalWeight)
    : sampleDistancesKm.map((_, index, all) => all.length > 1 ? index / (all.length - 1) : 0);

  const timeline: VideoTimeline = {
    totalMs,
    introMs,
    flyoverMs,
    outroMs,
    totalDistanceKm,
    averageSpeedMps: totalDistanceKm * 1_000 / (flyoverMs / 1_000),
    sampleDistancesKm,
    cumulativeTimeFraction,
    aidStations: [],
    aidLabels: [],
  };
  timeline.aidStations = enabledStations.map((station) => ({
    ...station,
    arrivalMs: introMs + getFlyoverFractionAtDistance(timeline, station.distanceKm) * flyoverMs,
  }));
  timeline.aidLabels = settings.showAidStations
    ? scheduleAidLabels(timeline.aidStations, introMs + flyoverMs)
    : [];
  return timeline;
};

export const getDistanceAtFlyoverFraction = (timeline: VideoTimeline, fraction: number) => {
  if (timeline.sampleDistancesKm.length < 2) return 0;
  return interpolateTable(timeline.cumulativeTimeFraction, timeline.sampleDistancesKm, clamp(fraction, 0, 1));
};

export const getFlyoverFractionAtDistance = (timeline: VideoTimeline, distanceKm: number) => {
  if (timeline.sampleDistancesKm.length < 2) return 0;
  return interpolateTable(timeline.sampleDistancesKm, timeline.cumulativeTimeFraction, distanceKm);
};

/** The single time → state function shared by the preview and the future frame-by-frame export. */
export const getVideoFrameState = (timeline: VideoTimeline, requestedTimeMs: number): VideoFrameState => {
  const timeMs = clamp(requestedTimeMs, 0, timeline.totalMs);
  const flyoverEndMs = timeline.introMs + timeline.flyoverMs;
  let phase: VideoPhase = "flyover";
  let phaseProgress: number;
  let distanceKm: number;

  if (timeMs < timeline.introMs) {
    phase = "intro";
    phaseProgress = timeMs / timeline.introMs;
    distanceKm = 0;
  } else if (timeMs >= flyoverEndMs && timeline.outroMs > 0) {
    phase = "outro";
    phaseProgress = clamp((timeMs - flyoverEndMs) / timeline.outroMs, 0, 1);
    distanceKm = timeline.totalDistanceKm;
  } else {
    phaseProgress = clamp((timeMs - timeline.introMs) / timeline.flyoverMs, 0, 1);
    distanceKm = getDistanceAtFlyoverFraction(timeline, phaseProgress);
  }

  const aidLabel = phase === "flyover"
    ? timeline.aidLabels.find((label) => timeMs >= label.startMs && timeMs < label.endMs) ?? null
    : null;

  return {
    timeMs,
    phase,
    phaseProgress,
    distanceKm,
    routeProgress: timeline.totalDistanceKm > 0 ? clamp(distanceKm / timeline.totalDistanceKm, 0, 1) : 0,
    aidLabel,
  };
};

export type ElevationProfile = {
  width: number;
  height: number;
  linePath: string;
  areaPath: string;
  minElevationM: number;
  maxElevationM: number;
  totalDistanceKm: number;
};

const MAX_PROFILE_POINTS = 400;

/** Computed once per route; frames only move a cursor over it. */
export const buildElevationProfile = (
  path: PreparedAnimationPath,
  width = 1_000,
  height = 220,
): ElevationProfile => {
  const { samples, totalDistanceKm } = path;
  const step = Math.max(1, Math.ceil(samples.length / MAX_PROFILE_POINTS));
  const picked = samples.filter((_, index) => index % step === 0 || index === samples.length - 1);
  const elevations = picked.map((sample) => sample.elevationM);
  const minElevationM = elevations.length ? Math.min(...elevations) : 0;
  const maxElevationM = elevations.length ? Math.max(...elevations) : 0;
  const toX = (distanceKm: number) => totalDistanceKm > 0 ? (distanceKm / totalDistanceKm) * width : 0;
  const profile: ElevationProfile = { width, height, linePath: "", areaPath: "", minElevationM, maxElevationM, totalDistanceKm };
  const coordinates = picked.map((sample) =>
    `${toX(sample.distanceKm).toFixed(1)},${getProfileY(profile, sample.elevationM).toFixed(1)}`);
  profile.linePath = coordinates.length ? `M${coordinates.join("L")}` : "";
  profile.areaPath = coordinates.length ? `${profile.linePath}L${width},${height}L0,${height}Z` : "";
  return profile;
};

export const getProfileY = (profile: ElevationProfile, elevationM: number) => {
  const range = Math.max(50, profile.maxElevationM - profile.minElevationM);
  return profile.height - ((elevationM - profile.minElevationM) / range) * profile.height * 0.9 - profile.height * 0.05;
};

const INTRO_HOLD_RATIO = 0.35;
const OUTRO_GLIDE_RATIO = 0.6;

/** Intro holds the overview then glides to the start; the outro glides back and holds. */
export const getVideoCameraPose = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  frame: VideoFrameState,
  viewport: AnimationViewport,
): CameraPose => {
  const chase = getChaseCameraPose(path, frame.distanceKm, timeline.averageSpeedMps, viewport);
  if (frame.phase === "flyover") return chase;
  const overview = getOverviewCameraPose(path, viewport);
  if (frame.phase === "intro") {
    return interpolateCameraPose(
      overview,
      chase,
      easeInOut((frame.phaseProgress - INTRO_HOLD_RATIO) / (1 - INTRO_HOLD_RATIO)),
    );
  }
  return interpolateCameraPose(chase, overview, easeInOut(frame.phaseProgress / OUTRO_GLIDE_RATIO));
};
