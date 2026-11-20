import { describe, expect, it } from "vitest";

import { getPitchBearing } from "./camera-controller";
import {
  ensureRouteInFrame,
  FRAME_ASPECT,
  getFramingPoints,
  getFramingViolation,
  getSafeFrameRect,
  projectToFrame,
  type FramePoint,
} from "./camera-framing";
import { buildHighlightBeats, selectHighlights } from "./highlights";
import { buildRaceFigures, toRouteAidStations } from "./race-figures";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import {
  getChaseCameraPose,
  prepareAnimationPath,
  TILTED_PITCH_DEG,
  TILTED_PITCH_MAX_DEG,
  TILTED_PITCH_MIN_DEG,
  type CameraPose,
} from "./route-animation";
import { buildRaceClock } from "./route-clock";
import { buildStoryBeats, getCumulativeGainAt } from "./route-story";
import {
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getCameraSpeedMps,
  getOrbitLookDirection,
  getRawVideoCameraPose,
  getSmoothedCameraTarget,
  getVideoCameraPose,
  getVideoFrameState,
  isTiltedCameraEnabled,
  shiftIntoVisibleZone,
  videoCompositionSettingsSchema,
  type VideoCompositionSettings,
} from "./video-composition";

const fixtureFigures = (fixture: typeof astragaleTrail) => {
  const path = prepareAnimationPath(fixture.points);
  return buildRaceFigures({
    raceDistanceKm: fixture.race.distanceKm,
    raceElevationGainM: fixture.race.elevationGainM,
    routeDistanceKm: path.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(path, path.totalDistanceKm),
  });
};

const highlightsSettings: VideoCompositionSettings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" };

const buildHighlights = (fixture: typeof astragaleTrail, settings = highlightsSettings) => {
  const path = prepareAnimationPath(fixture.points);
  const figures = fixtureFigures(fixture);
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const clock = buildRaceClock(path, stations, fixture.race);
  const highlights = selectHighlights(path, stations, clock, figures);
  const beats = buildHighlightBeats(highlights, path, fixture.race, { figures });
  return { path, timeline: buildVideoTimeline(path, beats, settings, {}, clock) };
};

const buildFull = (fixture: typeof astragaleTrail, settings: VideoCompositionSettings = DEFAULT_VIDEO_COMPOSITION_SETTINGS) => {
  const path = prepareAnimationPath(fixture.points);
  const figures = fixtureFigures(fixture);
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const beats = buildStoryBeats(path, stations, fixture.race, { figures });
  return { path, timeline: buildVideoTimeline(path, beats, settings, {}) };
};

describe("tiltedCamera setting", () => {
  it("follows the mode when null and the explicit value otherwise", () => {
    expect(DEFAULT_VIDEO_COMPOSITION_SETTINGS.tiltedCamera).toBeNull();
    expect(isTiltedCameraEnabled(DEFAULT_VIDEO_COMPOSITION_SETTINGS)).toBe(false);
    expect(isTiltedCameraEnabled(highlightsSettings)).toBe(true);
    expect(isTiltedCameraEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, tiltedCamera: true })).toBe(true);
    expect(isTiltedCameraEnabled({ ...highlightsSettings, tiltedCamera: false })).toBe(false);
    const { tiltedCamera: _omitted, ...legacy } = DEFAULT_VIDEO_COMPOSITION_SETTINGS;
    expect(videoCompositionSettingsSchema.parse(legacy).tiltedCamera).toBeNull();
  });
});

describe("projectToFrame", () => {
  const pose: CameraPose = {
    camera: { lat: 46, lon: 3, altitudeM: 3_000 },
    target: { lat: 46.03, lon: 3, altitudeM: 0 },
  };

  it("puts the aimed point in the middle of the frame", () => {
    const screen = projectToFrame(pose, pose.target, FRAME_ASPECT.portrait)!;
    expect(screen.x).toBeCloseTo(0.5, 6);
    expect(screen.y).toBeCloseTo(0.5, 6);
  });

  it("puts points beyond the target higher and points to the east further right", () => {
    const ahead = projectToFrame(pose, { lat: 46.05, lon: 3, altitudeM: 0 }, FRAME_ASPECT.portrait)!;
    const behind = projectToFrame(pose, { lat: 46.02, lon: 3, altitudeM: 0 }, FRAME_ASPECT.portrait)!;
    const east = projectToFrame(pose, { lat: 46.03, lon: 3.01, altitudeM: 0 }, FRAME_ASPECT.portrait)!;
    expect(ahead.y).toBeLessThan(0.5);
    expect(behind.y).toBeGreaterThan(0.5);
    expect(east.x).toBeGreaterThan(0.5);
  });

  it("returns null behind the camera", () => {
    expect(projectToFrame(pose, { lat: 45.9, lon: 3, altitudeM: 0 }, FRAME_ASPECT.portrait)).toBeNull();
  });

  it("keeps the overlay band, the bottom 20 % and the side margins out of the safe rectangle", () => {
    const rect = getSafeFrameRect("portrait");
    // The band (72 cqmin) is capped at 40 % of the portrait height.
    expect(rect.top).toBeCloseTo(0.4, 6);
    expect(rect.top).toBeGreaterThan(0.3);
    expect(rect.bottom).toBeCloseTo(0.8, 6);
    expect(rect.left).toBeGreaterThan(0);
    expect(rect.right).toBeLessThan(1);
  });
});

describe("ensureRouteInFrame on a trail that turns away", () => {
  // North for 1 km, then east: seen from a camera looking north the trail leaves the frame.
  const winding = prepareAnimationPath(Array.from({ length: 121 }, (_, index) => {
    const distanceKm = index / 10;
    const northKm = Math.min(distanceKm, 1);
    const eastKm = Math.max(0, distanceKm - 1);
    return { lat: 46 + northKm / 111.32, lon: 3 + eastKm / (111.32 * Math.cos((46 * Math.PI) / 180)), elevationM: 800, distanceKm };
  }));

  it("pulls the camera back or turns it until the current point and the next 2 km fit", () => {
    const viewport = "portrait";
    const runnerKm = 1;
    const pose = shiftIntoVisibleZone(getChaseCameraPose(winding, runnerKm, 1_000, viewport, 1.8, { east: 0, north: 1 }, undefined, TILTED_PITCH_DEG));
    const points = getFramingPoints(winding, runnerKm, 1.8);
    expect(getFramingViolation(pose, points, viewport)).toBeGreaterThan(0);
    const framed = ensureRouteInFrame(pose, points, viewport);
    expect(getFramingViolation(framed, points, viewport)).toBe(0);
    // The camera never gets closer to the ground and the pitch stays in the tilted range.
    expect(framed.camera.altitudeM).toBeGreaterThanOrEqual(pose.camera.altitudeM);
    const { pitch } = getPitchBearing(framed);
    expect(pitch).toBeGreaterThanOrEqual(TILTED_PITCH_MIN_DEG);
    expect(pitch).toBeLessThanOrEqual(TILTED_PITCH_MAX_DEG);
  });

  it("leaves a pose that already fits untouched", () => {
    const pose = getChaseCameraPose(winding, 0.2, 1_000, "portrait", 1.8, { east: 0, north: 1 }, undefined, TILTED_PITCH_DEG);
    const points: FramePoint[] = [{ lat: pose.target.lat, lon: pose.target.lon, altitudeM: pose.target.altitudeM }];
    expect(ensureRouteInFrame(pose, points, "portrait")).toBe(pose);
  });
});

describe("tilted camera on the highlights fixtures", () => {
  const viewport = "portrait";
  const rect = getSafeFrameRect(viewport);

  // The reel jumps between moments in 1.2 s (the runner covers tens of kilometres): the gaussian
  // smoothing of the camera (3 sigma = 1.35 s in highlights) blends two places there, so no framing
  // can be promised within 1.4 s of such a jump; every other frame is a dwell on a moment.
  const isNearTransit = (timeline: ReturnType<typeof buildHighlights>["timeline"], timeMs: number) =>
    Math.abs(getVideoFrameState(timeline, timeMs + 1_400).distanceKm - getVideoFrameState(timeline, timeMs - 1_400).distanceKm) > 5;

  // Smoothed pose against the runner and the next 2 km at the same frame, every 200 ms.
  const measure = (fixture: typeof astragaleTrail, fromKm = 0, toKm = Number.POSITIVE_INFINITY) => {
    const { path, timeline } = buildHighlights(fixture);
    let worst = 0;
    let worstInTransit = 0;
    let worstPitchDeviation = 0;
    let minPitch = 90;
    let maxPitch = 0;
    let frames = 0;
    for (let timeMs = timeline.introMs + 500; timeMs < timeline.totalMs - timeline.outroMs - 500; timeMs += 200) {
      const frame = getVideoFrameState(timeline, timeMs);
      if (frame.distanceKm < fromKm || frame.distanceKm > toKm) continue;
      const pose = getVideoCameraPose(path, timeline, frame, viewport);
      const points = getFramingPoints(path, frame.distanceKm, timeline.terrainExaggeration);
      const violation = getFramingViolation(pose, points, viewport, rect);
      if (isNearTransit(timeline, timeMs)) {
        worstInTransit = Math.max(worstInTransit, violation);
        continue;
      }
      worst = Math.max(worst, violation);
      const { pitch } = getPitchBearing(pose);
      minPitch = Math.min(minPitch, pitch);
      maxPitch = Math.max(maxPitch, pitch);
      worstPitchDeviation = Math.max(worstPitchDeviation, Math.abs(pitch - TILTED_PITCH_DEG));
      frames += 1;
    }
    return { worst, worstInTransit, minPitch, maxPitch, frames, worstPitchDeviation };
  };

  [astragaleTrail, ultraDesDruides].forEach((fixture) => {
    it(`${fixture.race.title}: the runner and the next 2 km stay in the safe rectangle after smoothing, at 55-65 degrees`, () => {
      const result = measure(fixture);
      expect(result.frames).toBeGreaterThan(50);
      // Measured worst case: reported in the PR; the assertion is the guarantee itself.
      expect(result.worst).toBe(0);
      expect(result.minPitch).toBeGreaterThanOrEqual(TILTED_PITCH_MIN_DEG);
      expect(result.maxPitch).toBeLessThanOrEqual(TILTED_PITCH_MAX_DEG);
    });
  });

  it("L'Ultra des Druides: the stretch around km 27 (Bibracte) stays in frame, every frame of a full flyover", () => {
    const settings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, tiltedCamera: true };
    const { path, timeline } = buildFull(ultraDesDruides, settings);
    const figures = fixtureFigures(ultraDesDruides);
    const scale = path.totalDistanceKm / figures.distanceKm;
    let frames = 0;
    let worst = 0;
    for (let timeMs = timeline.introMs; timeMs < timeline.introMs + timeline.flyoverMs; timeMs += 100) {
      const frame = getVideoFrameState(timeline, timeMs);
      if (frame.distanceKm < 20 * scale || frame.distanceKm > 35 * scale) continue;
      const pose = getVideoCameraPose(path, timeline, frame, viewport);
      worst = Math.max(worst, getFramingViolation(pose, getFramingPoints(path, frame.distanceKm, timeline.terrainExaggeration), viewport, rect));
      frames += 1;
    }
    expect(frames).toBeGreaterThan(20);
    expect(worst).toBe(0);
  });

  it("is a gentler 3D view than the default chase camera", () => {
    const { path, timeline } = buildHighlights(astragaleTrail);
    const flat = buildHighlights(astragaleTrail, { ...highlightsSettings, tiltedCamera: false });
    const frame = getVideoFrameState(timeline, timeline.introMs + 6_000);
    const tilted = getPitchBearing(getVideoCameraPose(path, timeline, frame, viewport)).pitch;
    const high = getPitchBearing(getVideoCameraPose(flat.path, flat.timeline, frame, viewport)).pitch;
    expect(high).toBeLessThan(45);
    expect(tilted).toBeGreaterThan(high + 15);
  });
});

describe("full flyover without the tilted camera", () => {
  [astragaleTrail, ultraDesDruides].forEach((fixture) => {
    it(`${fixture.race.title}: the raw pose is exactly the high chase camera, shifted into the visible zone`, () => {
      [null, false].forEach((tiltedCamera) => {
        const { path, timeline } = buildFull(fixture, { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, tiltedCamera });
        expect(timeline.tiltedCamera).toBe(false);
        for (const share of [0.05, 0.3, 0.55, 0.8]) {
          const frame = getVideoFrameState(timeline, timeline.introMs + timeline.flyoverMs * share);
          const speed = getCameraSpeedMps(timeline, frame.timeMs);
          const expected = shiftIntoVisibleZone(getChaseCameraPose(
            path,
            frame.distanceKm,
            speed,
            "portrait",
            timeline.terrainExaggeration,
            getOrbitLookDirection(path, timeline, frame.timeMs),
            getSmoothedCameraTarget(path, timeline, frame.timeMs, 0.1 * Math.min(20_000, Math.max(4_500, speed * 3))),
          ));
          expect(getRawVideoCameraPose(path, timeline, frame, "portrait")).toEqual(expected);
          // The old high view: about 36 degrees from the vertical.
          expect(getPitchBearing(expected).pitch).toBeGreaterThan(30);
          expect(getPitchBearing(expected).pitch).toBeLessThan(42);
        }
      });
    });
  });
});
