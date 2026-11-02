import type { Map as MapboxMap } from "mapbox-gl";
import { describe, expect, it, vi } from "vitest";

import { createRouteCameraController, RESET_CAMERA_PITCH } from "./camera-controller";

const bounds = { minLat: 45, minLon: 4, maxLat: 46, maxLon: 5 };

describe("video generator camera controller", () => {
  it("fits the route while preserving the current 3D orientation", () => {
    const easeTo = vi.fn();
    const map = {
      cameraForBounds: vi.fn(() => ({ center: [4.5, 45.5], zoom: 9 })),
      getBearing: () => 32,
      getPitch: () => 68,
      easeTo,
    } as unknown as MapboxMap;

    createRouteCameraController(map, () => bounds).fitOverview(0);
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ bearing: 32, pitch: 68, duration: 0 }));
  });

  it("returns to a north-up canonical 3D overview", () => {
    const easeTo = vi.fn();
    const map = {
      cameraForBounds: vi.fn(() => ({ center: [4.5, 45.5], zoom: 9 })),
      getBearing: () => 90,
      getPitch: () => 20,
      easeTo,
    } as unknown as MapboxMap;

    createRouteCameraController(map, () => bounds).reset(250);
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ bearing: 0, pitch: RESET_CAMERA_PITCH, duration: 250 }));
  });

  it("uses a stable close zoom for a one-point route", () => {
    const easeTo = vi.fn();
    const map = {
      cameraForBounds: vi.fn(),
      getBearing: () => 0,
      getPitch: () => 0,
      easeTo,
    } as unknown as MapboxMap;

    createRouteCameraController(map, () => ({ minLat: 45, minLon: 4, maxLat: 45, maxLon: 4 })).reset(0);
    expect(map.cameraForBounds).not.toHaveBeenCalled();
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [4, 45], zoom: 14 }));
  });

  it("applies a deterministic free-camera frame", () => {
    const lookAtPoint = vi.fn();
    const camera = { position: null, lookAtPoint };
    const setFreeCameraOptions = vi.fn();
    const map = {
      getFreeCameraOptions: () => camera,
      setFreeCameraOptions,
    } as unknown as MapboxMap;

    createRouteCameraController(map, () => bounds).applyAnimationFrame({
      progress: 0.5,
      distanceKm: 5,
      routePoint: { lat: 45.5, lon: 4.5, elevationM: 600, distanceKm: 5 },
      camera: { lat: 45.4, lon: 4.4, altitudeM: 1_500 },
      target: { lat: 45.6, lon: 4.6, altitudeM: 700 },
    });

    expect(camera.position).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    expect(lookAtPoint).toHaveBeenCalledWith([4.6, 45.6], [0, 0, 1], 700);
    expect(setFreeCameraOptions).toHaveBeenCalledWith(camera);
  });
});
