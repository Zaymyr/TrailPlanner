import { describe, expect, it } from "vitest";

import { parseRenderSnapshot } from "./render-snapshot";
import {
  applyNarrationOverrides,
  assembleFullReelContent,
  buildInstagramCaptionRequest,
  buildNarrationScriptRequest,
  buildReelContentRequest,
  buildReelRenderSnapshot,
  buildReelSettings,
  freshClipsFor,
  getClimbTops,
  getReelStoryInput,
  getReelVideoSize,
  hasGpxElevations,
  prepareReelStory,
  type ReadyDetail,
} from "./reel-composition";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import { isCompactOverlayEnabled, isHookIntroEnabled, isTiltedCameraEnabled } from "./video-composition";

const toDetail = (fixture: typeof astragaleTrail, extra: { eventName: string; shortName?: string | null }): ReadyDetail => ({
  race: {
    id: "11111111-1111-4111-8111-111111111111",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventName: extra.eventName,
    eventShortName: extra.shortName ?? null,
    name: fixture.race.title,
    distanceKm: fixture.race.distanceKm,
    elevationGainM: fixture.race.elevationGainM,
    elevationLossM: null,
    editionYear: Number(fixture.race.raceDate.slice(0, 4)),
    raceDate: fixture.race.raceDate,
    startTime: fixture.race.startTime,
    startLocation: "Bibracte, Mont Beuvray",
  },
  aidStations: fixture.aidStations,
  gpx: {
    status: "ready",
    pointCount: fixture.points.length,
    bounds: {
      minLat: Math.min(...fixture.points.map((point) => point.lat)),
      minLon: Math.min(...fixture.points.map((point) => point.lon)),
      maxLat: Math.max(...fixture.points.map((point) => point.lat)),
      maxLon: Math.max(...fixture.points.map((point) => point.lon)),
    },
    points: fixture.points,
  },
});

const astragale = toDetail(astragaleTrail, { eventName: "Hivernale des Templiers" });
const druides = toDetail(ultraDesDruides, { eventName: "Bibracte Ultra-Trail", shortName: "Bibracte" });

const clipFor = (beatId: string, text: string) => ({ beatId, text, audioBase64: "AAAA", durationMs: 2_000, characterEndMs: Array.from(text, (_, index) => index * 50) });

describe("server reel composition", () => {
  it("uses the editor defaults with the mode's hook, light overlay and tilted camera", () => {
    const highlights = buildReelSettings("highlights");
    const full = buildReelSettings("full");
    expect(highlights.storyMode).toBe("highlights");
    expect([isHookIntroEnabled(highlights), isCompactOverlayEnabled(highlights), isTiltedCameraEnabled(highlights)]).toEqual([true, true, true]);
    expect([isHookIntroEnabled(full), isCompactOverlayEnabled(full), isTiltedCameraEnabled(full)]).toEqual([false, false, false]);
    expect(getReelVideoSize(highlights)).toEqual({ width: 540, height: 960 });
  });

  it("detects a GPX without any elevation (the editor would ask the terrain)", () => {
    expect(hasGpxElevations(astragale)).toBe(true);
    expect(hasGpxElevations({ ...astragale, gpx: { ...astragale.gpx, points: astragale.gpx.points.map((point) => ({ ...point, elevationM: null })) } })).toBe(false);
  });

  it("builds a valid highlights content request from the catalog race", () => {
    const settings = buildReelSettings("highlights");
    const story = prepareReelStory(getReelStoryInput(druides), settings, {});
    const request = buildReelContentRequest(story);
    expect(request.mode).toBe("highlights");
    expect(request.race.title).toBe("Bibracte Ultra-Trail 2026");
    expect(request.race.distanceKm).toBe(185);
    expect(request.shortName).toBe("Bibracte");
    expect(request.shockFigure).toBe("185 km");
    expect(request.beats[0].id).toBe("hl-intro");
    expect(request.beats.at(-1)?.id).toBe("hl-outro");
    expect(request.aidStations).toHaveLength(ultraDesDruides.aidStations.length);
  });

  it("builds a full script request with passages and a caption request", () => {
    const settings = buildReelSettings("full");
    const story = prepareReelStory(getReelStoryInput(astragale), settings, {});
    const script = buildNarrationScriptRequest(story, settings);
    expect(script.mode).toBe("full");
    expect(script.beats.length).toBeGreaterThan(2);
    expect(script.beats.some((beat) => beat.passages.length > 0)).toBe(true);
    const written = applyNarrationOverrides(story.beats, Object.fromEntries(story.beats.map((beat) => [beat.id, `Texte ${beat.id}.`])));
    const caption = buildInstagramCaptionRequest(story, written);
    expect(caption.legs).toHaveLength(story.beats.length);
    expect(caption.legs[0].narration).toBe(`Texte ${story.beats[0].id}.`);
  });

  it("assembles the stored content of a full reel", () => {
    const settings = buildReelSettings("full");
    const story = prepareReelStory(getReelStoryInput(astragale), settings, {});
    const written = applyNarrationOverrides(story.beats, Object.fromEntries(story.beats.map((beat) => [beat.id, `Phrase de ${beat.kind}. Suite.`])));
    const content = assembleFullReelContent({ beats: written, caption: "Légende ⛰️", hashtags: ["#Trail", "astragale"], coverText: "Astragale" });
    expect(content.hook).toBe("Phrase de intro.");
    expect(content.cta).toBe("Phrase de outro. Suite.");
    expect(content.script_segments).toHaveLength(story.beats.length);
    expect(content.hashtags).toEqual(["trail", "astragale"]);
    expect(content.cover_text).toBe("Astragale");
  });

  it.each([["highlights" as const, druides], ["full" as const, astragale]])("round-trips a %s snapshot that the render page replays identically", (mode, detail) => {
    const settings = buildReelSettings(mode);
    const landmarks = Object.fromEntries(getClimbTops(prepareReelStory(getReelStoryInput(detail), settings, {}).path).slice(0, 2).map((top) => [top.slopeId, `Mont ${top.slopeId}`]));
    const story = prepareReelStory(getReelStoryInput(detail), settings, landmarks);
    const overrides = Object.fromEntries(story.beats.map((beat) => [beat.id, `Voix ${beat.id}.`]));
    const written = applyNarrationOverrides(story.beats, overrides);
    const clips = freshClipsFor(written, Object.fromEntries(written.map((beat) => [beat.id, clipFor(beat.id, beat.narration)])));
    expect(clips).toHaveLength(written.length);

    const snapshot = buildReelRenderSnapshot({ detail, settings, narrationOverrides: overrides, landmarks, placeNames: { start: "Bibracte", finish: "Bibracte" }, voiceClips: clips });
    // Stored as JSON in Cloud Storage, then parsed by the render page.
    const replayed = parseRenderSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(replayed.settings).toEqual(settings);
    expect(replayed.previewSize).toEqual({ width: 405, height: 720 });
    expect(replayed.voiceClips).toHaveLength(clips.length);

    // The render page derives the story from the snapshot alone: same beats, every clip still fresh.
    const replayedStory = prepareReelStory({ race: replayed.race, points: replayed.points, aidStations: replayed.aidStations }, replayed.settings, replayed.landmarks);
    expect(replayedStory.beats.map((beat) => beat.id)).toEqual(story.beats.map((beat) => beat.id));
    const replayedBeats = applyNarrationOverrides(replayedStory.beats, replayed.narrationOverrides);
    expect(freshClipsFor(replayedBeats, Object.fromEntries(replayed.voiceClips.map((clip) => [clip.beatId, clip])))).toHaveLength(clips.length);
  });
});
