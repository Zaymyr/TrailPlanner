import { z } from "zod";

import type { VideoAidStation } from "../../../lib/video-generator";
import {
  easeInOut,
  getChaseCameraPose,
  getOverviewCameraPose,
  getRoutePointAtDistance,
  interpolateCameraPose,
  type AnimationViewport,
  type CameraPose,
  type PreparedAnimationPath,
} from "./route-animation";

export const VIDEO_DURATION_PRESETS = [30, 45, 60, 90] as const;
export const VIDEO_FPS = 30;
export const INTRO_DURATION_MS = 3_000;
export const OUTRO_DURATION_MS = 3_000;
export const START_LABEL_DURATION_MS = 2_500;
export const AID_LABEL_MIN_DURATION_MS = 1_200;
// A bubble opens while the flyover slows down on the approach and closes just after the station.
export const AID_BUBBLE_APPROACH_SIGMAS = 2.5;
export const AID_BUBBLE_EXIT_SIGMAS = 0.4;

export const VIDEO_RESOLUTIONS = {
  "540p": { width: 540, height: 960 },
  "1080p": { width: 1080, height: 1920 },
} as const;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const MAPBOX_STYLE_URL_PATTERN = /^mapbox:\/\/styles\/[\w.-]+\/[\w-]+$/;

// Serializable on purpose: the same object must reproduce the same render later (export jobs).
export const videoCompositionSettingsSchema = z.object({
  version: z.literal(1).default(1),
  durationSeconds: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).default(45),
  resolution: z.enum(["540p", "1080p"]).default("540p"),
  viewport: z.enum(["portrait", "landscape"]).default("portrait"),
  revealMode: z.enum(["progressive", "full"]).default("progressive"),
  mapStyle: z.enum(["paceyourself", "classic", "standard", "custom"]).default("paceyourself"),
  customStyleUrl: z.string().regex(MAPBOX_STYLE_URL_PATTERN).nullable().default(null),
  mapAmbiance: z.enum(["brand", "natural", "vivid", "cinematic", "night"]).default("brand"),
  hideMapLabels: z.boolean().default(true),
  showPeaks: z.boolean().default(true),
  terrainExaggeration: z.number().min(1).max(2.5).default(1.3),
  routeWidth: z.enum(["normal", "bold"]).default("normal"),
  routeGlow: z.boolean().default(false),
  showTitle: z.boolean().default(true),
  showDistance: z.boolean().default(true),
  showElevation: z.boolean().default(true),
  showStartInfo: z.boolean().default(true),
  showAidStations: z.boolean().default(true),
  showProfile: z.boolean().default(true),
  profileMode: z.enum(["window", "full"]).default("window"),
  showCurrentKm: z.boolean().default(true),
  routeColor: hexColorSchema.default("#ff8a3d"),
  accentColor: hexColorSchema.default("#2d5016"),
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
  kind: "start" | "aid";
  name: string;
  detail: string | null;
  distanceKm: number;
  services: AidService[];
  isLifeBase: boolean;
  cutoffTime: string | null;
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
  terrainExaggeration: number;
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

export type PacingStop = { distanceKm: number; strength: number };

export const AID_STATION_SLOWDOWN = 10;
export const LIFE_BASE_SLOWDOWN = 15;
// Stops may take at most this share of the flyover, so a route with many stations still moves.
export const MAX_STOP_TIME_SHARE = 0.6;
// Leaving a station, the flyover speeds up again over a longer distance than it slowed down.
const STOP_EXIT_SIGMA_RATIO = 1.3;

export const AID_SERVICES = {
  water: "Eau",
  food: "Nourriture",
  assistance: "Assistance",
  dropBag: "Sac d’allègement",
} as const;
export type AidService = keyof typeof AID_SERVICES;

export const getAidStationServices = (station: VideoAidStation): AidService[] => {
  const services: AidService[] = [];
  if (station.waterAvailable) services.push("water");
  if (station.foodAvailable) services.push("food");
  if (station.assistanceAllowed) services.push("assistance");
  if (station.dropBagAvailable) services.push("dropBag");
  return services;
};

/** Approach width of a stop slowdown; the exit side is STOP_EXIT_SIGMA_RATIO times wider. */
export const getStopSigmaKm = (totalDistanceKm: number) => Math.max(0.5, totalDistanceKm * 0.012);

/**
 * Relative time spent per kilometre. Climbs and steep descents slow the flyover down; around each
 * enabled stop it brakes hard on the approach and speeds up again progressively after the station.
 * The weights are smoothed so the speed never changes abruptly.
 */
export const computePacingWeights = (path: PreparedAnimationPath, stops: PacingStop[]) => {
  const { samples, totalDistanceKm } = path;
  if (samples.length < 2 || totalDistanceKm <= 0) return samples.map(() => 1);
  const spacingKm = totalDistanceKm / (samples.length - 1);
  const gradeRadius = Math.max(1, Math.round(0.15 / spacingKm));
  const approachSigmaKm = getStopSigmaKm(totalDistanceKm);
  const exitSigmaKm = approachSigmaKm * STOP_EXIT_SIGMA_RATIO;

  const terrain = samples.map((_, index) => {
    const before = samples[Math.max(0, index - gradeRadius)];
    const after = samples[Math.min(samples.length - 1, index + gradeRadius)];
    const runM = (after.distanceKm - before.distanceKm) * 1_000;
    const grade = runM > 0 ? (after.elevationM - before.elevationM) / runM : 0;
    return 1 + 1.4 * clamp(grade / 0.15, 0, 1) + 0.5 * clamp(-grade / 0.2, 0, 1);
  });
  const stopWeights = samples.map((sample) => Math.min(LIFE_BASE_SLOWDOWN, stops.reduce((sum, { distanceKm, strength }) => {
    const delta = sample.distanceKm - distanceKm;
    const offset = delta / (delta < 0 ? approachSigmaKm : exitSigmaKm);
    return sum + strength * Math.exp(-(offset * offset) / 2);
  }, 0)));

  const terrainTotal = terrain.reduce((sum, value) => sum + value, 0);
  const stopTotal = stopWeights.reduce((sum, value) => sum + value, 0);
  const maxStopTotal = (terrainTotal * MAX_STOP_TIME_SHARE) / (1 - MAX_STOP_TIME_SHARE);
  const stopScale = stopTotal > maxStopTotal ? maxStopTotal / stopTotal : 1;
  const weights = terrain.map((value, index) => value + stopWeights[index] * stopScale);

  const smoothingRadius = Math.max(1, Math.round((totalDistanceKm * 0.005) / spacingKm));
  return movingAverage(weights, smoothingRadius);
};

const scheduleLabels = (candidates: ScheduledAidLabel[], flyoverEndMs: number): ScheduledAidLabel[] => {
  const labels: ScheduledAidLabel[] = [];
  [...candidates]
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .forEach((candidate) => {
      // One bubble at a time: a close station waits until the previous one has been passed, and is
      // dropped when what remains of its approach would be unreadable.
      const previous = labels[labels.length - 1];
      const startMs = Math.max(candidate.startMs, previous?.endMs ?? 0);
      const endMs = Math.min(flyoverEndMs, candidate.endMs);
      if (endMs - startMs < AID_LABEL_MIN_DURATION_MS) return;
      labels.push({ ...candidate, startMs, endMs });
    });
  return labels;
};

export type VideoStartInfo = { detail: string | null };

export const buildVideoTimeline = (
  path: PreparedAnimationPath,
  aidStations: VideoAidStation[],
  settings: VideoCompositionSettings,
  startInfo: VideoStartInfo = { detail: null },
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
  const showStart = settings.showStartInfo && Boolean(startInfo.detail);
  const weights = computePacingWeights(path, [
    ...(showStart ? [{ distanceKm: 0, strength: AID_STATION_SLOWDOWN }] : []),
    ...(settings.showAidStations ? enabledStations : []).map((station) => ({
      distanceKm: station.distanceKm,
      strength: station.isLifeBase ? LIFE_BASE_SLOWDOWN : AID_STATION_SLOWDOWN,
    })),
  ]);
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
    terrainExaggeration: settings.terrainExaggeration,
    sampleDistancesKm,
    cumulativeTimeFraction,
    aidStations: [],
    aidLabels: [],
  };
  timeline.aidStations = enabledStations.map((station) => ({
    ...station,
    arrivalMs: introMs + getFlyoverFractionAtDistance(timeline, station.distanceKm) * flyoverMs,
  }));

  const sigmaKm = getStopSigmaKm(totalDistanceKm);
  const msAtDistance = (distanceKm: number) =>
    introMs + getFlyoverFractionAtDistance(timeline, clamp(distanceKm, 0, totalDistanceKm)) * flyoverMs;
  const candidates: ScheduledAidLabel[] = [];
  if (showStart) {
    candidates.push({
      id: "start",
      kind: "start",
      name: "Départ",
      detail: startInfo.detail,
      distanceKm: 0,
      services: [],
      isLifeBase: false,
      cutoffTime: null,
      startMs: introMs,
      endMs: Math.max(introMs + START_LABEL_DURATION_MS, msAtDistance(sigmaKm * 0.6)),
    });
  }
  if (settings.showAidStations) {
    timeline.aidStations.forEach((station) => candidates.push({
      id: station.id,
      kind: "aid",
      name: station.name,
      detail: null,
      distanceKm: station.distanceKm,
      services: getAidStationServices(station),
      isLifeBase: station.isLifeBase,
      cutoffTime: station.cutoffTime,
      startMs: Math.max(introMs, msAtDistance(station.distanceKm - sigmaKm * AID_BUBBLE_APPROACH_SIGMAS)),
      endMs: msAtDistance(station.distanceKm + sigmaKm * AID_BUBBLE_EXIT_SIGMAS),
    }));
  }
  timeline.aidLabels = scheduleLabels(candidates, introMs + flyoverMs);
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

export const PROFILE_UNITS_PER_KM = 100;

export const PROFILE_SLOPE_CLASSES = [
  { id: "descent", label: "Descente", color: "#60a5fa", maxGrade: -0.08 },
  { id: "flat", label: "Roulant", color: "#a3e635", maxGrade: 0.04 },
  { id: "moderate", label: "4-10 %", color: "#facc15", maxGrade: 0.1 },
  { id: "steep", label: "10-18 %", color: "#fb923c", maxGrade: 0.18 },
  { id: "very-steep", label: "> 18 %", color: "#ef4444", maxGrade: Number.POSITIVE_INFINITY },
] as const;

export type ProfileSlopeClass = typeof PROFILE_SLOPE_CLASSES[number];

export type ElevationProfileSegment = {
  color: string;
  linePath: string;
  areaPath: string;
};

export type ElevationProfile = {
  height: number;
  totalDistanceKm: number;
  minElevationM: number;
  maxElevationM: number;
  segments: ElevationProfileSegment[];
};

export const getSlopeClass = (grade: number): ProfileSlopeClass =>
  PROFILE_SLOPE_CLASSES.find((slopeClass) => grade <= slopeClass.maxGrade) ?? PROFILE_SLOPE_CLASSES[PROFILE_SLOPE_CLASSES.length - 1];

/** Grade over ±100 m around a distance, as a ratio (0.12 = 12 %). */
export const getGradeAtDistance = (path: PreparedAnimationPath, distanceKm: number) => {
  const half = Math.min(0.1, path.totalDistanceKm / 2);
  if (half <= 0) return 0;
  const from = getRoutePointAtDistance(path, Math.max(0, distanceKm - half));
  const to = getRoutePointAtDistance(path, Math.min(path.totalDistanceKm, distanceKm + half));
  const runM = (to.distanceKm - from.distanceKm) * 1_000;
  return runM > 0 ? (to.elevationM - from.elevationM) / runM : 0;
};

export const getProfileY = (profile: Pick<ElevationProfile, "height" | "minElevationM" | "maxElevationM">, elevationM: number) => {
  const range = Math.max(50, profile.maxElevationM - profile.minElevationM);
  return profile.height - ((elevationM - profile.minElevationM) / range) * profile.height * 0.85 - profile.height * 0.05;
};

/**
 * Computed once per route: every camera sample, coloured by slope class. x is in
 * PROFILE_UNITS_PER_KM so a frame only changes the SVG viewBox to scroll the visible window.
 */
export const buildElevationProfile = (path: PreparedAnimationPath, height = 220): ElevationProfile => {
  const { samples, totalDistanceKm } = path;
  const elevations = samples.map((sample) => sample.elevationM);
  const profile: ElevationProfile = {
    height,
    totalDistanceKm,
    minElevationM: elevations.length ? Math.min(...elevations) : 0,
    maxElevationM: elevations.length ? Math.max(...elevations) : 0,
    segments: [],
  };
  if (samples.length < 2) return profile;

  const toPoint = (index: number) => {
    const sample = samples[index];
    return `${(sample.distanceKm * PROFILE_UNITS_PER_KM).toFixed(1)},${getProfileY(profile, sample.elevationM).toFixed(1)}`;
  };
  let runStart = 0;
  let runColor = getSlopeClass(getGradeAtDistance(path, samples[0].distanceKm)).color;
  const closeRun = (endIndex: number) => {
    const points: string[] = [];
    for (let index = runStart; index <= endIndex; index += 1) points.push(toPoint(index));
    const startX = (samples[runStart].distanceKm * PROFILE_UNITS_PER_KM).toFixed(1);
    const endX = (samples[endIndex].distanceKm * PROFILE_UNITS_PER_KM).toFixed(1);
    const linePath = `M${points.join("L")}`;
    profile.segments.push({ color: runColor, linePath, areaPath: `${linePath}L${endX},${height}L${startX},${height}Z` });
  };

  for (let index = 1; index < samples.length; index += 1) {
    const color = getSlopeClass(getGradeAtDistance(path, samples[index].distanceKm)).color;
    if (color !== runColor) {
      closeRun(index);
      runStart = index;
      runColor = color;
    }
  }
  closeRun(samples.length - 1);
  return profile;
};

export type ProfileWindow = { startKm: number; endKm: number };

/** Visible distance range: a scrolling window with the cursor at 35 %, or the whole route. */
export const getProfileWindow = (
  totalDistanceKm: number,
  distanceKm: number,
  mode: VideoCompositionSettings["profileMode"],
): ProfileWindow => {
  if (mode === "full" || totalDistanceKm <= 0) return { startKm: 0, endKm: Math.max(totalDistanceKm, 0.001) };
  const widthKm = Math.min(totalDistanceKm, clamp(totalDistanceKm * 0.18, 6, 25));
  const startKm = clamp(distanceKm - widthKm * 0.35, 0, totalDistanceKm - widthKm);
  return { startKm, endKm: startKm + widthKm };
};

export const getProfileTicks = ({ startKm, endKm }: ProfileWindow) => {
  const span = endKm - startKm;
  const step = [1, 2, 5, 10, 20, 50].find((candidate) => span / candidate <= 6) ?? 100;
  const ticks: number[] = [];
  for (let km = Math.ceil(startKm / step) * step; km <= endKm; km += step) ticks.push(km);
  return ticks;
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
  const exaggeration = timeline.terrainExaggeration;
  const chase = getChaseCameraPose(path, frame.distanceKm, timeline.averageSpeedMps, viewport, exaggeration);
  if (frame.phase === "flyover") return chase;
  const overview = getOverviewCameraPose(path, viewport, exaggeration);
  if (frame.phase === "intro") {
    return interpolateCameraPose(
      overview,
      chase,
      easeInOut((frame.phaseProgress - INTRO_HOLD_RATIO) / (1 - INTRO_HOLD_RATIO)),
    );
  }
  return interpolateCameraPose(chase, overview, easeInOut(frame.phaseProgress / OUTRO_GLIDE_RATIO));
};
