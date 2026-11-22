import { describe, expect, it } from "vitest";

import { getPitchBearing } from "./camera-controller";
import { buildHighlightBeats, selectHighlights } from "./highlights";
import { buildRaceFigures, toRouteAidStations } from "./race-figures";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import {
  getHookOverlayState,
  getHookTextBottomPx,
  getReelFormatName,
  getReelShortName,
  getShockFigureFontCqmin,
  HOOK_FIGURE_MIN_CQMIN,
  HOOK_INTRO_MS,
  HOOK_NAME_CQMIN,
  HOOK_RIGHT_RATIO,
  HOOK_SAFE_BOTTOM_RATIO,
  pickShockFigure,
} from "./reel-hook";
import { getOverviewCameraPose, getRoutePointAtDistance, prepareAnimationPath, type CameraPose } from "./route-animation";
import { buildRaceClock } from "./route-clock";
import { buildStoryBeats, getCumulativeGainAt } from "./route-story";
import {
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getRawVideoCameraPose,
  getVideoCameraPose,
  getVideoFrameState,
  HIGHLIGHT_MAX_SECONDS,
  isHookIntroEnabled,
  MIN_SEQUENCE_MS,
  NARRATION_GAP_MS,
  videoCompositionSettingsSchema,
  type VideoCompositionSettings,
} from "./video-composition";

const METERS_PER_DEGREE_LAT = 111_320;
const groundDistanceM = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) =>
  Math.hypot(
    (to.lon - from.lon) * METERS_PER_DEGREE_LAT * Math.cos((from.lat * Math.PI) / 180),
    (to.lat - from.lat) * METERS_PER_DEGREE_LAT,
  );
const poseDistanceM = (left: CameraPose, right: CameraPose) =>
  Math.hypot(groundDistanceM(left.camera, right.camera), left.camera.altitudeM - right.camera.altitudeM);

describe("getReelShortName", () => {
  it("drops the year of the edition", () => {
    expect(getReelShortName("Hivernale des Templiers 2026")).toBe("Hivernale des Templiers");
  });

  it("drops legal marks and keeps hyphenated words", () => {
    expect(getReelShortName("Bibracte Ultra-Trail® 2026")).toBe("Bibracte Ultra-Trail");
    expect(getReelShortName("Trail Blanc™ ©")).toBe("Trail Blanc");
  });

  it("drops sponsor suffixes and trailing sponsor segments", () => {
    expect(getReelShortName("Trail des Lacs by Salomon 2026")).toBe("Trail des Lacs");
    expect(getReelShortName("Ultra du Vercors powered by Garmin")).toBe("Ultra du Vercors");
    expect(getReelShortName("Grand Raid des Cathares présenté par Crédit Mutuel")).toBe("Grand Raid des Cathares");
    expect(getReelShortName("Trail de la Sainte-Victoire avec Decathlon")).toBe("Trail de la Sainte-Victoire");
    expect(getReelShortName("Les Crêtes du Jura - Raidlight")).toBe("Les Crêtes du Jura");
    expect(getReelShortName("Les Crêtes du Jura | Raidlight")).toBe("Les Crêtes du Jura");
  });

  it("drops edition markers", () => {
    expect(getReelShortName("10e édition du Trail des Forts")).toBe("du Trail des Forts");
    expect(getReelShortName("Trail des Forts - 5ème édition")).toBe("Trail des Forts");
    expect(getReelShortName("Trail des Forts (Édition 2026)")).toBe("Trail des Forts");
  });

  it("lets an explicit short name win", () => {
    expect(getReelShortName("Hivernale des Templiers 2026", "Hivernale")).toBe("Hivernale");
    expect(getReelShortName("Hivernale des Templiers 2026", "  ")).toBe("Hivernale des Templiers");
    expect(getReelShortName("Hivernale des Templiers 2026", null)).toBe("Hivernale des Templiers");
  });

  it("never truncates and never adds an ellipsis", () => {
    const long = "Grand Trail des Montagnes du Haut-Languedoc et des Monts de Lacaune 2026";
    const name = getReelShortName(long);
    expect(name).toBe("Grand Trail des Montagnes du Haut-Languedoc et des Monts de Lacaune");
    expect(name).not.toContain("…");
    expect(getReelShortName("Trail des Templ…")).not.toContain("…");
    expect(getReelShortName("X", "Court…")).toBe("Court");
    // Nothing left after cleaning: the cleaned original is kept.
    expect(getReelShortName("2026")).toBe("2026");
  });
});

const fixtureFigures = (fixture: typeof astragaleTrail) => {
  const path = prepareAnimationPath(fixture.points);
  return buildRaceFigures({
    raceDistanceKm: fixture.race.distanceKm,
    raceElevationGainM: fixture.race.elevationGainM,
    routeDistanceKm: path.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm),
  });
};

describe("pickShockFigure", () => {
  it("shows the D+ of a hilly race under 100 km (Astragale Trail, 34 m/km)", () => {
    expect(pickShockFigure(fixtureFigures(astragaleTrail))).toEqual({ kind: "elevationGain", value: "2 276", unit: "m D+", text: "2 276 m D+" });
  });

  it("shows the distance of an ultra (L'Ultra des Druides, 185 km)", () => {
    expect(pickShockFigure(fixtureFigures(ultraDesDruides))).toEqual({ kind: "distance", value: "185", unit: "km", text: "185 km" });
  });

  it("shows the distance of a flat race and handles missing figures", () => {
    const flat = buildRaceFigures({ raceDistanceKm: 42.2, raceElevationGainM: 400, routeDistanceKm: 42, routeElevationGainM: 380 });
    expect(pickShockFigure(flat)?.text).toBe("42 km");
    const noGain = buildRaceFigures({ raceDistanceKm: 8.5, raceElevationGainM: null, routeDistanceKm: 8.4, routeElevationGainM: 0 });
    expect(pickShockFigure(noGain)?.text).toBe("8,5 km");
    expect(pickShockFigure(buildRaceFigures({ raceDistanceKm: null, raceElevationGainM: null, routeDistanceKm: 0, routeElevationGainM: 0 }))).toBeNull();
  });

  it("keeps the figure on one line at 14 cqmin or more", () => {
    ["5 520", "185", "10 000", "8,5"].forEach((value) => {
      const font = getShockFigureFontCqmin({ value, unit: "m D+" });
      expect(font).toBeGreaterThanOrEqual(HOOK_FIGURE_MIN_CQMIN);
      // Estimated width (0.62 em per glyph, unit at 55 %) inside the 79 cqmin safe column.
      expect(font * (value.length * 0.62 + 0.25 + 4 * 0.62 * 0.55)).toBeLessThanOrEqual(79);
    });
  });
});

describe("hook overlay timing and layout", () => {
  it("shows the figure from frame 0 and brings the name in between 0.5 and 1.0 s", () => {
    expect(HOOK_INTRO_MS).toBeLessThanOrEqual(2_500);
    expect(getHookOverlayState(0).figureOpacity).toBe(1);
    expect(getHookOverlayState(0).nameOpacity).toBe(0);
    expect(getHookOverlayState(0).chromeOpacity).toBe(0);
    expect(getHookOverlayState(499).nameOpacity).toBe(0);
    expect(getHookOverlayState(700).nameOpacity).toBeGreaterThan(0);
    expect(getHookOverlayState(1_000).nameOpacity).toBe(1);
    expect(getHookOverlayState(1_000).nameOffsetCqmin).toBe(0);
    // Gone when the hook ends, the regular chrome back.
    expect(getHookOverlayState(HOOK_INTRO_MS).figureOpacity).toBe(0);
    expect(getHookOverlayState(HOOK_INTRO_MS).chromeOpacity).toBe(1);
  });

  it("stays inside the Instagram safe zone with text of 32 px or more", () => {
    expect(getHookTextBottomPx()).toBeLessThan(1_500);
    expect(HOOK_SAFE_BOTTOM_RATIO * 1_920).toBe(1_570);
    expect(HOOK_RIGHT_RATIO).toBeLessThanOrEqual(0.87);
    // cqmin = 10.8 px at 1080 px wide.
    expect(HOOK_NAME_CQMIN * 10.8).toBeGreaterThanOrEqual(32);
    expect(HOOK_FIGURE_MIN_CQMIN * 10.8).toBeGreaterThanOrEqual(32);
  });
});

// The hook is opt-in since 2026-11-22 (reels open on the overview): these tests turn it on.
const highlightsSettings: VideoCompositionSettings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights", hookIntro: true };

const buildReel = (fixture: typeof astragaleTrail, settings = highlightsSettings) => {
  const path = prepareAnimationPath(fixture.points);
  const figures = fixtureFigures(fixture);
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const clock = buildRaceClock(path, stations, fixture.race);
  const highlights = selectHighlights(path, stations, clock, figures);
  const beats = buildHighlightBeats(highlights, path, fixture.race, { figures });
  return { path, highlights, beats, timeline: buildVideoTimeline(path, beats, settings, {}, clock) };
};

const pitchAt = (pose: CameraPose) => getPitchBearing(pose).pitch;

describe("hook in highlights mode", () => {
  it("is off unless set explicitly, in both modes", () => {
    expect(DEFAULT_VIDEO_COMPOSITION_SETTINGS.hookIntro).toBeNull();
    expect(isHookIntroEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" })).toBe(false);
    expect(isHookIntroEnabled(highlightsSettings)).toBe(true);
    expect(isHookIntroEnabled(DEFAULT_VIDEO_COMPOSITION_SETTINGS)).toBe(false);
    expect(isHookIntroEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, hookIntro: true })).toBe(true);
    expect(isHookIntroEnabled({ ...highlightsSettings, hookIntro: false })).toBe(false);
    expect(isHookIntroEnabled({ ...highlightsSettings, introEnabled: false })).toBe(false);
    // Saved settings from before the hook parse to the automatic value.
    expect(videoCompositionSettingsSchema.parse({ storyMode: "highlights" }).hookIntro).toBeNull();
  });

  [astragaleTrail, ultraDesDruides].forEach((fixture) => {
    it(`${fixture.race.title}: keeps the reel in 30-45 s and starts the first caption by 2.5 s`, () => {
      const { timeline, highlights } = buildReel(fixture);
      expect(timeline.introMs).toBe(HOOK_INTRO_MS);
      expect(timeline.totalMs).toBeGreaterThanOrEqual(30_000);
      expect(timeline.totalMs).toBeLessThanOrEqual(45_000);
      expect(timeline.totalMs).toBeLessThanOrEqual(HIGHLIGHT_MAX_SECONDS * 1_000);
      expect(timeline.narrationOverflow).toBe(false);
      const first = timeline.beats.find((beat) => beat.id === highlights[0].id)!;
      expect(first.startMs).toBeLessThanOrEqual(2_500);
      // The hook voice starts at once; the first moment speaks only once it has finished.
      const intro = timeline.beats.find((beat) => beat.id === "hl-intro")!;
      expect(intro.narrationStartMs).toBeLessThan(500);
      expect(first.narrationStartMs).toBeGreaterThanOrEqual(intro.narrationStartMs + intro.narrationMs);
      // No run-up from the start line: the flyover begins on the first moment.
      expect(getVideoFrameState(timeline, timeline.introMs + 50).distanceKm).toBeGreaterThanOrEqual(highlights[0].startKm - 0.3);
    });

    it(`${fixture.race.title}: the camera already flies a tilted 3D shot of the hook subject at t = 0`, () => {
      const { path, timeline, highlights } = buildReel(fixture);
      const hook = timeline.hook!;
      const subject = highlights.find((highlight) => highlight.kind === "hardestClimb") ?? highlights[0];
      expect(hook.startKm).toBeCloseTo(subject.startKm, 5);
      const start = getVideoCameraPose(path, timeline, { timeMs: 0 }, "portrait");
      expect(pitchAt(start)).toBeGreaterThanOrEqual(55);
      expect(pitchAt(start)).toBeLessThanOrEqual(60);
      // Aimed at the subject (within the visible-zone shift), not at the route's centre.
      const nearest = Math.min(...path.samples
        .filter((sample) => sample.distanceKm >= hook.startKm - hook.approachKm - 0.5 && sample.distanceKm <= hook.endKm)
        .map((sample) => groundDistanceM(start.target, sample)));
      expect(nearest).toBeLessThan(2_000);
      const overview = getOverviewCameraPose(path, "portrait", timeline.terrainExaggeration);
      expect(poseDistanceM(start, overview)).toBeGreaterThan(5_000);
      expect(Math.abs(pitchAt(overview) - pitchAt(start))).toBeGreaterThan(10);
      // Moving from frame 0.
      expect(poseDistanceM(start, getVideoCameraPose(path, timeline, { timeMs: 500 }, "portrait"))).toBeGreaterThan(20);
    });

    it(`${fixture.race.title}: flows into the first moment without a jump`, () => {
      const { path, timeline } = buildReel(fixture);
      const step = 100;
      const steps: number[] = [];
      const pitchSteps: number[] = [];
      for (let timeMs = 0; timeMs + step <= timeline.introMs + 3_000; timeMs += step) {
        const pose = getVideoCameraPose(path, timeline, { timeMs }, "portrait");
        const next = getVideoCameraPose(path, timeline, { timeMs: timeMs + step }, "portrait");
        steps.push(poseDistanceM(pose, next));
        pitchSteps.push(Math.abs(pitchAt(next) - pitchAt(pose)));
      }
      // Around the hand-over each 100 ms step is a fraction of the camera distance (no cut).
      const aroundHandOver = steps.slice(Math.floor((timeline.introMs - 600) / step), Math.ceil((timeline.introMs + 600) / step));
      const limitM = timeline.hook!.isFirst ? 800 : 4_000;
      expect(Math.max(...aroundHandOver)).toBeLessThan(limitM);
      // No step is more than three times its neighbour average: the motion is continuous.
      steps.slice(1, -1).forEach((value, index) => {
        expect(value).toBeLessThan(Math.max(150, 3 * (steps[index] + steps[index + 2]) / 2));
      });
      expect(Math.max(...pitchSteps)).toBeLessThan(4);
    });
  });

  it("targets the first moment directly when it is the hardest climb (Astragale Trail)", () => {
    const { timeline, highlights } = buildReel(astragaleTrail);
    expect(highlights[0].kind).toBe("hardestClimb");
    expect(timeline.hook?.isFirst).toBe(true);
  });
});

describe("full mode", () => {
  const fullReel = (settings: VideoCompositionSettings) => {
    const path = prepareAnimationPath(astragaleTrail.points);
    const figures = fixtureFigures(astragaleTrail);
    const beats = buildStoryBeats(path, toRouteAidStations(figures, astragaleTrail.aidStations), astragaleTrail.race, { figures });
    return { path, timeline: buildVideoTimeline(path, beats, settings) };
  };

  it("keeps the overview intro when the hook is off", () => {
    const auto = fullReel(DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    const off = fullReel({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, hookIntro: false });
    expect(auto.timeline.hook).toBeNull();
    expect(off.timeline.totalMs).toBe(auto.timeline.totalMs);
    expect(off.timeline.cumulativeTimeFraction).toEqual(auto.timeline.cumulativeTimeFraction);
    const intro = auto.timeline.beats.find((beat) => beat.kind === "intro")!;
    expect(auto.timeline.introMs).toBe(Math.max(MIN_SEQUENCE_MS, intro.narrationMs + NARRATION_GAP_MS * 2));
    expect(intro.narrationStartMs).toBe(NARRATION_GAP_MS);
    // Frame 0 is still the north-up overview, held before gliding to the start.
    const raw = getRawVideoCameraPose(auto.path, auto.timeline, getVideoFrameState(auto.timeline, 0), "portrait");
    expect(raw).toEqual(getOverviewCameraPose(auto.path, "portrait", auto.timeline.terrainExaggeration));
    expect(getVideoFrameState(auto.timeline, 0).distanceKm).toBe(0);
  });

  it("opens on the hardest climb when the hook is switched on", () => {
    const on = fullReel({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, hookIntro: true });
    expect(on.timeline.introMs).toBe(HOOK_INTRO_MS);
    expect(on.timeline.hook).not.toBeNull();
    const start = getVideoCameraPose(on.path, on.timeline, { timeMs: 0 }, "portrait");
    expect(pitchAt(start)).toBeGreaterThanOrEqual(55);
    expect(pitchAt(start)).toBeLessThanOrEqual(60);
    const subjectPoint = getRoutePointAtDistance(on.path, on.timeline.hook!.startKm);
    expect(groundDistanceM(start.target, subjectPoint)).toBeLessThan(3_000);
  });
});

describe("getReelFormatName", () => {
  it("names the format when it has its own name, without the event part or the distance", () => {
    expect(getReelFormatName("Marathon de l'Orchis", "Hivernale des Templiers")).toBe("Marathon de l'Orchis");
    expect(getReelFormatName("Bariloche Patagonia by UTMB - TRONADOR 130K", "Patagonia BARILOCHE by UTMB")).toBe("TRONADOR");
    expect(getReelFormatName("Chiangmai Thailand by UTMB® - PAGODA 50-DAY", "HOKA Chiang Mai Thailand by UTMB®")).toBe("PAGODA 50-DAY");
    expect(getReelFormatName("Ultra-Trail Kosciuszko by UTMB - Kosci50", "Ultra-Trail Kosciuszko by UTMB")).toBe("Kosci50");
  });

  it("keeps a distance that is part of the name", () => {
    expect(getReelFormatName("Combiné 15 + 23 km", "Les Foulées de Coursac")).toBe("Combiné 15 + 23 km");
  });

  it("falls back to the event alone for a generic or repeated name", () => {
    expect(getReelFormatName("Trail 23 km", "Les Foulées de Coursac")).toBeNull();
    expect(getReelFormatName("Trail du Soleil Levens — 60 km", "Trail du Soleil Levens")).toBeNull();
    expect(getReelFormatName("SaintéLyon", "ASICS SaintéLyon")).toBeNull();
    expect(getReelFormatName("Course 15 km", "Boucles de l’Oison")).toBeNull();
  });

  it("keeps the event and format lines inside the safe zone", () => {
    expect(getHookTextBottomPx()).toBeLessThan(1920 * HOOK_SAFE_BOTTOM_RATIO);
  });
});
