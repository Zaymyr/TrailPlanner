// @vitest-environment jsdom

import React, { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapboxMock = vi.hoisted(() => {
  const instances: MockMap[] = [];

  class MockMap {
    events = new Map<string, Set<(...args: unknown[]) => void>>();
    sources = new Map<string, { definition: Record<string, unknown>; setData: ReturnType<typeof vi.fn> }>();
    layers = new Map<string, Record<string, unknown>>();
    addControl = vi.fn();
    setTerrain = vi.fn();
    setPaintProperty = vi.fn();
    setFreeCameraOptions = vi.fn();
    setStyle = vi.fn();
    easeTo = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    queryTerrainElevation = vi.fn(() => 500);
    cameraForBounds = vi.fn(() => ({ center: [4.5, 45.5], zoom: 10 }));
    boxZoom = { enable: vi.fn(), disable: vi.fn() };
    doubleClickZoom = { enable: vi.fn(), disable: vi.fn() };
    dragPan = { enable: vi.fn(), disable: vi.fn() };
    dragRotate = { enable: vi.fn(), disable: vi.fn() };
    keyboard = { enable: vi.fn(), disable: vi.fn() };
    scrollZoom = { enable: vi.fn(), disable: vi.fn() };
    touchZoomRotate = { enable: vi.fn(), disable: vi.fn() };
    freeCamera = { position: null, lookAtPoint: vi.fn() };

    constructor() {
      instances.push(this);
    }

    on(event: string, callback: (...args: unknown[]) => void) {
      const callbacks = this.events.get(event) ?? new Set();
      callbacks.add(callback);
      this.events.set(event, callbacks);
      return this;
    }

    off(event: string, callback: (...args: unknown[]) => void) {
      this.events.get(event)?.delete(callback);
      return this;
    }

    once(event: string, callback: (...args: unknown[]) => void) {
      const onceCallback = (...args: unknown[]) => {
        this.off(event, onceCallback);
        callback(...args);
      };
      return this.on(event, onceCallback);
    }

    emit(event: string, ...args: unknown[]) {
      [...(this.events.get(event) ?? [])].forEach((callback) => callback(...args));
    }

    addSource(id: string, definition: Record<string, unknown>) {
      this.sources.set(id, { definition, setData: vi.fn() });
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    addLayer(layer: Record<string, unknown>) {
      this.layers.set(String(layer.id), layer);
    }

    getLayer(id: string) {
      return this.layers.get(id);
    }

    getBearing() { return 20; }
    getPitch() { return 55; }
    getFreeCameraOptions() { return this.freeCamera; }
    // Mirrors Mapbox: false while tiles load or a source has pending updates, i.e. during a flyover.
    isStyleLoaded() { return false; }
  }

  const markers: MockMarker[] = [];

  class MockMarker {
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn(() => this);

    constructor() {
      markers.push(this);
    }
  }

  class MockMercatorCoordinate {
    static fromLngLat(_coordinates: unknown, altitude: number) {
      return { x: 0.5, y: 0.5, z: altitude / 1_000_000 };
    }
  }

  return { instances, markers, MockMap, MockMarker, MockMercatorCoordinate };
});

vi.mock("mapbox-gl", () => ({
  default: {
    accessToken: "",
    Map: mapboxMock.MockMap,
    Marker: mapboxMock.MockMarker,
    NavigationControl: class NavigationControl {},
  },
  Map: mapboxMock.MockMap,
  Marker: mapboxMock.MockMarker,
  MercatorCoordinate: mapboxMock.MockMercatorCoordinate,
  NavigationControl: class NavigationControl {},
}));

import { buildRouteTrimOffset, VideoGeneratorMapClient } from "./VideoGeneratorMapClient";

let animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 0;

const flushAnimationFrames = (time = 0) => {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  callbacks.forEach((callback) => callback(time));
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test";
  mapboxMock.instances.length = 0;
  mapboxMock.markers.length = 0;
  animationFrames = new Map();
  nextAnimationFrameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    nextAnimationFrameId += 1;
    animationFrames.set(nextAnimationFrameId, callback);
    return nextAnimationFrameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
    animationFrames.delete(frameId);
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({} as never));
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
});

describe("VideoGeneratorMapClient", () => {
  it("initializes terrain and animated layers, applies frames, switches format and cleans up", async () => {
    const view = render(createElement(VideoGeneratorMapClient, {
      aidStations: [],
      bounds: { minLat: 45, minLon: 4, maxLat: 46, maxLon: 5 },
      points: [
        { lat: 45, lon: 4, elevationM: 400, distanceKm: 0 },
        { lat: 46, lon: 5, elevationM: 900, distanceKm: 20 },
      ],
      race: { title: "SaintéLyon 2026", subtitle: "SaintéLyon 82 km", distanceKm: 82, elevationGainM: 2_300 },
    }));
    const map = mapboxMock.instances[0];
    expect(map).toBeTruthy();

    act(() => map.emit("style.load"));
    act(() => flushAnimationFrames());
    act(() => map.emit("idle"));

    expect(map.setTerrain).toHaveBeenCalledWith({ source: "video-terrain-dem", exaggeration: 1.15 });
    expect(map.sources.get("video-route")?.definition.lineMetrics).toBe(true);
    expect(map.layers.has("video-route-line")).toBe(true);
    expect(map.layers.has("video-route-line-reveal")).toBe(true);
    const progressMarker = mapboxMock.markers[0];
    expect(progressMarker.addTo).toHaveBeenCalledWith(map);
    const routeSetData = map.sources.get("video-route")?.setData;
    const routeUpdatesBeforePlayback = routeSetData?.mock.calls.length;
    const markerMovesBeforePlayback = progressMarker.setLngLat.mock.calls.length;

    expect(screen.getAllByText("SaintéLyon 2026").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Durée de la vidéo")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Lecture" }));
    act(() => flushAnimationFrames(1_000));
    expect(map.setFreeCameraOptions).toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith("video-route-line-reveal", "line-trim-offset", expect.any(Array));
    expect(map.setPaintProperty).not.toHaveBeenCalledWith(expect.anything(), "line-gradient", expect.anything());
    expect(map.dragPan.disable).toHaveBeenCalled();
    expect(progressMarker.setLngLat.mock.calls.length).toBeGreaterThan(markerMovesBeforePlayback);
    expect(routeSetData).toHaveBeenCalledTimes(routeUpdatesBeforePlayback ?? 0);

    await userEvent.click(screen.getByRole("button", { name: "Classique 16:9" }));
    act(() => flushAnimationFrames(1_100));
    expect(screen.getByTestId("video-preview-frame").className).toContain("aspect-video");

    await userEvent.click(screen.getByRole("checkbox", { name: "Profil altimétrique" }));
    expect((screen.getByRole("checkbox", { name: "Profil altimétrique" }) as HTMLInputElement).checked).toBe(false);

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: "Lecture" })).toBeTruthy();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await userEvent.click(screen.getByRole("button", { name: "Lecture" }));

    await userEvent.click(screen.getByRole("button", { name: "Standard 3D" }));
    expect(map.setStyle).toHaveBeenCalledWith("mapbox://styles/mapbox/standard-satellite");
    expect(screen.getByRole("button", { name: "Lecture" })).toBeTruthy();
    expect(map.dragPan.enable).toHaveBeenCalled();

    view.unmount();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(progressMarker.remove).toHaveBeenCalled();
  });
});

describe("buildRouteTrimOffset", () => {
  it("hides only the remaining route in progressive mode and nothing in full mode", () => {
    expect(buildRouteTrimOffset("progressive", 0)).toEqual([0, 1]);
    expect(buildRouteTrimOffset("progressive", 0.4)).toEqual([0.4, 1]);
    expect(buildRouteTrimOffset("progressive", 1)).toEqual([0, 0]);
    expect(buildRouteTrimOffset("progressive", -1)).toEqual([0, 1]);
    expect(buildRouteTrimOffset("full", 0.4)).toEqual([0, 0]);
  });
});
