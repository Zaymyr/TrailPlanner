import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import {
  AID_LABEL_MIN_DURATION_MS,
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getDistanceAtFlyoverFraction,
  getFlyoverFractionAtDistance,
  getVideoCameraPose,
  getVideoFrameState,
  videoCompositionSettingsSchema,
} from "./video-composition";

const flatThenClimb: VideoRoutePoint[] = [
  { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
  { lat: 45.1, lon: 4, elevationM: 200, distanceKm: 10 },
  { lat: 45.2, lon: 4, elevationM: 2_200, distanceKm: 20 },
];

const station = (id: string, distanceKm: number): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
  name: `Ravito ${id}`,
  distanceKm,
});

describe("videoCompositionSettingsSchema", () => {
  it("provides publishable defaults and round-trips through JSON", () => {
    expect(DEFAULT_VIDEO_COMPOSITION_SETTINGS).toMatchObject({
      durationSeconds: 45,
      resolution: "540p",
      viewport: "portrait",
      introEnabled: true,
      outroEnabled: true,
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
    const flat = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
      { lat: 45.2, lon: 4, elevationM: 200, distanceKm: 20 },
    ]);
    const aid = station("1", 10);
    const withAid = buildVideoTimeline(flat, [aid], DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    const disabled = buildVideoTimeline(flat, [aid], { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, disabledAidStationIds: [aid.id] });

    const timeAround = (timeline: typeof withAid) => {
      const enter = timeline.cumulativeTimeFraction[timeline.sampleDistancesKm.findIndex((km) => km >= 9.5)];
      const leave = timeline.cumulativeTimeFraction[timeline.sampleDistancesKm.findIndex((km) => km >= 10.5)];
      return leave - enter;
    };
    expect(timeAround(withAid)).toBeGreaterThan(timeAround(disabled) * 1.5);
    expect(disabled.aidLabels).toEqual([]);
  });

  it("never stacks aid labels and drops a station that would be unreadable", () => {
    const flat = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
      { lat: 45.5, lon: 4, elevationM: 200, distanceKm: 55 },
    ]);
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

  it("shows an aid label when the runner reaches the station", () => {
    const label = timeline.aidLabels[0];
    expect(getVideoFrameState(timeline, label.startMs + 100).aidLabel?.name).toBe("Ravito 1");
    expect(getVideoFrameState(timeline, label.startMs + 100).distanceKm).toBeCloseTo(10, 0);
    expect(getVideoFrameState(timeline, label.endMs + 1).aidLabel).toBeNull();
  });

  it("glides the camera from the overview to the start during the intro", () => {
    const start = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 0), "portrait");
    const glided = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 2_999), "portrait");
    const flyoverStart = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 3_000), "portrait");
    expect(start.camera.altitudeM).toBeGreaterThan(flyoverStart.camera.altitudeM);
    expect(glided.camera.lat).toBeCloseTo(flyoverStart.camera.lat, 3);
  });
});

describe("buildElevationProfile", () => {
  it("covers the whole route once with bounded points", () => {
    const profile = buildElevationProfile(prepareAnimationPath(flatThenClimb));
    expect(profile.minElevationM).toBe(200);
    expect(profile.maxElevationM).toBe(2_200);
    expect(profile.totalDistanceKm).toBe(20);
    expect(profile.linePath.startsWith("M0.0,")).toBe(true);
    expect(profile.linePath.split("L").length).toBeLessThanOrEqual(401);
  });
});
