import { z } from "zod";

import {
  easeInOut,
  getChaseCameraPose,
  getHookCameraPose,
  getOverviewCameraPose,
  getRoutePointAtDistance,
  interpolateCameraPose,
  type AnimationViewport,
  type CameraPose,
  type PreparedAnimationPath,
} from "./route-animation";
import { findHardestClimb } from "./highlights";
import { HOOK_INTRO_MS, HOOK_NARRATION_START_MS } from "./reel-hook";
import { getSmoothedDaylightAt, type Daylight, type RaceClock } from "./route-clock";
import { buildSubtitleGroups } from "./subtitle-groups";
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

// "Temps forts" reels: 30 to 45 s aimed at, 50 s at most, whatever the narration.
export const HIGHLIGHT_TARGET_SECONDS = 40;
export const HIGHLIGHT_MIN_SECONDS = 30;
export const HIGHLIGHT_MAX_SECONDS = 50;
// Fast flight between two moments (accelerated flyover; the camera pulls back with the speed).
export const HIGHLIGHT_TRANSIT_MS = 1_200;
// A gap this short (share of the route) is not worth a full transit.
const HIGHLIGHT_SHORT_GAP_SHARE = 0.005;
const HIGHLIGHT_SHORT_TRANSIT_MS = 300;
// Camera smoothing windows shrink so a dwell is not blurred with the jumps around it.
export const HIGHLIGHT_CAMERA_TEMPO = 0.25;

export const VIDEO_RESOLUTIONS = {
  "540p": { width: 540, height: 960 },
  "1080p": { width: 1080, height: 1920 },
} as const;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const MAPBOX_STYLE_URL_PATTERN = /^mapbox:\/\/styles\/[\w.-]+\/[\w-]+$/;

// Serializable on purpose: the same object must reproduce the same render later (export jobs).
export const videoCompositionSettingsSchema = z.object({
  version: z.literal(1).default(1),
  // "full" flies the whole course as one story; "highlights" dwells on 3 to 5 key moments.
  storyMode: z.enum(["full", "highlights"]).default("full"),
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
  showPlaceNames: z.boolean().default(true),
  showSubtitles: z.boolean().default(true),
  showProfile: z.boolean().default(true),
  profileMode: z.enum(["window", "full"]).default("window"),
  showCurrentKm: z.boolean().default(true),
  routeColor: hexColorSchema.default("#2d5016"),
  routeCasing: z.boolean().default(true),
  // Colour of the route on the climb, descent or rolling section being told.
  accentColor: hexColorSchema.default("#2d5016"),
  // The climb or descent being told, coloured by slope on the map and lit on the profile.
  highlightToldSlopes: z.boolean().default(true),
  // Logo and CTA on the outro card.
  showLogo: z.boolean().default(true),
  showCta: z.boolean().default(true),
  // Logo and CTA in the bottom-left corner during the flyover; off by default because Instagram
  // already overlays its own follow button there on reels.
  showFooterBrand: z.boolean().default(false),
  introEnabled: z.boolean().default(true),
  // Reel hook instead of the title card: from frame 0 the camera flies low over the hardest climb
  // under one headline figure and the short race name (reel-hook.ts). Null follows the mode: on
  // for highlights, off for the full flyover.
  hookIntro: z.boolean().nullable().default(null),
  // Light overlay for phones: no title band (the hook already says it), no profile ticks, aid
  // bubbles reduced to the station name (its figures go in the leg card). Null follows the mode:
  // on for highlights, off for the full flyover.
  compactOverlay: z.boolean().nullable().default(null),
  outroEnabled: z.boolean().default(true),
  disabledAidStationIds: z.array(z.string()).default([]),
});

export type VideoCompositionSettings = z.infer<typeof videoCompositionSettingsSchema>;
export type VideoPhase = "intro" | "flyover" | "outro";

export const DEFAULT_VIDEO_COMPOSITION_SETTINGS: VideoCompositionSettings = videoCompositionSettingsSchema.parse({});

/** Whether the reel opens on the hook: the explicit setting, otherwise on for highlights only. */
export const isHookIntroEnabled = (settings: Pick<VideoCompositionSettings, "hookIntro" | "storyMode" | "introEnabled">) =>
  settings.introEnabled && (settings.hookIntro ?? settings.storyMode === "highlights");

/** Whether the reel uses the light phone overlay: the explicit setting, otherwise on for highlights only. */
export const isCompactOverlayEnabled = (settings: Pick<VideoCompositionSettings, "compactOverlay" | "storyMode">) =>
  settings.compactOverlay ?? settings.storyMode === "highlights";

/**
 * Smallest font, in cqmin, of any text meant to be read on a phone: 3 cqmin = 32.4 px at 1080 wide.
 * Only the Mapbox attribution (legal line, not read) stays below it.
 */
export const OVERLAY_MIN_FONT_CQMIN = 3;

/** Font sizes (cqmin) of the small overlay and map texts, all at or above OVERLAY_MIN_FONT_CQMIN. */
export const OVERLAY_FONT_CQMIN = {
  captionKind: 3,
  captionFacts: 3.4,
  profileTick: 3,
  footerCta: 3,
  aidName: 3.4,
  aidNameCompact: 4,
  aidDetail: 3,
  aidLifeBase: 3,
  placeKind: 3,
  placeName: 3.6,
} as const;

/** Station cutoffs ("Barrière HH:MM") stand out in red, on the map bubble and in the leg card. */
export const CUTOFF_RED = "#d7263d";

/** Top of the profile band (cqmin) in the light overlay: below Instagram's own top bar. */
export const COMPACT_TOP_CQMIN = 12;

/** What the hook camera flies over (route kilometres) and how it hands over to the flyover. */
export type HookPlan = {
  /** The hardest climb when there is one, otherwise the first moment. */
  startKm: number;
  endKm: number;
  /** The hook subject is where the flyover starts: the camera approaches it at the flyover speed. */
  isFirst: boolean;
  /** Route distance covered before the subject during the hook (isFirst only). */
  approachKm: number;
};

/** Real narration lengths once the voice is generated, by beat id. */
export type NarrationDurations = Record<string, number>;

/** Per-character timing (ms) of a generated narration; start times are absent from older clips. */
export type NarrationAlignment = { characterEndMs: number[]; characterStartMs?: number[] };

/** Per-character timing of each generated narration, by beat id. */
export type NarrationAlignments = Record<string, NarrationAlignment>;

export type ScheduledBeat = StoryBeat & {
  /** Caption window. */
  startMs: number;
  endMs: number;
  narrationStartMs: number;
  narrationMs: number;
  /** Burned-in subtitle groups of the narration, timed word by word when the voice timing is exact. */
  subtitles: SubtitleLine[];
};

export type SubtitleLine = { text: string; startMs: number; endMs: number };

/**
 * Subtitle groups of a narration (2 to 5 words, cut at natural boundaries), timed from the
 * ElevenLabs character timing when it matches the text, otherwise in proportion to their length.
 */
const timeSubtitles = (text: string, startMs: number, durationMs: number, alignment?: NarrationAlignment): SubtitleLine[] => {
  // Performance tags ("[excited]") are spoken as intonation, never shown.
  const { text: shown, rawIndex } = stripVoiceTags(text);
  const spoken = text.trim();
  return buildSubtitleGroups({
    shown,
    rawIndex,
    rawOffset: text.length - text.trimStart().length,
    rawLength: spoken.length,
    durationMs,
    characterEndMs: alignment?.characterEndMs,
    characterStartMs: alignment?.characterStartMs,
  }).map((group) => ({ text: group.text, startMs: startMs + group.startMs, endMs: startMs + group.endMs }));
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
  /** Scale of the camera smoothing windows: 1 for a full flyover, smaller for a highlights reel. */
  cameraTempo?: number;
  /** Weight of the whole-flyover average speed in the camera distance (the rest is local speed). */
  cameraAverageBlend?: number;
  /** Reel hook in place of the classic intro, or null. */
  hook?: HookPlan | null;
  /** Route kilometre where the flyover starts (a hooked highlights reel skips the run-up to its first moment). */
  flyoverStartKm?: number;
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
  // The hook replaces the intro by a fixed 2.4 s; its sentence may run on over the first moment,
  // which then gets that extra time so its own voice still fits its dwell.
  const hooked = isHookIntroEnabled(settings);
  const introMs = hooked ? HOOK_INTRO_MS : sequenceMs(introBeat, settings.introEnabled);
  const hookVoiceEndMs = hooked && introBeat ? HOOK_NARRATION_START_MS + getNarrationMs(introBeat, durations) + NARRATION_GAP_MS : 0;
  const hookOverflowMs = Math.max(0, hookVoiceEndMs - introMs);
  const outroMs = sequenceMs(outroBeat, settings.outroEnabled);
  // A pause (life base, aid station) holds the camera a moment longer around the point.
  const pauses = routeBeats.map((beat) => beat.pauseMs ?? 0);
  let beatNeeds = routeBeats.map((beat, index) => getNarrationMs(beat, durations) + NARRATION_GAP_MS + pauses[index] + (index === 0 ? hookOverflowMs : 0));
  const beatsTotal = beatNeeds.reduce((sum, value) => sum + value, 0);
  // A story of consecutive legs covers the whole route: there is no transit outside the beats.
  const coveredKm = routeBeats.reduce((sum, beat) => sum + (beat.endKm - beat.startKm), 0);
  const continuous = totalDistanceKm > 0 && coveredKm / totalDistanceKm > 0.98;
  const narrationShare = continuous ? CONTINUOUS_NARRATION_SHARE : MAX_BEAT_TIME_SHARE;

  // A continuous story lasts as long as it is told: the voice runs over every leg, no silent dash.
  // Auto mode never cuts the voice to the 2-minute target (a 123 s story makes a 123 s reel), up
  // to the 3-minute Instagram limit; a manual length is a hard cap, flagged when the voice overflows.
  const highlights = settings.storyMode === "highlights";
  // Highlights: the route outside the moments is a fast transit, a fixed time per gap.
  const gapsKm = highlights
    ? routeBeats.map((beat, index) => Math.max(0, beat.startKm - (index > 0 ? routeBeats[index - 1].endKm : 0)))
      .concat(Math.max(0, totalDistanceKm - (routeBeats[routeBeats.length - 1]?.endKm ?? 0)))
    : [];
  // A hooked reel is already on the moments: no run-up from the start line to the first one.
  const gapTransitMs = gapsKm.map((km, index): number => (km <= 0 || (hooked && index === 0) ? 0 : km < totalDistanceKm * HIGHLIGHT_SHORT_GAP_SHARE ? HIGHLIGHT_SHORT_TRANSIT_MS : HIGHLIGHT_TRANSIT_MS));
  const transitTotalMs = gapTransitMs.reduce((sum, value) => sum + value, 0);
  const highlightsNaturalMs = introMs + outroMs + beatsTotal + transitTotalMs;

  const totalMs = highlights
    ? (settings.durationMode === "auto"
      ? clamp(Math.ceil(highlightsNaturalMs / 1_000) * 1_000, HIGHLIGHT_MIN_SECONDS * 1_000, HIGHLIGHT_MAX_SECONDS * 1_000)
      : clamp(settings.durationSeconds, HIGHLIGHT_MIN_SECONDS, HIGHLIGHT_MAX_SECONDS) * 1_000)
    : settings.durationMode === "auto"
      ? Math.min(MAX_NARRATED_VIDEO_SECONDS * 1_000, Math.ceil((continuous
        ? introMs + outroMs + beatsTotal
        : Math.max(getAutoDurationSeconds(totalDistanceKm) * 1_000, introMs + outroMs + beatsTotal / narrationShare)) / 1_000) * 1_000)
      : Math.min(MAX_VIDEO_SECONDS * 1_000, settings.durationSeconds * 1_000);
  const flyoverMs = Math.max(1_000, totalMs - introMs - outroMs);
  const narrationOverflow = highlights
    ? highlightsNaturalMs > totalMs + NARRATION_GAP_MS
    : beatsTotal > flyoverMs * (continuous ? 0.95 : 0.9);
  if (highlights) {
    // Every moment gets its narration time, stretched or squeezed so the reel hits its length;
    // the transits keep their fixed time (shortened only if they would take over 40 %).
    const transitBudgetMs = beatsTotal > 0 ? Math.min(transitTotalMs, flyoverMs * 0.4) : flyoverMs;
    const transitScale = transitTotalMs > 0 ? transitBudgetMs / transitTotalMs : 0;
    gapTransitMs.forEach((value, index) => { gapTransitMs[index] = value * transitScale; });
    const scale = beatsTotal > 0 ? (flyoverMs - transitBudgetMs) / beatsTotal : 1;
    beatNeeds = beatNeeds.map((value) => value * scale);
  } else if (beatsTotal > flyoverMs * narrationShare) {
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
  // Highlights: the moment's time spread over its whole span (terrain-weighted), each gap crossed
  // at a constant speed in its fixed transit time.
  const gapIndexAt = (distanceKm: number) => routeBeats.filter((beat) => beat.endKm <= distanceKm).length;
  const highlightDensities = () => intervals.map(({ beatIndex, middleKm, terrain: weight }) => {
    if (beatIndex >= 0) return terrainTotals[beatIndex] > 0 ? (beatNeeds[beatIndex] * weight) / terrainTotals[beatIndex] : 0;
    const gap = gapIndexAt(middleKm);
    return gapsKm[gap] > 0 ? (gapTransitMs[gap] ?? 0) / gapsKm[gap] : 0;
  });
  const densities = highlights ? highlightDensities() : continuous ? continuousDensities() : isolatedDensities();
  const spacingKm = samples.length > 1 ? totalDistanceKm / (samples.length - 1) : 1;
  // Highlights keep crisp edges (0.1 % of the route) so the dwell time does not leak into the jumps.
  const smoothingShare = highlights ? 0.001 : 0.0035;
  const smoothed = movingAverage(densities, Math.max(1, Math.round((totalDistanceKm * smoothingShare) / spacingKm)));

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
    narrationOverflow: (highlights || settings.durationMode === "manual") && narrationOverflow,
    clock: settings.dayNight ? clock : null,
    cameraTempo: highlights ? HIGHLIGHT_CAMERA_TEMPO : 1,
    cameraAverageBlend: highlights ? 0.1 : 0.7,
    hook: null,
    flyoverStartKm: 0,
  };
  if (hooked) {
    // The flyover starts where the time starts to flow (the end of the skipped run-up).
    let startIndex = 0;
    while (startIndex + 1 < cumulativeTimeFraction.length && cumulativeTimeFraction[startIndex + 1] <= 1e-9) startIndex += 1;
    timeline.flyoverStartKm = sampleDistancesKm[startIndex] ?? 0;
    const hardestBeat = highlights ? routeBeats.find((beat) => beat.id.startsWith("hl-hardestClimb-")) : undefined;
    const hardestSlope = highlights ? null : findHardestClimb(path);
    const subject = hardestBeat ?? hardestSlope ?? routeBeats[0] ?? { startKm: 0, endKm: Math.min(totalDistanceKm, 2) };
    // The time smoothing lets the flyover start a few samples before the first moment.
    const isFirst = Math.abs(subject.startKm - timeline.flyoverStartKm) < Math.max(0.3, totalDistanceKm * 0.005);
    // Approach at the speed the flyover has right after the hook, so the hand-over is seamless.
    const probeMs = Math.min(1_000, flyoverMs);
    const flyoverKmPerMs = (getDistanceAtFlyoverFraction(timeline, probeMs / flyoverMs) - timeline.flyoverStartKm) / Math.max(1, probeMs);
    timeline.hook = {
      startKm: subject.startKm,
      endKm: Math.max(subject.endKm, subject.startKm + 0.2),
      isFirst,
      approachKm: isFirst ? clamp(flyoverKmPerMs * introMs, 0, timeline.flyoverStartKm) : 0,
    };
  }

  const msAtDistance = (distanceKm: number) =>
    introMs + getFlyoverFractionAtDistance(timeline, clamp(distanceKm, 0, totalDistanceKm)) * flyoverMs;
  const flyoverEndMs = introMs + flyoverMs;
  const scheduled: ScheduledBeat[] = [];
  if (introBeat && introMs > 0) {
    const narrationMs = getNarrationMs(introBeat, durations);
    const narrationStartMs = hooked ? HOOK_NARRATION_START_MS : NARRATION_GAP_MS;
    scheduled.push({ ...introBeat, startMs: 0, endMs: introMs, narrationStartMs, narrationMs, subtitles: timeSubtitles(introBeat.narration, narrationStartMs, narrationMs, alignments[introBeat.id]) });
  }
  let voiceFreeAtMs = Math.max(introMs, hookVoiceEndMs);
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
      // After the hook the first caption arrives with the first moment, whatever the smoothing.
      startMs: Math.min(startMs, narrationStartMs, hooked && index === 0 ? introMs : Number.POSITIVE_INFINITY),
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
  const distanceKm = interpolateTable(timeline.cumulativeTimeFraction, timeline.sampleDistancesKm, clamp(fraction, 0, 1));
  return Math.max(timeline.flyoverStartKm ?? 0, distanceKm);
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
    distanceKm = timeline.flyoverStartKm ?? 0;
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

export const TOLD_SLOPE_FADE_MS = 400;

export type ToldSlope = { id: string; kind: "climb" | "descent"; startKm: number; endKm: number; opacity: number };

/**
 * The climb or descent being told: the leg of its caption ("km 12,4 → 15,1"), lit from the moment
 * the runner reaches its foot (the beat starts there) until the caption leaves, with short fades.
 */
export const getToldSlope = (frame: Pick<VideoFrameState, "phase" | "beat" | "timeMs">): ToldSlope | null => {
  const beat = frame.phase === "flyover" ? frame.beat : null;
  if (!beat || (beat.kind !== "climb" && beat.kind !== "descent") || beat.endKm <= beat.startKm) return null;
  const opacity = clamp(Math.min((frame.timeMs - beat.startMs) / TOLD_SLOPE_FADE_MS, (beat.endMs - frame.timeMs) / TOLD_SLOPE_FADE_MS), 0, 1);
  return { id: beat.id, kind: beat.kind, startKm: beat.startKm, endKm: beat.endKm, opacity };
};

/** Map lines of a told slope, split where the slope class changes, in the profile colours. */
export const buildToldSlopeGeoJson = (path: PreparedAnimationPath, startKm: number, endKm: number) => {
  const inside = path.samples.filter((sample) => sample.distanceKm > startKm && sample.distanceKm < endKm);
  const points = [getRoutePointAtDistance(path, startKm), ...inside, getRoutePointAtDistance(path, endKm)];
  const features: { type: "Feature"; properties: { color: string }; geometry: { type: "LineString"; coordinates: number[][] } }[] = [];
  let run: number[][] = [];
  let runColor: string | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const color = getSlopeClass(getGradeAtDistance(path, (from.distanceKm + to.distanceKm) / 2)).color;
    if (color !== runColor) {
      if (runColor && run.length > 1) features.push({ type: "Feature", properties: { color: runColor }, geometry: { type: "LineString", coordinates: run } });
      run = [[from.lon, from.lat]];
      runColor = color;
    }
    run.push([to.lon, to.lat]);
  }
  if (runColor && run.length > 1) features.push({ type: "Feature", properties: { color: runColor }, geometry: { type: "LineString", coordinates: run } });
  return { type: "FeatureCollection" as const, features };
};

export type ProfileShade = { fromKm: number; toKm: number; opacity: number };

/**
 * Dimming of the profile ahead of the cursor. The told slope ahead is left bright (its dimming
 * fades out with the highlight) so the profile shows what the voice is talking about.
 */
export const getProfileShades = (cursorKm: number, totalKm: number, told: ToldSlope | null, dim = 0.45): ProfileShade[] => {
  if (cursorKm >= totalKm) return [];
  if (!told || told.opacity <= 0 || told.endKm <= cursorKm) return [{ fromKm: cursorKm, toKm: totalKm, opacity: dim }];
  const litFrom = Math.max(cursorKm, told.startKm);
  return [
    { fromKm: cursorKm, toKm: litFrom, opacity: dim },
    { fromKm: litFrom, toKm: told.endKm, opacity: dim * (1 - told.opacity) },
    { fromKm: told.endKm, toKm: totalKm, opacity: dim },
  ].filter((shade) => shade.toKm > shade.fromKm && shade.opacity > 0);
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
  const tempo = timeline.cameraTempo ?? 1;
  HEADING_WINDOWS_MS.map((windowMs) => windowMs * tempo).forEach((windowMs) => {
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
  const windowMs = CAMERA_SPEED_WINDOW_MS * (timeline.cameraTempo ?? 1);
  const from = clamp(timeMs - windowMs, flyoverStart, flyoverEnd - windowMs * 2);
  const to = Math.min(flyoverEnd, from + windowMs * 2);
  if (to <= from) return timeline.averageSpeedMps;
  const distanceAt = (ms: number) => getDistanceAtFlyoverFraction(timeline, (ms - flyoverStart) / timeline.flyoverMs);
  const localMps = ((distanceAt(to) - distanceAt(from)) * 1_000) / ((to - from) / 1_000);
  // Mostly the average keeps the zoom from pumping on every speed change; a highlights reel wants
  // the opposite (close on a moment, pulled back during the jump), so it follows the local speed.
  const blend = timeline.cameraAverageBlend ?? 0.7;
  return blend * timeline.averageSpeedMps + (1 - blend) * localMps;
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
  const windowMs = Math.max(0, Math.min(TARGET_SMOOTHING_MS * (timeline.cameraTempo ?? 1), timeMs - flyoverStart, flyoverEnd - timeMs));
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

// Reel hook camera: a slow orbit (14 degrees over the hook) while it moves forward, then a glide
// into the chase camera over the last 45 % of the hook. The time smoothing of the whole flight
// rounds the hand-over off, so the first moment starts without a jump.
export const HOOK_ORBIT_DEG = 14;
const HOOK_HANDOVER_FROM = 0.55;
// Share of the subject the camera moves along when it is not where the flyover starts.
const HOOK_SUBJECT_ADVANCE = 0.2;

/** View distance of the hook: close on the subject (3 to 8 km, a quarter more in portrait). */
export const getHookViewDistanceM = (hook: HookPlan, viewport: AnimationViewport) =>
  clamp((hook.endKm - hook.startKm) * 900, 3_000, 8_000) * (viewport === "portrait" ? 1.25 : 1);

const getHookRawPose = (
  path: PreparedAnimationPath,
  timeline: VideoTimeline,
  hook: HookPlan,
  frame: VideoFrameState,
  viewport: AnimationViewport,
  chase: CameraPose,
): CameraPose => {
  const progress = clamp(frame.timeMs / Math.max(1, timeline.introMs), 0, 1);
  let distanceKm: number;
  let baseBearingDeg: number;
  if (hook.isFirst) {
    // Already moving towards the first moment, looking the way the chase camera will.
    distanceKm = (timeline.flyoverStartKm ?? hook.startKm) - hook.approachKm * (1 - progress);
    const eastM = (chase.target.lon - chase.camera.lon) * 111_320 * Math.cos((chase.camera.lat * Math.PI) / 180);
    const northM = (chase.target.lat - chase.camera.lat) * 111_320;
    baseBearingDeg = toBearingDeg(eastM, northM);
  } else {
    // A teaser of the hardest climb, in three-quarter view, before gliding to the first moment.
    distanceKm = hook.startKm + (hook.endKm - hook.startKm) * HOOK_SUBJECT_ADVANCE * progress;
    const from = getRoutePointAtDistance(path, hook.startKm);
    const to = getRoutePointAtDistance(path, hook.endKm);
    baseBearingDeg = toBearingDeg(
      (to.lon - from.lon) * 111_320 * Math.cos((from.lat * Math.PI) / 180),
      (to.lat - from.lat) * 111_320,
    ) + ORBIT_SIDE_OFFSET_DEG;
  }
  const hookPose = shiftIntoVisibleZone(getHookCameraPose(path, distanceKm, {
    bearingDeg: baseBearingDeg - HOOK_ORBIT_DEG * (1 - progress),
    viewDistanceM: getHookViewDistanceM(hook, viewport),
    terrainExaggeration: timeline.terrainExaggeration,
  }));
  return interpolateCameraPose(hookPose, chase, easeInOut((progress - HOOK_HANDOVER_FROM) / (1 - HOOK_HANDOVER_FROM)));
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
  if (frame.phase === "intro" && timeline.hook) return getHookRawPose(path, timeline, timeline.hook, frame, viewport, chase);
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

const smoothTrack = (track: CameraTrack, kernelOrAt: number[] | ((index: number) => number[])): CameraTrack => {
  const length = track.lat.length;
  const smoothed = createTrack(length);
  for (let index = 0; index < length; index += 1) {
    const kernel = typeof kernelOrAt === "function" ? kernelOrAt(index) : kernelOrAt;
    const radius = (kernel.length - 1) / 2;
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
  const sigmaMs = Math.max(CAMERA_TRACK_STEP_MS, CAMERA_TRACK_SIGMA_MS * (timeline.cameraTempo ?? 1));
  const kernel = buildGaussianKernel(sigmaMs);
  if (!timeline.hook || sigmaMs <= HOOK_TRACK_SIGMA_MS) return { camera: smoothTrack(camera, kernel), target: smoothTrack(target, kernel) };
  // A full flyover smooths over 1.8 s: during a 2.4 s hook that would average the hook shot with
  // the chase camera. The hook keeps the highlights smoothing, widened back to the full one over
  // the 3 s after it (kernels by 0.1-step of sigma, so the change is gradual).
  const kernels = new Map<number, number[]>();
  const kernelAt = (index: number) => {
    const ratio = easeInOut((index * CAMERA_TRACK_STEP_MS - timeline.introMs) / HOOK_TRACK_WIDEN_MS);
    const key = Math.round((HOOK_TRACK_SIGMA_MS + (sigmaMs - HOOK_TRACK_SIGMA_MS) * ratio) / 10);
    let cached = kernels.get(key);
    if (!cached) {
      cached = buildGaussianKernel(key * 10);
      kernels.set(key, cached);
    }
    return cached;
  };
  return { camera: smoothTrack(camera, kernelAt), target: smoothTrack(target, kernelAt) };
};

const HOOK_TRACK_SIGMA_MS = CAMERA_TRACK_SIGMA_MS * HIGHLIGHT_CAMERA_TEMPO;
const HOOK_TRACK_WIDEN_MS = 3_000;

function buildGaussianKernel(sigmaMs: number) {
  const radius = Math.ceil((sigmaMs * 3) / CAMERA_TRACK_STEP_MS);
  const sigma = sigmaMs / CAMERA_TRACK_STEP_MS;
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

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
