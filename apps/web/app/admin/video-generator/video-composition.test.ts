import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import {
  AID_BUBBLE_APPROACH_SIGMAS,
  AID_BUBBLE_EXIT_SIGMAS,
  AID_LABEL_MIN_DURATION_MS,
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getDistanceAtFlyoverFraction,
  getFlyoverFractionAtDistance,
  getGradeAtDistance,
  getProfileTicks,
  getProfileWindow,
  getSlopeClass,
  getStopSigmaKm,
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
    expect(videoCompositionSettingsSchema.safeParse({ durationSeconds: 37 }).success).toBe(false);
  });
});

describe("buildVideoTimeline", () => {
  const path = prepareAnimationPath(flatThenClimb);

  it("splits 45 s into 3 s intro, 39 s flyover and 3 s outro", () => {
    const timeline = buildVideoTimeline(path, [], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect([timeline.introMs, timeline.flyoverMs, timeline.outroMs]).toEqual([3_000, 39_000, 3_000]);

    const noSequences = buildVideoTimeline(path, [], { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, introEnabled: false, outroEnabled: false });
    expect(noSequences.flyoverMs).toBe(45_000);
  });

  it("spends more time on the climb than on the flat half", () => {
    const timeline = buildVideoTimeline(path, [], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    // The flat first half goes by quickly, so half of the flyover time is already spent climbing.
    expect(getFlyoverFractionAtDistance(timeline, 10)).toBeLessThan(0.4);
    expect(getDistanceAtFlyoverFraction(timeline, 0.5)).toBeGreaterThan(10);
    expect(getDistanceAtFlyoverFraction(timeline, 0)).toBe(0);
    expect(getDistanceAtFlyoverFraction(timeline, 1)).toBeCloseTo(20, 6);
  });

  it("slows down around an enabled aid station but not a disabled one", () => {
    const flat = flatPath(20);
    const aid = station("1", 10);
    const withAid = buildVideoTimeline(flat, [aid], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    const disabled = buildVideoTimeline(flat, [aid], { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, disabledAidStationIds: [aid.id] });

    const timeAround = (timeline: typeof withAid) => {
      const enter = timeline.cumulativeTimeFraction[timeline.sampleDistancesKm.findIndex((km) => km >= 9.5)];
      const leave = timeline.cumulativeTimeFraction[timeline.sampleDistancesKm.findIndex((km) => km >= 10.5)];
      return leave - enter;
    };
    expect(timeAround(withAid)).toBeGreaterThan(timeAround(disabled) * 2);
    expect(disabled.aidLabels).toEqual([]);

    const lifeBase = buildVideoTimeline(flat, [station("1", 10, { isLifeBase: true })], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect(timeAround(lifeBase)).toBeGreaterThan(timeAround(withAid));
  });

  it("never stacks aid labels and drops a station that would be unreadable", () => {
    const flat = flatPath(55);
    const timeline = buildVideoTimeline(flat, [station("1", 20), station("2", 20.2), station("3", 40)], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect(timeline.aidLabels.map((label) => label.name)).toEqual(["Ravito 1", "Ravito 3"]);
    timeline.aidLabels.forEach((label, index) => {
      expect(label.endMs - label.startMs).toBeGreaterThanOrEqual(AID_LABEL_MIN_DURATION_MS);
      if (index > 0) expect(label.startMs).toBeGreaterThanOrEqual(timeline.aidLabels[index - 1].endMs);
    });
  });
});

describe("getVideoFrameState", () => {
  const path = prepareAnimationPath(flatThenClimb);
  const aid = station("1", 10);
  const timeline = buildVideoTimeline(path, [aid], DEFAULT_VIDEO_COMPOSITION_SETTINGS);

  it("maps every moment to one deterministic phase and position", () => {
    expect(getVideoFrameState(timeline, 1_000)).toMatchObject({ phase: "intro", distanceKm: 0 });
    expect(getVideoFrameState(timeline, 44_000)).toMatchObject({ phase: "outro", distanceKm: 20, routeProgress: 1 });
    const middle = getVideoFrameState(timeline, 20_000);
    expect(middle.phase).toBe("flyover");
    expect(getVideoFrameState(timeline, 20_000)).toEqual(middle);
  });

  it("opens the bubble on the approach and closes it just after the station", () => {
    const label = timeline.aidLabels[0];
    const arrival = timeline.aidStations[0].arrivalMs;
    const sigmaKm = getStopSigmaKm(timeline.totalDistanceKm);
    expect(getVideoFrameState(timeline, label.startMs).distanceKm).toBeCloseTo(10 - sigmaKm * AID_BUBBLE_APPROACH_SIGMAS, 3);
    expect(getVideoFrameState(timeline, label.endMs).distanceKm).toBeCloseTo(10 + sigmaKm * AID_BUBBLE_EXIT_SIGMAS, 3);
    expect(arrival - label.startMs).toBeGreaterThan(label.endMs - arrival);
    expect(getVideoFrameState(timeline, arrival).aidLabel).toMatchObject({ name: "Ravito 1", services: ["water"] });
    expect(getVideoFrameState(timeline, label.endMs + 1).aidLabel).toBeNull();
  });

  it("brakes before a station and speeds up again progressively after it", () => {
    const flat = buildVideoTimeline(flatPath(40), [station("1", 20)], { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, introEnabled: false, outroEnabled: false });
    const msPerKm = (fromKm: number, toKm: number) =>
      (getFlyoverFractionAtDistance(flat, toKm) - getFlyoverFractionAtDistance(flat, fromKm)) * flat.flyoverMs / (toKm - fromKm);
    const cruise = msPerKm(2, 4);
    expect(msPerKm(19.8, 20)).toBeGreaterThan(cruise * 6);
    // Same distance from the station: the exit is still slower than the approach (progressive re-acceleration).
    expect(msPerKm(21.5, 22)).toBeGreaterThan(msPerKm(18, 18.5));
  });

  it("announces the start with its place and time when provided", () => {
    const withStart = buildVideoTimeline(path, [], DEFAULT_VIDEO_COMPOSITION_SETTINGS, { detail: "Lyon · 28 novembre · 23:30" });
    expect(getVideoFrameState(withStart, 3_100).aidLabel).toMatchObject({ kind: "start", name: "Départ", detail: "Lyon · 28 novembre · 23:30" });
    const hidden = buildVideoTimeline(path, [], { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, showStartInfo: false }, { detail: "Lyon" });
    expect(hidden.aidLabels).toEqual([]);
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
