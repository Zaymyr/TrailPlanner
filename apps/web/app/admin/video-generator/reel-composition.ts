import { assembleReelContent, type ReelContent } from "../../../lib/reel-content";
import type { VideoAidStation, VideoGeneratorDetail, VideoRoutePoint } from "../../../lib/video-generator";
import {
  instagramCaptionRequestSchema,
  narrationScriptRequestSchema,
  reelContentRequestSchema,
  type InstagramCaptionRequest,
  type NarrationScriptRequest,
  type ReelContentRequest,
} from "../../../lib/video-narration";
import { buildHighlightBeats, selectHighlights } from "./highlights";
import type { NarrationClip } from "./narration-player";
import type { EndpointNames } from "./place-labels";
import {
  buildRaceFigures,
  getAnnouncedElevationGainM,
  roundKm,
  roundTotalKm,
  toAnnouncedKm,
  toRouteAidStations,
  type RaceFigures,
} from "./race-figures";
import { pickShockFigure } from "./reel-hook";
import { parseRenderSnapshot, type VideoRenderSnapshot } from "./render-snapshot";
import { getRoutePointAtDistance, prepareAnimationPath, type PreparedAnimationPath } from "./route-animation";
import { buildRaceClock, getDaylightAt, type RaceClock } from "./route-clock";
import {
  buildStoryBeats,
  detectRouteSlopes,
  getAutoDurationSeconds,
  getCumulativeGainAt,
  getSlopeId,
  type StoryBeat,
  type StoryLandmarks,
} from "./route-story";
import {
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getLegPassages,
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_MIN_SECONDS,
  HIGHLIGHT_TARGET_SECONDS,
  VIDEO_RESOLUTIONS,
  withStoryMode,
  type VideoCompositionSettings,
} from "./video-composition";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";
import { buildVideoRaceInfo } from "./video-race-info";

/**
 * The reel composition without the editor: the same pure modules and the same derivations as
 * VideoGeneratorMapClient (figures, beats, writer requests, render snapshot), so a reel built on the
 * server (automatic pipeline) replays on the render page exactly like one built in the browser.
 * Any change to how the editor derives these must be mirrored here (see reel-composition.test.ts).
 */

export type ReelStoryMode = VideoCompositionSettings["storyMode"];

/** The editor's voice defaults: expressive and lively (StoryEditor « v3 », 0.9). */
export const REEL_DEFAULT_VOICE_OPTIONS = { model: "v3", expressiveness: 0.9 } as const;

/** CSS size of the editor's preview frame on a 1080p screen (export-frame.ts default). */
export const REEL_DEFAULT_PREVIEW_SIZE = { width: 405, height: 720 };

/** Default composition of an automatic reel: the editor defaults in the given story mode. */
export const buildReelSettings = (mode: ReelStoryMode): VideoCompositionSettings =>
  withStoryMode(DEFAULT_VIDEO_COMPOSITION_SETTINGS, mode);

export type ReadyDetail = VideoGeneratorDetail & { gpx: Extract<VideoGeneratorDetail["gpx"], { status: "ready" }> };

export const isReadyDetail = (detail: VideoGeneratorDetail): detail is ReadyDetail => detail.gpx.status === "ready";

/** The terrain fills missing GPX elevations in the editor only; without any, the server cannot match it. */
export const hasGpxElevations = (detail: ReadyDetail) =>
  detail.gpx.points.some((point) => typeof point.elevationM === "number" && Number.isFinite(point.elevationM));

export type ReelStory = {
  race: VideoRaceInfo;
  path: PreparedAnimationPath;
  figures: RaceFigures;
  enabledAidStations: ReturnType<typeof toRouteAidStations>;
  raceClock: RaceClock | null;
  maxSeconds: number;
  /** Default beats (texts not yet written), as the editor computes them. */
  beats: StoryBeat[];
};

/** What the editor (and the render page, from a snapshot) derives the story from. */
export type ReelStoryInput = { race: VideoRaceInfo; points: VideoRoutePoint[]; aidStations: VideoAidStation[] };

export const getReelStoryInput = (detail: ReadyDetail): ReelStoryInput => ({
  race: buildVideoRaceInfo(detail),
  points: detail.gpx.points,
  aidStations: detail.aidStations,
});

/** Figures, stations, clock, length and default beats: the editor's memos in the same order. */
export const prepareReelStory = ({ race, points, aidStations }: ReelStoryInput, settings: VideoCompositionSettings, landmarks: StoryLandmarks): ReelStory => {
  const path = prepareAnimationPath(points);
  const figures = buildRaceFigures({
    raceDistanceKm: race.distanceKm,
    raceElevationGainM: race.elevationGainM,
    routeDistanceKm: path.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm),
  });
  const routeAidStations = toRouteAidStations(figures, aidStations);
  const disabled = new Set(settings.disabledAidStationIds);
  const enabledAidStations = routeAidStations.filter((station) => !disabled.has(station.id));
  const isHighlights = settings.storyMode === "highlights";
  const autoDurationSeconds = isHighlights ? HIGHLIGHT_TARGET_SECONDS : getAutoDurationSeconds(path.totalDistanceKm);
  const maxSeconds = settings.durationMode === "auto"
    ? autoDurationSeconds
    : isHighlights ? Math.min(HIGHLIGHT_MAX_SECONDS, Math.max(HIGHLIGHT_MIN_SECONDS, settings.durationSeconds)) : settings.durationSeconds;
  const raceClock = buildRaceClock(path, enabledAidStations, race);
  const activeClock = settings.dayNight ? raceClock : null;
  const beats = isHighlights
    ? buildHighlightBeats(
      selectHighlights(path, settings.showAidStations ? enabledAidStations : [], raceClock, figures, { landmarks }),
      path,
      race,
      { figures, landmarks },
    )
    : buildStoryBeats(path, enabledAidStations, race, {
      maxSeconds,
      includeAidStations: settings.showAidStations,
      includeStart: settings.showStartInfo,
      landmarks,
      daylightAt: (distanceKm: number) => (activeClock ? getDaylightAt(activeClock, distanceKm) : null),
      figures,
    });
  return { race, path, figures, enabledAidStations, raceClock, maxSeconds, beats };
};

/** Top of each of the 8 biggest climbs, where the editor looks for a summit name. */
export const getClimbTops = (path: PreparedAnimationPath) =>
  detectRouteSlopes(path)
    .filter((slope) => slope.kind === "climb")
    .slice(0, 8)
    .map((climb) => {
      const top = getRoutePointAtDistance(path, climb.endKm);
      return { slopeId: getSlopeId(climb), lon: top.lon, lat: top.lat };
    });

/** Start and finish points of the route, for the map labels. */
export const getEndpoints = (path: PreparedAnimationPath) => ({
  start: getRoutePointAtDistance(path, 0),
  finish: getRoutePointAtDistance(path, path.totalDistanceKm),
});

/** The beats with their written texts (overrides by beat id). */
export const applyNarrationOverrides = (beats: StoryBeat[], overrides: Record<string, string>) =>
  beats.map((beat) => (overrides[beat.id] !== undefined ? { ...beat, narration: overrides[beat.id] } : beat));

/** A clip only counts while its text still matches the narration it was generated from. */
export const freshClipsFor = (beats: Array<{ id: string; narration: string }>, clips: Record<string, NarrationClip>) =>
  beats.flatMap((beat) => (clips[beat.id]?.text === beat.narration ? [clips[beat.id]] : []));

const announcedRace = (story: ReelStory) => ({
  title: story.race.title,
  subtitle: story.race.subtitle,
  distanceKm: roundTotalKm(story.figures.distanceKm),
  elevationGainM: getAnnouncedElevationGainM(story.figures),
});

const beatInputs = (story: ReelStory, beats: StoryBeat[], passages: (beat: StoryBeat) => Array<{ name: string; km: number; moment: number }>) =>
  beats.map((beat) => ({
    id: beat.id,
    kind: beat.kind,
    title: beat.title,
    facts: beat.facts,
    services: beat.services,
    cutoffTime: beat.cutoffTime,
    narration: beat.narration,
    // The writer only sees announced kilometres, like the captions and the badge.
    startKm: roundKm(toAnnouncedKm(story.figures, beat.startKm)),
    endKm: roundKm(toAnnouncedKm(story.figures, beat.endKm)),
    passages: passages(beat),
  }));

/** The editor's `/content` request of a highlights reel (no admin notes, random style, default pace). */
export const buildReelContentRequest = (story: ReelStory, voiceModel: "multilingual_v2" | "v3" = REEL_DEFAULT_VOICE_OPTIONS.model): ReelContentRequest =>
  reelContentRequestSchema.parse({
    mode: "highlights",
    race: { ...announcedRace(story), startDetail: story.race.startDetail, raceDate: story.race.raceDate ?? null },
    shortName: story.race.shortName ?? null,
    shockFigure: pickShockFigure(story.figures)?.text ?? null,
    aidStations: story.enabledAidStations.map((station) => ({
      name: station.name,
      km: roundKm(toAnnouncedKm(story.figures, station.distanceKm)),
      cutoffTime: station.cutoffTime ?? null,
    })),
    targetSeconds: story.maxSeconds,
    voiceModel,
    beats: beatInputs(story, story.beats, () => []),
  });

/**
 * The editor's `/script` request of a full reel: legs tell the stations they fly over, placed on
 * the timeline the editor has before any voice exists (no clip durations).
 */
export const buildNarrationScriptRequest = (
  story: ReelStory,
  settings: VideoCompositionSettings,
  voiceModel: "multilingual_v2" | "v3" = REEL_DEFAULT_VOICE_OPTIONS.model,
): NarrationScriptRequest => {
  const timeline = buildVideoTimeline(story.path, story.beats, settings, {}, story.raceClock, {});
  return narrationScriptRequestSchema.parse({
    mode: settings.storyMode,
    race: { ...announcedRace(story), startDetail: story.race.startDetail },
    targetSeconds: story.maxSeconds,
    voiceModel,
    beats: beatInputs(story, story.beats, (beat) => (beat.kind === "intro" || beat.kind === "outro"
      ? []
      : getLegPassages(timeline, { startKm: beat.startKm, endKm: beat.endKm }, story.enabledAidStations)
        .map((passage) => ({ ...passage, km: roundKm(toAnnouncedKm(story.figures, passage.km)) })))),
  });
};

/** The editor's `/caption` request of a full reel, from the written beats. */
export const buildInstagramCaptionRequest = (story: ReelStory, beats: StoryBeat[]): InstagramCaptionRequest =>
  instagramCaptionRequestSchema.parse({
    race: { ...announcedRace(story), startDetail: story.race.startDetail, raceDate: story.race.raceDate ?? null },
    legs: beats.map(({ kind, title, facts, narration }) => ({ kind, title, facts, narration })),
  });

const firstSentence = (text: string) => /^.*?[.!?…](?=\s|$)/su.exec(text.trim())?.[0] ?? text.trim();

/**
 * The reel text stored with a full automatic render, so its Instagram draft is pre-filled like a
 * highlights one: the written beats as segments, the intro's first sentence as the hook, the outro
 * as the call to action, and the caption written for it. The cover text is the short race name.
 */
export const assembleFullReelContent = ({ beats, caption, hashtags, coverText }: {
  beats: StoryBeat[];
  caption: string;
  hashtags: string[];
  coverText: string | null | undefined;
}): ReelContent => {
  const content = assembleReelContent({
    base: null,
    narrations: beats.map((beat) => ({ id: beat.id, text: beat.narration })),
    caption,
    hashtags,
    coverText: coverText ?? "",
  });
  const intro = beats.find((beat) => beat.kind === "intro")?.narration ?? "";
  const outro = beats.find((beat) => beat.kind === "outro")?.narration ?? "";
  return { ...content, hook: firstSentence(intro).slice(0, 300), cta: outro.trim().slice(0, 300) };
};

/** Video size of the settings, as `launchBackgroundRender` computes it. */
export const getReelVideoSize = (settings: VideoCompositionSettings) => {
  const base = VIDEO_RESOLUTIONS[settings.resolution];
  return settings.viewport === "portrait" ? { ...base } : { width: base.height, height: base.width };
};

/**
 * The render snapshot of a reel built without the editor, checked with the render page's own
 * parser so a server snapshot is accepted exactly like a browser one.
 */
export const buildReelRenderSnapshot = ({ detail, settings, narrationOverrides, landmarks, placeNames, voiceClips }: {
  detail: ReadyDetail;
  settings: VideoCompositionSettings;
  narrationOverrides: Record<string, string>;
  landmarks: StoryLandmarks;
  placeNames: EndpointNames;
  voiceClips: NarrationClip[];
}): VideoRenderSnapshot => parseRenderSnapshot({
  version: 1,
  race: buildVideoRaceInfo(detail),
  aidStations: detail.aidStations,
  bounds: detail.gpx.bounds,
  points: detail.gpx.points,
  settings,
  narrationOverrides,
  landmarks,
  placeNames,
  voiceClips,
  previewSize: settings.viewport === "portrait"
    ? REEL_DEFAULT_PREVIEW_SIZE
    : { width: REEL_DEFAULT_PREVIEW_SIZE.height, height: REEL_DEFAULT_PREVIEW_SIZE.width },
});
