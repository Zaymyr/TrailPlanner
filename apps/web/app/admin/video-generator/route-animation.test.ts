import { describe, expect, it } from "vitest";

import type { VideoRoutePoint } from "../../../lib/video-generator";
import {
  getCameraStateAtTime,
  getRoutePointAtDistance,
  MAX_CAMERA_SAMPLES,
  prepareAnimationPath,
} from "./route-animation";

const points: VideoRoutePoint[] = [
  { lat: 45, lon: 4, elevationM: 400, distanceKm: 0 },
  { lat: 45.1, lon: 4.1, elevationM: null, distanceKm: 2 },
  { lat: 45.2, lon: 4.2, elevationM: 800, distanceKm: 10 },
];

describe("prepareAnimationPath", () => {
  it("samples by cumulative distance and interpolates coordinates and elevations", () => {
    const path = prepareAnimationPath(points);
    const middle = getRoutePointAtDistance(path, 5);

    expect(path.totalDistanceKm).toBe(10);
    expect(middle.lat).toBeCloseTo(45.1375, 3);
    expect(middle.elevationM).toBeCloseTo(600, 3);
  });

  it("caps ultra routes and ignores invalid elevations", () => {
    const path = prepareAnimationPath([
      { lat: 44, lon: 5, elevationM: 25_000, distanceKm: 0 },
      { lat: 46, lon: 7, elevationM: null, distanceKm: 180 },
    ], () => 1_200);

    expect(path.samples).toHaveLength(MAX_CAMERA_SAMPLES);
    expect(path.samples.every((point) => point.elevationM === 1_200)).toBe(true);
  });

  it("supports duplicate distances, one point and empty paths without NaN", () => {
    const duplicatePath = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 300, distanceKm: 0 },
      { lat: 45.01, lon: 4.01, elevationM: 320, distanceKm: 0 },
      { lat: 45.02, lon: 4.02, elevationM: 340, distanceKm: 1 },
    ]);
    expect(Number.isFinite(getRoutePointAtDistance(duplicatePath, 0.5).lat)).toBe(true);

    const onePoint = prepareAnimationPath([points[0]]);
    expect(onePoint.canAnimate).toBe(false);
    expect(onePoint.samples).toHaveLength(1);

    const empty = prepareAnimationPath([]);
    expect(empty.canAnimate).toBe(false);
    expect(getRoutePointAtDistance(empty, 1)).toEqual({ lat: 0, lon: 0, elevationM: 0, distanceKm: 0 });
  });
});

describe("getCameraStateAtTime", () => {
  it("is deterministic and clamps the exact start and finish", () => {
    const path = prepareAnimationPath(points);
    const first = getCameraStateAtTime(12_000, 45_000, path);
    const repeated = getCameraStateAtTime(12_000, 45_000, path);
    expect(repeated).toEqual(first);
    expect(getCameraStateAtTime(-10, 45_000, path).progress).toBe(0);
    expect(getCameraStateAtTime(99_000, 45_000, path).progress).toBe(1);
    expect(getCameraStateAtTime(45_000, 45_000, path).distanceKm).toBe(10);
  });

  it("adapts portrait framing without producing invalid values", () => {
    const path = prepareAnimationPath(points);
    const portrait = getCameraStateAtTime(20_000, 45_000, path, undefined, "portrait");
    const landscape = getCameraStateAtTime(20_000, 45_000, path, undefined, "landscape");

    expect(portrait.camera.altitudeM).toBeGreaterThan(landscape.camera.altitudeM);
    expect(portrait.target.lat).not.toBe(landscape.target.lat);
    expect(Object.values(portrait.camera).every(Number.isFinite)).toBe(true);
    expect(Object.values(portrait.target).every(Number.isFinite)).toBe(true);
  });

  it("remains finite for a zero-length path", () => {
    const frame = getCameraStateAtTime(0, 45_000, prepareAnimationPath([points[0]]));
    expect(frame.progress).toBe(0);
    expect(Object.values(frame.camera).every(Number.isFinite)).toBe(true);
  });
});
