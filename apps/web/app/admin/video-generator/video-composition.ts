import { z } from "zod";

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
import { getSmoothedDaylightAt, type Daylight, type RaceClock } from "./route-clock";
import { estimateNarrationMs, getAutoDurationSeconds, MAX_NARRATED_VIDEO_SECONDS, MAX_VIDEO_SECONDS, stripVoiceTags, type StoryBeat } from "./route-story";

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
  // Small cards above aid stations (name, cumulative D+, cutoff) shown while approaching them.
  showAidBubbles: z.boolean().default(true),
  showSubtitles: z.boolean().default(true),
  showProfile: z.boolean().default(true),
  profileMode: z.enum(["window", "full"]).default("window"),
  showCurrentKm: z.boolean().default(true),
  routeColor: hexColorSchema.default("#2d5016"),
  routeCasing: z.boolean().default(true),
  // Colour of the route on the climb, descent or rolling section being told.
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

/** Per-character end times (ms) of each generated narration, by beat id. */
export type NarrationAlignments = Record<string, number[]>;

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
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…:;])\s+/).filter(Boolean);
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

/**
 * Times subtitle lines: exactly from the ElevenLabs per-character timing when it matches the
 * text, otherwise in proportion to the line lengths.
 */
const timeSubtitles = (text: string, startMs: number, durationMs: number, characterEndMs?: number[]): SubtitleLine[] => {
  // Performance tags ("[excited]") are spoken as intonation, never shown.
  const { text: shown, rawIndex } = stripVoiceTags(text);
  const lines = splitSubtitleText(shown);
  const spoken = text.trim();
  const leadingSpaces = text.length - text.trimStart().length;
  if (characterEndMs && characterEndMs.length === spoken.length && lines.length) {
    let cursor = 0;
    let previousEndMs = 0;
    const aligned = lines.map((line) => {
      const at = shown.indexOf(line, cursor);
      if (at < 0) return null;
      cursor = at + line.length;
      const endMs = characterEndMs[rawIndex[cursor - 1] - leadingSpaces];
      if (endMs === undefined) return null;
      const entry = { text: line, startMs: startMs + previousEndMs, endMs: startMs + endMs };
      previousEndMs = endMs;
      return entry;
    });
    if (aligned.every((entry): entry is SubtitleLine => entry !== null)) return aligned;
  }
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
 * route and the narration (see the cap below).
 */
export const buildVideoTimeline = (
  path: PreparedAnimationPath,
  beats: StoryBeat[],
  settings: VideoCompositionSettings,
  durations: NarrationDurations = {},
  clock: RaceClock | null = null,
  alignments: NarrationAlignments = {},
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
  const pauses = routeBeats.map((beat) => beat.pauseMs ?? 0);
  let beatNeeds = routeBeats.map((beat, index) => getNarrationMs(beat, durations) + NARRATION_GAP_MS + pauses[index]);
  const beatsTotal = beatNeeds.reduce((sum, value) => sum + value, 0);
  // A story of consecutive legs covers the whole route: there is no transit outside the beats.
  const coveredKm = routeBeats.reduce((sum, beat) => sum + (beat.endKm - beat.startKm), 0);
  const continuous = totalDistanceKm > 0 && coveredKm / totalDistanceKm > 0.98;
  const narrationShare = continuous ? CONTINUOUS_NARRATION_SHARE : MAX_BEAT_TIME_SHARE;

  // A continuous story lasts as long as it is told: the voice runs over every leg, no silent dash.
  // Auto mode never cuts the voice to the 2-minute target (a 123 s story makes a 123 s reel), up
  // to the 3-minute Instagram limit; a manual length is a hard cap, flagged when the voice overflows.
  const totalMs = settings.durationMode === "auto"
    ? Math.min(MAX_NARRATED_VIDEO_SECONDS * 1_000, Math.ceil((continuous
      ? introMs + outroMs + beatsTotal
      : Math.max(getAutoDurationSeconds(totalDistanceKm) * 1_000, introMs + outroMs + beatsTotal / narrationShare)) / 1_000) * 1_000)
    : Math.min(MAX_VIDEO_SECONDS * 1_000, settings.durationSeconds * 1_000);
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
  // Continuous story: each leg lasts its narration (plus a share of any spare time), spread over
  // the whole leg so the voice accompanies the camera to the next cut. The camera is slower near
  // the point the leg starts from and on climbs; a station pause is spent right at the point.
  const legShape = (beat: StoryBeat, distanceKm: number) =>
    1 + 2.5 * Math.exp(-(distanceKm - beat.startKm) / Math.max(0.05, (beat.endKm - beat.startKm) * 0.12));
  const shapeTotals = routeBeats.map(() => 0);
  const dwellTotals = routeBeats.map(() => 0);
  intervals.forEach(({ beatIndex, stepKm, middleKm, terrain: weight }) => {
    if (beatIndex < 0) return;
    const beat = routeBeats[beatIndex];
    shapeTotals[beatIndex] += stepKm * weight * legShape(beat, middleKm);
    if (middleKm - beat.startKm < dwellKm(beat)) dwellTotals[beatIndex] += stepKm;
  });
  const spokenTotal = beatNeeds.reduce((sum, value, index) => sum + value - pauses[index], 0);
  const legMs = beatNeeds.map((need, index) =>
    need - pauses[index] + (spokenTotal > 0 ? (remainderMs * (need - pauses[index])) / spokenTotal : 0));
  const continuousDensities = () => intervals.map(({ beatIndex, middleKm, terrain: weight }) => {
    if (beatIndex < 0) return 0;
    const beat = routeBeats[beatIndex];
    const travel = shapeTotals[beatIndex] > 0 ? (legMs[beatIndex] * weight * legShape(beat, middleKm)) / shapeTotals[beatIndex] : 0;
    const pause = dwellTotals[beatIndex] > 0 && middleKm - beat.startKm < dwellKm(beat) ? pauses[beatIndex] / dwellTotals[beatIndex] : 0;
    return travel + pause;
  });
  // Isolated beats: narration at each beat, the rest of the time as terrain-weighted transit.
  const transitMs = remainderMs;
  const isolatedDensities = () => intervals.map(({ beatIndex, middleKm, terrain: weight }) => {
    if (beatIndex >= 0) {
      const beat = routeBeats[beatIndex];
      const narration = focusTotals[beatIndex] > 0 ? (beatNeeds[beatIndex] * narrationFocus(beat, middleKm)) / focusTotals[beatIndex] : 0;
      return narration;
    }
    return transitWeight > 0 ? (transitMs * weight) / transitWeight : 0;
  });
  const densities = continuous ? continuousDensities() : isolatedDensities();
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
    scheduled.push({ ...introBeat, startMs: 0, endMs: introMs, narrationStartMs: NARRATION_GAP_MS, narrationMs, subtitles: timeSubtitles(introBeat.narration, NARRATION_GAP_MS, narrationMs, alignments[introBeat.id]) });
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
      subtitles: timeSubtitles(beat.narration, narrationStartMs, narrationMs, alignments[beat.id]),
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
      subtitles: timeSubtitles(outroBeat.narration, narrationStartMs, narrationMs, alignments[outroBeat.id]),
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

/**
 * Aid stations the camera flies over inside a leg, with the share of the leg's screen time
 * (0 to 1) at which it reaches each one. The script places their mention before that moment, so
 * the voice never names a station the camera has already passed.
 */
export const getLegPassages = (
  timeline: VideoTimeline,
  leg: Pick<StoryBeat, "startKm" | "endKm">,
  stations: Array<{ name: string; distanceKm: number }>,
) => {
  const startFraction = getFlyoverFractionAtDistance(timeline, leg.startKm);
  const span = getFlyoverFractionAtDistance(timeline, leg.endKm) - startFraction;
  if (span <= 0) return [];
  return stations
    .filter((station) => station.distanceKm > leg.startKm + 0.05 && station.distanceKm < leg.endKm - 0.05)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, 8)
    .map((station) => ({
      name: station.name.slice(0, 120),
      km: Math.round(station.distanceKm * 10) / 10,
      moment: Math.round(clamp((getFlyoverFractionAtDistance(timeline, station.distanceKm) - startFraction) / span, 0, 1) * 100) / 100,
    }));
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
const CAMERA_SPEED_WINDOW_MS = 6_000;
// The look direction averages where the runner was and will be over these windows: a turn is
// anticipated and spread over several seconds whatever the speed, so it never jerks.
const HEADING_WINDOWS_MS = [3_000, 6_000, 9_000];

export const getTimeSmoothedHeading = (path: PreparedAnimationPath, timeline: VideoTimeline, timeMs: number) => {
  const flyoverStart = timeline.introMs;
  const flyoverEnd = timeline.introMs + timeline.flyoverMs;
  const distanceAt = (ms: number) =>
    getDistanceAtFlyoverFraction(timeline, (clamp(ms, flyoverStart, flyoverEnd) - flyoverStart) / Math.max(1, timeline.flyoverMs));
  let east = 0;
  let north = 0;
  HEADING_WINDOWS_MS.forEach((windowMs) => {
    const from = getRoutePointAtDistance(path, distanceAt(timeMs - windowMs));
    const to = getRoutePointAtDistance(path, distanceAt(timeMs + windowMs));
    const metersPerDegreeLat = 111_320;
    east += (to.lon - from.lon) * metersPerDegreeLat * Math.cos((from.lat * Math.PI) / 180);
    north += (to.lat - from.lat) * metersPerDegreeLat;
  });
  const length = Math.hypot(east, north);
  return length > 1 ? { east: east / length, north: north / length } : undefined;
};

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
  // Half of the average keeps the zoom from pumping on every speed change.
  return 0.7 * timeline.averageSpeedMps + 0.3 * localMps;
};

const ORBIT_SIDE_OFFSET_DEG = 35;
// Helicopter-like framing: the camera aims at where the runner is on average over ±6 s, so the
// trail switchbacks do not shake the picture; the dot drifts gently around the centre instead.
const TARGET_SMOOTHING_MS = 6_000;

/**
 * Weighted mean of every route sample the runner covers within ±6 s (triangular weights, the
 * present counts most). Averaging all samples, not a few instants, avoids aliasing: instants a
 * fixed time apart can all land on the same side of regularly spaced switchbacks.
 */
export const getSmoothedCameraTarget = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  timeMs: number,
  /** Leash: the aimed point never drifts further than this from the runner. */
  maxOffsetM = Number.POSITIVE_INFINITY,
) => {
  const flyoverStart = timeline.introMs;
  const flyoverEnd = timeline.introMs + timeline.flyoverMs;
  const distanceAt = (ms: number) =>
    getDistanceAtFlyoverFraction(timeline, (clamp(ms, flyoverStart, flyoverEnd) - flyoverStart) / Math.max(1, timeline.flyoverMs));
  const centerKm = distanceAt(timeMs);
  // Symmetric window that shrinks near the start and the finish: a window cut on one side would
  // aim ahead of the runner (or behind), which left the start off-centre.
  const windowMs = Math.max(0, Math.min(TARGET_SMOOTHING_MS, timeMs - flyoverStart, flyoverEnd - timeMs));
  const fromKm = distanceAt(timeMs - windowMs);
  const toKm = distanceAt(timeMs + windowMs);
  const center = getRoutePointAtDistance(path, centerKm);
  let lat = center.lat;
  let lon = center.lon;
  let elevationM = center.elevationM;
  let totalWeight = 1;
  path.samples.forEach((sample) => {
    if (sample.distanceKm < fromKm || sample.distanceKm > toKm) return;
    const halfSpan = sample.distanceKm < centerKm ? centerKm - fromKm : toKm - centerKm;
    const weight = halfSpan > 0 ? 1 - Math.abs(sample.distanceKm - centerKm) / (halfSpan * 1.25) : 0;
    if (weight <= 0) return;
    lat += sample.lat * weight;
    lon += sample.lon * weight;
    elevationM += sample.elevationM * weight;
    totalWeight += weight;
  });
  const mean = { lat: lat / totalWeight, lon: lon / totalWeight, elevationM: elevationM / totalWeight };
  const metersPerDegreeLat = 111_320;
  const eastM = (mean.lon - center.lon) * metersPerDegreeLat * Math.cos((center.lat * Math.PI) / 180);
  const northM = (mean.lat - center.lat) * metersPerDegreeLat;
  const offsetM = Math.hypot(eastM, northM);
  if (offsetM <= maxOffsetM) return mean;
  const keep = maxOffsetM / offsetM;
  return {
    lat: center.lat + (mean.lat - center.lat) * keep,
    lon: center.lon + (mean.lon - center.lon) * keep,
    elevationM: center.elevationM + (mean.elevationM - center.elevationM) * keep,
  };
};

const toBearingDeg = (east: number, north: number) => ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
const shortestTurnDeg = (from: number, to: number) => ((to - from + 540) % 360) - 180;

/**
 * Camera keyframes: one per told leg, at the middle of its time on screen. The camera looks along
 * the overall direction of the leg (start to end, ignoring every switchback), turned 35° to one
 * side so the relief reads in three-quarter view; the side is the one closest to the previous
 * keyframe so the camera keeps orbiting the same way.
 */
const getOrbitKeyframes = (path: PreparedAnimationPath, timeline: VideoTimeline) => {
  const legs = timeline.beats.filter((beat) => beat.kind !== "intro" && beat.kind !== "outro" && beat.endKm > beat.startKm);
  const keyframes: Array<{ timeMs: number; bearingDeg: number }> = [];
  legs.forEach((leg, index) => {
    const from = getRoutePointAtDistance(path, leg.startKm);
    const to = getRoutePointAtDistance(path, leg.endKm);
    const east = (to.lon - from.lon) * 111_320 * Math.cos((from.lat * Math.PI) / 180);
    const north = (to.lat - from.lat) * 111_320;
    if (Math.hypot(east, north) < 50) return;
    const travel = toBearingDeg(east, north);
    const previous = keyframes[keyframes.length - 1]?.bearingDeg;
    const candidates = [travel + ORBIT_SIDE_OFFSET_DEG, travel - ORBIT_SIDE_OFFSET_DEG].map((value) => (value + 360) % 360);
    const bearingDeg = previous === undefined
      ? candidates[0]
      : candidates.reduce((best, value) => Math.abs(shortestTurnDeg(previous, value)) < Math.abs(shortestTurnDeg(previous, best)) ? value : best);
    const nextStart = legs[index + 1]?.startMs ?? timeline.introMs + timeline.flyoverMs;
    keyframes.push({ timeMs: (leg.startMs + nextStart) / 2, bearingDeg });
  });
  return keyframes;
};

const orbitCache = new WeakMap<VideoTimeline, Array<{ timeMs: number; bearingDeg: number }>>();

/**
 * Where the camera looks from, as a unit vector: the runner stays centred, but the camera does not
 * chase every turn of the trail. It glides from one leg's three-quarter view to the next over the
 * whole time between them (smoothstep), so it never jerks; without legs it follows the
 * time-smoothed travel direction.
 */
export const getOrbitLookDirection = (path: PreparedAnimationPath, timeline: VideoTimeline, timeMs: number) => {
  let keyframes = orbitCache.get(timeline);
  if (!keyframes) {
    keyframes = getOrbitKeyframes(path, timeline);
    orbitCache.set(timeline, keyframes);
  }
  if (keyframes.length === 0) return getTimeSmoothedHeading(path, timeline, timeMs);
  let bearingDeg = keyframes[0].bearingDeg;
  if (timeMs >= keyframes[keyframes.length - 1].timeMs) {
    bearingDeg = keyframes[keyframes.length - 1].bearingDeg;
  } else if (timeMs > keyframes[0].timeMs) {
    const next = keyframes.findIndex((keyframe) => keyframe.timeMs > timeMs);
    const before = keyframes[next - 1];
    const after = keyframes[next];
    const t = easeInOut((timeMs - before.timeMs) / Math.max(1, after.timeMs - before.timeMs));
    bearingDeg = before.bearingDeg + shortestTurnDeg(before.bearingDeg, after.bearingDeg) * t;
  }
  const radians = (bearingDeg * Math.PI) / 180;
  return { east: Math.sin(radians), north: Math.cos(radians) };
};

// The top of the frame holds the title, the profile and the leg card: the whole rig moves forward
// by a share of its ground distance so the runner (or the framed slope) sits in the clear middle-low
// part of the picture instead of the exact centre.
const VISIBLE_ZONE_SHIFT = 0.18;

export const shiftIntoVisibleZone = (pose: CameraPose, ratio = VISIBLE_ZONE_SHIFT): CameraPose => {
  const metersPerDegreeLat = 111_320;
  const cosLat = Math.cos((pose.camera.lat * Math.PI) / 180);
  const eastM = (pose.target.lon - pose.camera.lon) * metersPerDegreeLat * cosLat;
  const northM = (pose.target.lat - pose.camera.lat) * metersPerDegreeLat;
  const dLat = (northM * ratio) / metersPerDegreeLat;
  const dLon = (eastM * ratio) / (metersPerDegreeLat * cosLat);
  return {
    camera: { ...pose.camera, lat: pose.camera.lat + dLat, lon: pose.camera.lon + dLon },
    target: { ...pose.target, lat: pose.target.lat + dLat, lon: pose.target.lon + dLon },
  };
};

/** Camera pose computed from this moment alone, before the time smoothing of the whole flight. */
export const getRawVideoCameraPose = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  frame: VideoFrameState,
  viewport: AnimationViewport,
): CameraPose => {
  const exaggeration = timeline.terrainExaggeration;
  const chase = shiftIntoVisibleZone(getChaseCameraPose(
    path,
    frame.distanceKm,
    getCameraSpeedMps(timeline, frame.timeMs),
    viewport,
    exaggeration,
    getOrbitLookDirection(path, timeline, frame.phase === "flyover" ? frame.timeMs : frame.phase === "intro" ? timeline.introMs : timeline.introMs + timeline.flyoverMs),
    // Same smoothing in every phase (it clamps to the flyover), so the intro and outro glides
    // meet the flyover framing without a jump.
    // The leash (10 % of the camera distance) keeps a fast runner well inside the frame.
    getSmoothedCameraTarget(path, timeline, frame.timeMs, 0.1 * Math.min(20_000, Math.max(4_500, getCameraSpeedMps(timeline, frame.timeMs) * 3))),
  ));
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

// The whole flight is computed once, then low-passed in time (gaussian, σ = 1.8 s) on the camera
// position and on the aimed point: every change (a turn, a speed change, a climb shot taking height)
// becomes a long glide, like a helicopter, and the result stays a pure function of time.
const CAMERA_TRACK_STEP_MS = 100;
const CAMERA_TRACK_SIGMA_MS = 1_800;

type CameraTrack = { lat: Float64Array; lon: Float64Array; alt: Float64Array };
type SmoothedCameraTrack = { camera: CameraTrack; target: CameraTrack };

const cameraTrackCache = new WeakMap<VideoTimeline, Map<AnimationViewport, SmoothedCameraTrack>>();

const createTrack = (length: number): CameraTrack => ({
  lat: new Float64Array(length),
  lon: new Float64Array(length),
  alt: new Float64Array(length),
});

const smoothTrack = (track: CameraTrack, kernel: number[]): CameraTrack => {
  const length = track.lat.length;
  const radius = (kernel.length - 1) / 2;
  const smoothed = createTrack(length);
  for (let index = 0; index < length; index += 1) {
    let lat = 0;
    let lon = 0;
    let alt = 0;
    kernel.forEach((weight, offset) => {
      // The ends are held: before the first and after the last moment the camera stays put.
      const source = clamp(index + offset - radius, 0, length - 1);
      lat += track.lat[source] * weight;
      lon += track.lon[source] * weight;
      alt += track.alt[source] * weight;
    });
    smoothed.lat[index] = lat;
    smoothed.lon[index] = lon;
    smoothed.alt[index] = alt;
  }
  return smoothed;
};

const buildCameraTrack = (path: PreparedAnimationPath, timeline: VideoTimeline, viewport: AnimationViewport) => {
  const length = Math.floor(timeline.totalMs / CAMERA_TRACK_STEP_MS) + 2;
  const camera = createTrack(length);
  const target = createTrack(length);
  for (let index = 0; index < length; index += 1) {
    const pose = getRawVideoCameraPose(path, timeline, getVideoFrameState(timeline, index * CAMERA_TRACK_STEP_MS), viewport);
    camera.lat[index] = pose.camera.lat;
    camera.lon[index] = pose.camera.lon;
    camera.alt[index] = pose.camera.altitudeM;
    target.lat[index] = pose.target.lat;
    target.lon[index] = pose.target.lon;
    target.alt[index] = pose.target.altitudeM;
  }
  const radius = Math.ceil((CAMERA_TRACK_SIGMA_MS * 3) / CAMERA_TRACK_STEP_MS);
  const sigma = CAMERA_TRACK_SIGMA_MS / CAMERA_TRACK_STEP_MS;
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const kernel = weights.map((weight) => weight / total);
  return { camera: smoothTrack(camera, kernel), target: smoothTrack(target, kernel) };
};

const sampleTrack = (track: CameraTrack, position: number) => {
  const index = clamp(Math.floor(position), 0, track.lat.length - 1);
  const next = Math.min(track.lat.length - 1, index + 1);
  const t = clamp(position - index, 0, 1);
  return {
    lat: track.lat[index] + (track.lat[next] - track.lat[index]) * t,
    lon: track.lon[index] + (track.lon[next] - track.lon[index]) * t,
    altitudeM: track.alt[index] + (track.alt[next] - track.alt[index]) * t,
  };
};

/** Camera pose of a frame, read from the time-smoothed flight. */
export const getVideoCameraPose = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  frame: Pick<VideoFrameState, "timeMs">,
  viewport: AnimationViewport,
): CameraPose => {
  let tracks = cameraTrackCache.get(timeline);
  if (!tracks) {
    tracks = new Map();
    cameraTrackCache.set(timeline, tracks);
  }
  let track = tracks.get(viewport);
  if (!track) {
    track = buildCameraTrack(path, timeline, viewport);
    tracks.set(viewport, track);
  }
  const position = clamp(frame.timeMs, 0, timeline.totalMs) / CAMERA_TRACK_STEP_MS;
  return { camera: sampleTrack(track.camera, position), target: sampleTrack(track.target, position) };
};
