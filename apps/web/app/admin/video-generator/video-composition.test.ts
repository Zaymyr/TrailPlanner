import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import { buildStoryBeats, type StoryBeat } from "./route-story";
import {
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getDistanceAtFlyoverFraction,
  getFlyoverFractionAtDistance,
  getGradeAtDistance,
  getProfileTicks,
  getProfileWindow,
  getSlopeClass,
  getVideoCameraPose,
  getVideoFrameState,
  videoCompositionSettingsSchema,
} from "./video-composition";

const flatThenClimb: VideoRoutePoint[] = [
  { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
  { lat: 45.1, lon: 4, elevationM: 200, distanceKm: 10 },
  { lat: 45.2, lon: 4, elevationM: 2_200, distanceKm: 20 },
];

const station = (id: string, distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
  name: `Ravito ${id}`,
  distanceKm,
  waterAvailable: true,
  foodAvailable: false,
  assistanceAllowed: false,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

const flatPath = (km: number) => prepareAnimationPath([
  { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
  { lat: 45 + km / 111, lon: 4, elevationM: 200, distanceKm: km },
]);

describe("videoCompositionSettingsSchema", () => {
  it("provides publishable defaults and round-trips through JSON", () => {
    expect(DEFAULT_VIDEO_COMPOSITION_SETTINGS).toMatchObject({
      durationSeconds: 45,
      resolution: "540p",
      viewport: "portrait",
      introEnabled: true,
      outroEnabled: true,
      mapStyle: "paceyourself",
      routeColor: "#ff8a3d",
      accentColor: "#2d5016",
      routeWidth: "normal",
      routeGlow: false,
      showPeaks: true,
    });
    const restored = videoCompositionSettingsSchema.parse(JSON.parse(JSON.stringify(DEFAULT_VIDEO_COMPOSITION_SETTINGS)));
    expect(restored).toEqual(DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect(videoCompositionSettingsSchema.safeParse({ durationSeconds: 37 }).success).toBe(true);
    expect(videoCompositionSettingsSchema.safeParse({ durationSeconds: 10 }).success).toBe(false);
  });
});

const beat = (id: string, kind: StoryBeat["kind"], startKm: number, endKm: number, narration: string): StoryBeat => ({
  id, kind, title: id, startKm, endKm, anchorKm: startKm, facts: [], services: [], cutoffTime: null, narration,
});

const manual = (durationSeconds: number) => ({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, durationMode: "manual" as const, durationSeconds });

describe("buildVideoTimeline", () => {
  const path = prepareAnimationPath(flatThenClimb);

  it("sizes intro and outro to their narration and keeps a manual total", () => {
    const timeline = buildVideoTimeline(path, [beat("intro", "intro", 0, 0, "Court."), beat("outro", "outro", 20, 20, "")], manual(45));
    expect(timeline.introMs).toBe(3_000);
    expect(timeline.outroMs).toBe(3_000);
    expect(timeline.totalMs).toBe(45_000);
    const noSequences = buildVideoTimeline(path, [], { ...manual(45), introEnabled: false, outroEnabled: false });
    expect(noSequences.flyoverMs).toBe(45_000);

    const longIntro = buildVideoTimeline(path, [beat("intro", "intro", 0, 0, "x".repeat(120))], manual(45));
    expect(longIntro.introMs).toBeGreaterThan(8_000);
  });

  it("spends more time on the climb than on the flat half", () => {
    const timeline = buildVideoTimeline(path, [], manual(45));
    expect(getFlyoverFractionAtDistance(timeline, 10)).toBeLessThan(0.4);
    expect(getDistanceAtFlyoverFraction(timeline, 0)).toBe(0);
    expect(getDistanceAtFlyoverFraction(timeline, 1)).toBeCloseTo(20, 6);
  });

  it("gives a narrated span the time its voice needs and schedules the voice there", () => {
    const flat = flatPath(40);
    const narration = "Ravitaillement de Saint-Genou au kilomètre vingt : eau et nourriture.";
    const timeline = buildVideoTimeline(flat, [beat("aid", "aid", 19, 20.3, narration)], { ...manual(45), introEnabled: false, outroEnabled: false });
    const scheduled = timeline.beats[0];
    const spanMs = (getFlyoverFractionAtDistance(timeline, 20.3) - getFlyoverFractionAtDistance(timeline, 19)) * timeline.flyoverMs;
    // 1.3 km out of 40 km gets far more than its 3 % share of the time.
    expect(spanMs / timeline.flyoverMs).toBeGreaterThan(0.08);
    expect(scheduled.narrationStartMs).toBeCloseTo(scheduled.startMs, 0);
    expect(getVideoFrameState(timeline, scheduled.narrationStartMs + 100).beat?.id).toBe("aid");
    expect(getVideoFrameState(timeline, scheduled.endMs + 50).beat).toBeNull();
  });

  it("uses the real voice duration once generated", () => {
    const flat = flatPath(40);
    const beats = [beat("climb", "climb", 10, 14, "Texte.")];
    const estimated = buildVideoTimeline(flat, beats, manual(45));
    const voiced = buildVideoTimeline(flat, beats, manual(45), { climb: 6_000 });
    expect(voiced.beats[0].narrationMs).toBe(6_000);
    const share = (timeline: typeof voiced) => getFlyoverFractionAtDistance(timeline, 14) - getFlyoverFractionAtDistance(timeline, 10);
    expect(share(voiced)).toBeGreaterThan(share(estimated));
  });

  it("never overlaps two narrations", () => {
    const flat = flatPath(30);
    const long = "Une phrase volontairement longue pour occuper la voix plus longtemps que le segment.";
    const timeline = buildVideoTimeline(flat, [beat("a", "aid", 10, 10.2, long), beat("b", "aid", 10.2, 10.4, long)], manual(30));
    const [first, second] = timeline.beats.filter((scheduled) => scheduled.kind === "aid");
    expect(second.narrationStartMs).toBeGreaterThanOrEqual(first.narrationStartMs + first.narrationMs);
  });

  it("grows an automatic duration with the route and the narration, and flags a manual overflow", () => {
    const flat = flatPath(150);
    const story = buildStoryBeats(flat, [station("1", 50), station("2", 100, { isLifeBase: true })], { title: "Ultra", distanceKm: 150, elevationGainM: 6000, startDetail: null }, {
      targetSeconds: 90, includeAidStations: true, includeStart: false,
    });
    const auto = buildVideoTimeline(flat, story, DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect(auto.totalMs).toBeGreaterThanOrEqual(90_000);
    expect(auto.narrationOverflow).toBe(false);
    const short = buildVideoTimeline(flat, story.map((item) => ({ ...item, narration: item.narration.repeat(4) })), manual(15));
    expect(short.narrationOverflow).toBe(true);
  });
});

describe("getVideoFrameState", () => {
  const path = prepareAnimationPath(flatThenClimb);
  const timeline = buildVideoTimeline(path, [], manual(45));

  it("maps every moment to one deterministic phase and position", () => {
    expect(getVideoFrameState(timeline, 1_000)).toMatchObject({ phase: "intro", distanceKm: 0 });
    expect(getVideoFrameState(timeline, 44_000)).toMatchObject({ phase: "outro", distanceKm: 20, routeProgress: 1 });
    const middle = getVideoFrameState(timeline, 20_000);
    expect(middle.phase).toBe("flyover");
    expect(getVideoFrameState(timeline, 20_000)).toEqual(middle);
  });

  it("glides the camera from the overview to the start during the intro", () => {
    const start = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 0), "portrait");
    const glided = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 2_999), "portrait");
    const flyoverStart = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 3_000), "portrait");
    expect(start.camera.altitudeM).toBeGreaterThan(flyoverStart.camera.altitudeM);
    expect(glided.camera.lat).toBeCloseTo(flyoverStart.camera.lat, 3);
  });
});

describe("elevation profile", () => {
  it("colours every sample by slope class once per route", () => {
    const profile = buildElevationProfile(prepareAnimationPath(flatThenClimb));
    expect(profile.minElevationM).toBe(200);
    expect(profile.maxElevationM).toBe(2_200);
    const colors = new Set(profile.segments.map((segment) => segment.color));
    expect(colors.has(getSlopeClass(0).color)).toBe(true);
    expect(colors.has(getSlopeClass(0.2).color)).toBe(true);
    expect(profile.segments[0].linePath.startsWith("M0.0,")).toBe(true);
  });

  it("scrolls a window with the cursor at 35 % and clamps it to the route", () => {
    expect(getProfileWindow(100, 50, "window")).toEqual({ startKm: 50 - 18 * 0.35, endKm: 50 + 18 * 0.65 });
    expect(getProfileWindow(100, 1, "window")).toEqual({ startKm: 0, endKm: 18 });
    expect(getProfileWindow(100, 99, "window")).toEqual({ startKm: 82, endKm: 100 });
    expect(getProfileWindow(4, 2, "window")).toEqual({ startKm: 0, endKm: 4 });
    expect(getProfileWindow(100, 50, "full")).toEqual({ startKm: 0, endKm: 100 });
    expect(getProfileTicks({ startKm: 43.7, endKm: 61.7 })).toEqual([45, 50, 55, 60]);
  });

  it("measures the local grade around a distance", () => {
    const path = prepareAnimationPath(flatThenClimb);
    expect(getGradeAtDistance(path, 5)).toBeCloseTo(0, 6);
    expect(getGradeAtDistance(path, 15)).toBeCloseTo(0.2, 6);
  });
});
