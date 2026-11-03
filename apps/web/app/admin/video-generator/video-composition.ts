import { z } from "zod";

import {
  easeInOut,
  getChaseCameraPose,
  getOverviewCameraPose,
  getRoutePointAtDistance,
  getSegmentFramingPose,
  interpolateCameraPose,
  type AnimationViewport,
  type CameraPose,
  type PreparedAnimationPath,
} from "./route-animation";
import { getSmoothedDaylightAt, type Daylight, type RaceClock } from "./route-clock";
import { estimateNarrationMs, getAutoDurationSeconds, MAX_VIDEO_SECONDS, type StoryBeat } from "./route-story";

export { AID_SERVICES, getAidStationServices, type AidService } from "./route-story";

export const VIDEO_DURATION_PRESETS = [30, 45, 60, 90, 120] as const;
export const VIDEO_FPS = 30;
export const MIN_SEQUENCE_MS = 3_000;
// Silence kept after each narration so sentences do not run into each other.
export const NARRATION_GAP_MS = 500;
// Narrated moments may take at most this share of the flyover; the rest is transit between them.
export const MAX_BEAT_TIME_SHARE = 0.7;
// With a continuous story the voice may fill most of the flyover; the rest is travel between talks.
export const CONTINUOUS_NARRATION_SHARE = 0.85;
export const MIN_CAPTION_MS = 1_200;
// The voice starts just before the camera reaches the point it talks about.
export const NARRATION_LEAD_MS = 400;

export const VIDEO_RESOLUTIONS = {
  "540p": { width: 540, height: 960 },
  "1080p": { width: 1080, height: 1920 },
} as const;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const MAPBOX_STYLE_URL_PATTERN = /^mapbox:\/\/styles\/[\w.-]+\/[\w-]+$/;

// Serializable on purpose: the same object must reproduce the same render later (export jobs).
export const videoCompositionSettingsSchema = z.object({
  version: z.literal(1).default(1),
  durationMode: z.enum(["auto", "manual"]).default("auto"),
  durationSeconds: z.number().int().min(15).max(120).default(45),
  resolution: z.enum(["540p", "1080p"]).default("540p"),
  viewport: z.enum(["portrait", "landscape"]).default("portrait"),
  revealMode: z.enum(["progressive", "full"]).default("progressive"),
  mapStyle: z.enum(["paceyourself", "classic", "standard", "custom"]).default("paceyourself"),
  customStyleUrl: z.string().regex(MAPBOX_STYLE_URL_PATTERN).nullable().default(null),
  mapAmbiance: z.enum(["brand", "natural", "vivid", "cinematic", "night"]).default("brand"),
  hideMapLabels: z.boolean().default(true),
  showPeaks: z.boolean().default(true),
  dayNight: z.boolean().default(true),
  terrainExaggeration: z.number().min(1).max(3).default(1.8),
  routeWidth: z.enum(["normal", "bold"]).default("normal"),
  routeGlow: z.boolean().default(false),
  showTitle: z.boolean().default(true),
  showDistance: z.boolean().default(true),
  showElevation: z.boolean().default(true),
  showStartInfo: z.boolean().default(true),
  showAidStations: z.boolean().default(true),
  showCaptions: z.boolean().default(true),
  showSubtitles: z.boolean().default(true),
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

/** Real narration lengths once the voice is generated, by beat id. */
export type NarrationDurations = Record<string, number>;

export type ScheduledBeat = StoryBeat & {
  /** Caption window. */
  startMs: number;
  endMs: number;
  narrationStartMs: number;
  narrationMs: number;
  /** Burned-in subtitle lines of the narration, timed in proportion to their length. */
  subtitles: SubtitleLine[];
};

export type SubtitleLine = { text: string; startMs: number; endMs: number };

const SUBTITLE_MAX_CHARS = 60;

/** Splits a narration into short lines: by sentence, then by words when a sentence is too long. */
export const splitSubtitleText = (text: string, maxChars = SUBTITLE_MAX_CHARS) => {
  const sentences = text.replace(/s+/g, " ").trim().split(/(?<=[.!?…:;])s+/).filter(Boolean);
  return sentences.flatMap((sentence) => {
    if (sentence.length <= maxChars) return [sentence];
    const lines: string[] = [];
    let line = "";
    sentence.split(" ").forEach((word) => {
      if (line && line.length + word.length + 1 > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    });
    if (line) lines.push(line);
    return lines;
  });
};

const timeSubtitles = (text: string, startMs: number, durationMs: number): SubtitleLine[] => {
  const lines = splitSubtitleText(text);
  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  let cursor = startMs;
  return lines.map((line) => {
    const lineMs = totalChars > 0 ? (durationMs * line.length) / totalChars : 0;
    const entry = { text: line, startMs: cursor, endMs: cursor + lineMs };
    cursor += lineMs;
    return entry;
  });
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
  /** Every beat in play order, intro and outro included. */
  beats: ScheduledBeat[];
  /** True when a manual duration is too short for the narration. */
  narrationOverflow: boolean;
  /** Estimated race clock for the day/night look, when the start time is known and the look is on. */
  clock: RaceClock | null;
};

export type VideoFrameState = {
  timeMs: number;
  phase: VideoPhase;
  phaseProgress: number;
  distanceKm: number;
  routeProgress: number;
  /** Route beat whose caption is on screen. */
  beat: ScheduledBeat | null;
  /** Subtitle line of the narration being spoken. */
  subtitle: string | null;
  daylight: Daylight | null;
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

/** Relative time per kilometre between narrated moments: climbs and steep descents go slower. */
export const computeTerrainWeights = (path: PreparedAnimationPath) => {
  const { samples, totalDistanceKm } = path;
  if (samples.length < 2 || totalDistanceKm <= 0) return samples.map(() => 1);
  const spacingKm = totalDistanceKm / (samples.length - 1);
  const gradeRadius = Math.max(1, Math.round(0.15 / spacingKm));
  return samples.map((_, index) => {
    const before = samples[Math.max(0, index - gradeRadius)];
    const after = samples[Math.min(samples.length - 1, index + gradeRadius)];
    const runM = (after.distanceKm - before.distanceKm) * 1_000;
    const grade = runM > 0 ? (after.elevationM - before.elevationM) / runM : 0;
    return 1 + 1.4 * clamp(grade / 0.15, 0, 1) + 0.5 * clamp(-grade / 0.2, 0, 1);
  });
};

export const getNarrationMs = (beat: StoryBeat, durations: NarrationDurations) =>
  durations[beat.id] ?? estimateNarrationMs(beat.narration);

/**
 * The narration drives the video: each route beat gets the time its narration needs, concentrated
 * at the start of its span (the camera slows while the voice speaks). The remaining flyover time is
 * travel, weighted by terrain: inside the legs of a continuous story, or over the transit between
 * isolated beats. The speed is smoothed so it never jumps. In auto mode the length grows with the
 * route and the narration; every video is capped at MAX_VIDEO_SECONDS.
 */
export const buildVideoTimeline = (
  path: PreparedAnimationPath,
  beats: StoryBeat[],
  settings: VideoCompositionSettings,
  durations: NarrationDurations = {},
  clock: RaceClock | null = null,
): VideoTimeline => {
  const totalDistanceKm = path.totalDistanceKm;
  const introBeat = beats.find((beat) => beat.kind === "intro");
  const outroBeat = beats.find((beat) => beat.kind === "outro");
  const routeBeats = beats
    .filter((beat) => beat.kind !== "intro" && beat.kind !== "outro" && beat.endKm > beat.startKm)
    .sort((left, right) => left.startKm - right.startKm);

  const sequenceMs = (beat: StoryBeat | undefined, enabled: boolean) =>
    enabled ? Math.max(MIN_SEQUENCE_MS, beat ? getNarrationMs(beat, durations) + NARRATION_GAP_MS * 2 : 0) : 0;
  const introMs = sequenceMs(introBeat, settings.introEnabled);
  const outroMs = sequenceMs(outroBeat, settings.outroEnabled);
  // A pause (life base, aid station) holds the camera a moment longer around the point.
  let beatNeeds = routeBeats.map((beat) => getNarrationMs(beat, durations) + NARRATION_GAP_MS + (beat.pauseMs ?? 0));
  const beatsTotal = beatNeeds.reduce((sum, value) => sum + value, 0);
  // A story of consecutive legs covers the whole route: there is no transit outside the beats.
  const coveredKm = routeBeats.reduce((sum, beat) => sum + (beat.endKm - beat.startKm), 0);
  const continuous = totalDistanceKm > 0 && coveredKm / totalDistanceKm > 0.98;
  const narrationShare = continuous ? CONTINUOUS_NARRATION_SHARE : MAX_BEAT_TIME_SHARE;

  const maxTotalMs = MAX_VIDEO_SECONDS * 1_000;
  const totalMs = settings.durationMode === "auto"
    ? Math.min(maxTotalMs, Math.ceil(Math.max(
      getAutoDurationSeconds(totalDistanceKm) * 1_000,
      introMs + outroMs + beatsTotal / narrationShare,
    ) / 1_000) * 1_000)
    : Math.min(maxTotalMs, settings.durationSeconds * 1_000);
  const flyoverMs = Math.max(1_000, totalMs - introMs - outroMs);
  const narrationOverflow = beatsTotal > flyoverMs * (continuous ? 0.95 : 0.9);
  if (beatsTotal > flyoverMs * narrationShare) {
    const scale = (flyoverMs * narrationShare) / beatsTotal;
    beatNeeds = beatNeeds.map((value) => value * scale);
  }
  const remainderMs = flyoverMs - beatNeeds.reduce((sum, value) => sum + value, 0);

  const { samples } = path;
  const sampleDistancesKm = samples.map((sample) => sample.distanceKm);
  const terrain = computeTerrainWeights(path);
  const beatAt = (distanceKm: number) =>
    routeBeats.findIndex((beat) => distanceKm >= beat.startKm && distanceKm < beat.endKm);

  // Inside a beat, the narration time is spent on a short stretch right after its start, so the
  // camera stays at the point the voice talks about; the travel time follows the terrain (climbs
  // go slower, flats go fast).
  const dwellKm = (beat: StoryBeat) => clamp((beat.endKm - beat.startKm) * 0.12, 0.15, Math.max(0.3, totalDistanceKm * 0.012));
  const narrationFocus = (beat: StoryBeat, distanceKm: number) => (distanceKm - beat.startKm < dwellKm(beat) ? 1 : 0.02);
  const intervals: Array<{ beatIndex: number; stepKm: number; middleKm: number; terrain: number }> = [];
  const focusTotals = routeBeats.map(() => 0);
  const terrainTotals = routeBeats.map(() => 0);
  let transitWeight = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const stepKm = sampleDistancesKm[index] - sampleDistancesKm[index - 1];
    const middleKm = (sampleDistancesKm[index] + sampleDistancesKm[index - 1]) / 2;
    const beatIndex = beatAt(middleKm);
    const weight = (terrain[index - 1] + terrain[index]) / 2;
    intervals.push({ beatIndex, stepKm, middleKm, terrain: weight });
    if (beatIndex < 0) {
      transitWeight += stepKm * weight;
    } else {
      focusTotals[beatIndex] += stepKm * narrationFocus(routeBeats[beatIndex], middleKm);
      terrainTotals[beatIndex] += stepKm * weight;
    }
  }
  const allTerrain = terrainTotals.reduce((sum, value) => sum + value, 0);
  const travelMs = routeBeats.map((_, beatIndex) =>
    continuous && allTerrain > 0 ? (remainderMs * terrainTotals[beatIndex]) / allTerrain : 0);
  const transitMs = continuous ? 0 : remainderMs;
  const densities = intervals.map(({ beatIndex, middleKm, terrain: weight }) => {
    if (beatIndex >= 0) {
      const beat = routeBeats[beatIndex];
      const narration = focusTotals[beatIndex] > 0 ? (beatNeeds[beatIndex] * narrationFocus(beat, middleKm)) / focusTotals[beatIndex] : 0;
      const travel = terrainTotals[beatIndex] > 0 ? (travelMs[beatIndex] * weight) / terrainTotals[beatIndex] : 0;
      return narration + travel;
    }
    return transitWeight > 0 ? (transitMs * weight) / transitWeight : 0;
  });
  const spacingKm = samples.length > 1 ? totalDistanceKm / (samples.length - 1) : 1;
  const smoothed = movingAverage(densities, Math.max(1, Math.round((totalDistanceKm * 0.0035) / spacingKm)));

  const cumulative = [0];
  smoothed.forEach((density, interval) => {
    cumulative.push(cumulative[interval] + density * (sampleDistancesKm[interval + 1] - sampleDistancesKm[interval]));
  });
  const totalWeight = cumulative[cumulative.length - 1] ?? 0;
  const cumulativeTimeFraction = totalWeight > 0
    ? cumulative.map((value) => value / totalWeight)
    : sampleDistancesKm.map((_, index, all) => all.length > 1 ? index / (all.length - 1) : 0);

  const timeline: VideoTimeline = {
    totalMs: introMs + flyoverMs + outroMs,
    introMs,
    flyoverMs,
    outroMs,
    totalDistanceKm,
    averageSpeedMps: totalDistanceKm * 1_000 / (flyoverMs / 1_000),
    terrainExaggeration: settings.terrainExaggeration,
    sampleDistancesKm,
    cumulativeTimeFraction,
    beats: [],
    narrationOverflow: settings.durationMode === "manual" && narrationOverflow,
    clock: settings.dayNight ? clock : null,
  };

  const msAtDistance = (distanceKm: number) =>
    introMs + getFlyoverFractionAtDistance(timeline, clamp(distanceKm, 0, totalDistanceKm)) * flyoverMs;
  const flyoverEndMs = introMs + flyoverMs;
  const scheduled: ScheduledBeat[] = [];
  if (introBeat && introMs > 0) {
    const narrationMs = getNarrationMs(introBeat, durations);
    scheduled.push({ ...introBeat, startMs: 0, endMs: introMs, narrationStartMs: NARRATION_GAP_MS, narrationMs, subtitles: timeSubtitles(introBeat.narration, NARRATION_GAP_MS, narrationMs) });
  }
  let voiceFreeAtMs = introMs;
  routeBeats.forEach((beat, index) => {
    const startMs = msAtDistance(beat.startKm);
    const narrationStartMs = Math.max(introMs, startMs - NARRATION_LEAD_MS, voiceFreeAtMs);
    const narrationMs = getNarrationMs(beat, durations);
    voiceFreeAtMs = narrationStartMs + narrationMs + NARRATION_GAP_MS;
    const nextStartMs = routeBeats[index + 1] ? msAtDistance(routeBeats[index + 1].startKm) : flyoverEndMs;
    // The caption stays while the voice speaks, without covering the next moment.
    const endMs = Math.min(Math.max(msAtDistance(beat.endKm), narrationStartMs + narrationMs, startMs + MIN_CAPTION_MS), Math.max(nextStartMs, startMs + MIN_CAPTION_MS), flyoverEndMs);
    // The caption appears with the voice, which may start just before the camera reaches the point.
    scheduled.push({
      ...beat,
      startMs: Math.min(startMs, narrationStartMs),
      endMs,
      narrationStartMs,
      narrationMs,
      subtitles: timeSubtitles(beat.narration, narrationStartMs, narrationMs),
    });
  });
  if (outroBeat && outroMs > 0) {
    const narrationStartMs = Math.max(flyoverEndMs + NARRATION_GAP_MS, voiceFreeAtMs);
    const narrationMs = getNarrationMs(outroBeat, durations);
    scheduled.push({
      ...outroBeat,
      startMs: flyoverEndMs,
      endMs: timeline.totalMs,
      narrationStartMs,
      narrationMs,
      subtitles: timeSubtitles(outroBeat.narration, narrationStartMs, narrationMs),
    });
  }
  timeline.beats = scheduled;
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

  const beat = phase === "flyover"
    ? timeline.beats.find((candidate) =>
      candidate.kind !== "intro" && candidate.kind !== "outro" && timeMs >= candidate.startMs && timeMs < candidate.endMs) ?? null
    : null;
  let subtitle: string | null = null;
  for (const candidate of timeline.beats) {
    const line = candidate.subtitles.find((entry) => timeMs >= entry.startMs && timeMs < entry.endMs);
    if (line) {
      subtitle = line.text;
      break;
    }
  }

  return {
    timeMs,
    phase,
    phaseProgress,
    distanceKm,
    daylight: timeline.clock ? getSmoothedDaylightAt(timeline.clock, distanceKm) : null,
    routeProgress: timeline.totalDistanceKm > 0 ? clamp(distanceKm / timeline.totalDistanceKm, 0, 1) : 0,
    beat,
    subtitle,
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
const CAMERA_SPEED_WINDOW_MS = 2_000;
const FRAMING_RAMP_IN_MS = 1_500;
const FRAMING_HOLD_AFTER_MS = 1_200;
const FRAMING_RAMP_OUT_MS = 2_000;

/**
 * On-screen ground speed around a moment, over a ±2 s window so the camera distance breathes
 * smoothly: the faster the flyover, the further back and higher the chase camera, so a fast
 * stretch stays readable; slowing down at a narrated point brings it closer again.
 */
export const getCameraSpeedMps = (timeline: VideoTimeline, timeMs: number) => {
  if (timeline.flyoverMs <= 0) return timeline.averageSpeedMps;
  const flyoverStart = timeline.introMs;
  const flyoverEnd = timeline.introMs + timeline.flyoverMs;
  const from = clamp(timeMs - CAMERA_SPEED_WINDOW_MS, flyoverStart, flyoverEnd - CAMERA_SPEED_WINDOW_MS * 2);
  const to = Math.min(flyoverEnd, from + CAMERA_SPEED_WINDOW_MS * 2);
  if (to <= from) return timeline.averageSpeedMps;
  const distanceAt = (ms: number) => getDistanceAtFlyoverFraction(timeline, (ms - flyoverStart) / timeline.flyoverMs);
  const localMps = ((distanceAt(to) - distanceAt(from)) * 1_000) / ((to - from) / 1_000);
  // Part of the average keeps the zoom from pumping on every small speed change.
  return 0.3 * timeline.averageSpeedMps + 0.7 * localMps;
};

export const getVideoCameraPose = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  frame: VideoFrameState,
  viewport: AnimationViewport,
): CameraPose => {
  const exaggeration = timeline.terrainExaggeration;
  const chase = getChaseCameraPose(path, frame.distanceKm, getCameraSpeedMps(timeline, frame.timeMs), viewport, exaggeration);
  if (frame.phase === "flyover") {
    const beat = frame.beat;
    if (!beat || (beat.kind !== "climb" && beat.kind !== "descent") || beat.focusStartKm === undefined || beat.focusEndKm === undefined) {
      return chase;
    }
    // While a climb or descent is told, glide to a shot showing it whole, then back to the chase.
    const rampIn = (frame.timeMs - beat.narrationStartMs) / FRAMING_RAMP_IN_MS;
    const rampOut = (beat.narrationStartMs + beat.narrationMs + FRAMING_HOLD_AFTER_MS - frame.timeMs) / FRAMING_RAMP_OUT_MS;
    const weight = easeInOut(clamp(Math.min(rampIn, rampOut), 0, 1));
    if (weight <= 0) return chase;
    const framing = getSegmentFramingPose(path, beat.focusStartKm, beat.focusEndKm, viewport, exaggeration);
    return interpolateCameraPose(chase, framing, weight);
  }
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
