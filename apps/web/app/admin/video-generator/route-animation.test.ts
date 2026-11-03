import { describe, expect, it } from "vitest";

import type { VideoRoutePoint } from "../../../lib/video-generator";
import {
  getChaseCameraPose,
  getOverviewCameraPose,
  getRouteHeading,
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

describe("getChaseCameraPose", () => {
  const straight = prepareAnimationPath([
    { lat: 45, lon: 4, elevationM: 400, distanceKm: 0 },
    { lat: 45.2, lon: 4, elevationM: 600, distanceKm: 22.24 },
  ]);

  it("looks exactly at the progress point and is deterministic", () => {
    const pose = getChaseCameraPose(straight, 10, 500);
    const marker = getRoutePointAtDistance(straight, 10);
    expect(pose.target.lat).toBeCloseTo(marker.lat, 10);
    expect(pose.target.lon).toBeCloseTo(marker.lon, 10);
    expect(getChaseCameraPose(straight, 10, 500)).toEqual(pose);
  });

  it("sits behind the runner along the travel direction and above nearby terrain", () => {
    const pose = getChaseCameraPose(straight, 10, 500, "landscape");
    expect(pose.camera.lat).toBeLessThan(pose.target.lat);
    expect(pose.camera.lon).toBeCloseTo(pose.target.lon, 6);
    expect(pose.camera.altitudeM).toBeGreaterThan(600 * 1.15 + 299);
  });

  it("raises the portrait camera and stays finite for degenerate paths", () => {
    const portrait = getChaseCameraPose(straight, 10, 500, "portrait");
    const landscape = getChaseCameraPose(straight, 10, 500, "landscape");
    expect(portrait.camera.altitudeM).toBeGreaterThan(landscape.camera.altitudeM);

    const single = getChaseCameraPose(prepareAnimationPath([points[0]]), 0, 0);
    expect(Object.values(single.camera).every(Number.isFinite)).toBe(true);
  });
});

describe("getRouteHeading", () => {
  it("averages chords so a hairpin rotates progressively", () => {
    const hairpin = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 0, distanceKm: 0 },
      { lat: 45.05, lon: 4, elevationM: 0, distanceKm: 5.56 },
      { lat: 45.05, lon: 4.07, elevationM: 0, distanceKm: 11.06 },
    ]);
    const before = getRouteHeading(hairpin, 3, 1);
    const atTurn = getRouteHeading(hairpin, 5.56, 1);
    const after = getRouteHeading(hairpin, 8, 1);
    expect(before.north).toBeGreaterThan(0.99);
    expect(after.east).toBeGreaterThan(0.99);
    expect(atTurn.north).toBeGreaterThan(0.5);
    expect(atTurn.east).toBeGreaterThan(0.5);
  });
});

describe("getOverviewCameraPose", () => {
  it("looks at the route centre from the south, higher in portrait", () => {
    const path = prepareAnimationPath(points);
    const portrait = getOverviewCameraPose(path, "portrait");
    const landscape = getOverviewCameraPose(path, "landscape");
    expect(portrait.target.lat).toBeCloseTo(45.1, 6);
    expect(portrait.camera.lat).toBeLessThan(portrait.target.lat);
    expect(portrait.camera.altitudeM).toBeGreaterThan(landscape.camera.altitudeM);
  });
});
