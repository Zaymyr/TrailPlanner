import { describe, expect, it } from "vitest";

import { buildHighlightBeats, selectHighlights } from "./highlights";
import { buildRaceFigures, toRouteAidStations } from "./race-figures";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import { prepareAnimationPath } from "./route-animation";
import { buildRaceClock } from "./route-clock";
import { buildStoryBeats, getCumulativeGainAt } from "./route-story";
import {
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  END_SCREEN_FONT_CQMIN,
  END_SCREEN_SIDE_PADDING_CQMIN,
  END_SCREEN_TEXT,
  HIGHLIGHT_MAX_SECONDS,
  MIN_OUTRO_MS,
  NARRATION_GAP_MS,
  OUTRO_HOLD_MS,
  OVERLAY_MIN_FONT_CQMIN,
  videoCompositionSettingsSchema,
  type VideoCompositionSettings,
} from "./video-composition";
import { getMixLengthSamples } from "./video-export";

const settings: VideoCompositionSettings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" };
const LONG_CTA = "Ton plan pour cette course est prêt dans l’appli Pace Yourself, avec le ravitaillement kilomètre par kilomètre, l’allure par section et la nutrition heure par heure. Lien en bio, télécharge-le avant le départ.";

const build = (fixture: typeof astragaleTrail, outroText?: string) => {
  const path = prepareAnimationPath(fixture.points);
  const figures = buildRaceFigures({
    raceDistanceKm: fixture.race.distanceKm,
    raceElevationGainM: fixture.race.elevationGainM,
    routeDistanceKm: path.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm),
  });
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const clock = buildRaceClock(path, stations, fixture.race);
  const highlights = selectHighlights(path, stations, clock, figures);
  const beats = buildHighlightBeats(highlights, path, fixture.race, { figures })
    .map((beat) => (outroText && beat.kind === "outro" ? { ...beat, narration: outroText } : beat));
  return { path, beats, timeline: buildVideoTimeline(path, beats, settings, {}, clock) };
};

/** End of the last voice clip of the reel (cue start plus its duration). */
const lastVoiceEndMs = (timeline: ReturnType<typeof build>["timeline"]) =>
  Math.max(...timeline.beats.filter((beat) => beat.narration.trim()).map((beat) => beat.narrationStartMs + beat.narrationMs));

describe("end screen timeline", () => {
  [astragaleTrail, ultraDesDruides].forEach((fixture) => {
    [undefined, LONG_CTA].forEach((cta) => {
      it(`never cuts the voice: ${fixture.race.title}${cta ? " with a long CTA" : ""}`, () => {
        const { timeline } = build(fixture, cta);
        const outro = timeline.beats.find((beat) => beat.kind === "outro");
        expect(outro).toBeDefined();
        expect(timeline.totalMs).toBeLessThanOrEqual(HIGHLIGHT_MAX_SECONDS * 1_000);
        expect(lastVoiceEndMs(timeline)).toBeLessThanOrEqual(timeline.totalMs - 500);
        // The audio buffer of the mix covers the whole video, voice included.
        expect((getMixLengthSamples(timeline.totalMs) / 48_000) * 1_000).toBeGreaterThanOrEqual(lastVoiceEndMs(timeline));
        // The card holds at least 2 s once the CTA is told.
        expect(timeline.totalMs - (outro!.narrationStartMs + outro!.narrationMs)).toBeGreaterThanOrEqual(OUTRO_HOLD_MS - 1);
        expect(timeline.outroMs).toBeGreaterThanOrEqual(MIN_OUTRO_MS);
      });
    });
  });

  it("uses the new fallback CTA text for the highlights outro", () => {
    const outro = build(astragaleTrail).beats.find((beat) => beat.kind === "outro");
    expect(outro?.narration).toBe("Ton plan pour cette course est prêt dans l’appli. Lien en bio.");
  });

  it("sizes the outro to the voice plus the hold, never under 2.5 s", () => {
    const path = prepareAnimationPath(astragaleTrail.points);
    const manual = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, durationMode: "manual" as const, durationSeconds: 45 };
    const beat = (narration: string) => ({ id: "outro", kind: "outro" as const, title: "", startKm: 20, endKm: 20, anchorKm: 20, facts: [], services: [], cutoffTime: null, narration });
    expect(buildVideoTimeline(path, [beat("")], manual).outroMs).toBe(MIN_OUTRO_MS);
    expect(buildVideoTimeline(path, [beat("Un texte.")], manual, { outro: 5_000 }).outroMs).toBe(NARRATION_GAP_MS + 5_000 + OUTRO_HOLD_MS);
  });

  it("keeps the full-mode CTA narration", () => {
    const path = prepareAnimationPath(astragaleTrail.points);
    const figures = buildRaceFigures({ raceDistanceKm: 66.63, raceElevationGainM: 2276, routeDistanceKm: path.totalDistanceKm, routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm) });
    const beats = buildStoryBeats(path, toRouteAidStations(figures, astragaleTrail.aidStations), astragaleTrail.race, { figures });
    expect(beats.find((beat) => beat.kind === "outro")?.narration).toContain("télécharge l’appli Pace Yourself");
  });
});

describe("end screen layout", () => {
  it("keeps every text readable and out of the Instagram right margin", () => {
    Object.values(END_SCREEN_FONT_CQMIN).forEach((size) => expect(size).toBeGreaterThanOrEqual(OVERLAY_MIN_FONT_CQMIN));
    expect(END_SCREEN_SIDE_PADDING_CQMIN).toBeGreaterThanOrEqual(15);
    expect(END_SCREEN_TEXT.pill).toBe("Lien en bio");
  });

  it("defaults the music setting to auto", () => {
    expect(videoCompositionSettingsSchema.parse({}).musicTrack).toBe("auto");
  });
});
