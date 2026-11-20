// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { getExportFrame, overrideDevicePixelRatio } from "./export-frame";

describe("getExportFrame", () => {
  it("lays a 1080p export out at half the video size, density 2, and scales the map's pixel sizes", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, { width: 405, height: 720 })).toEqual({ width: 540, height: 960, pixelRatio: 2, pxScale: 540 / 405 });
    const measured = getExportFrame({ width: 1080, height: 1920 }, { width: 408, height: 726 });
    expect(measured).toMatchObject({ width: 540, height: 960, pixelRatio: 2 });
    expect(measured.pxScale).toBeCloseTo(540 / 408, 5);
  });

  it("keeps the preview size when it is already larger (540p render)", () => {
    const frame = getExportFrame({ width: 540, height: 960 }, { width: 408, height: 726 });
    expect(frame).toMatchObject({ width: 408, height: 725, pxScale: 1 });
    expect(frame.pixelRatio).toBeCloseTo(1.32, 2);
  });

  it("falls back to a 1080p-screen preview for compositions saved without one", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, null)).toMatchObject({ width: 540, height: 960, pixelRatio: 2 });
    expect(getExportFrame({ width: 1920, height: 1080 }, undefined)).toMatchObject({ width: 960, height: 540, pixelRatio: 2, pxScale: 960 / 720 });
  });

  it("ignores a collapsed preview measurement", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, { width: 0, height: 0 }).pxScale).toBeCloseTo(540 / 405, 5);
  });
});

describe("overrideDevicePixelRatio", () => {
  it("reports the forced ratio until restored", () => {
    const before = window.devicePixelRatio;
    const restore = overrideDevicePixelRatio(2.65);
    expect(window.devicePixelRatio).toBe(2.65);
    restore();
    expect(window.devicePixelRatio).toBe(before);
  });
});
