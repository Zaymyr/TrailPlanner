// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { getExportFrame, overrideDevicePixelRatio } from "./export-frame";

describe("getExportFrame", () => {
  it("keeps the preview size and raises the pixel density to the video resolution", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, { width: 408, height: 726 })).toEqual({
      width: 408,
      height: 725,
      pixelRatio: 1080 / 408,
    });
  });

  it("frames a 540p render like the same preview", () => {
    const frame = getExportFrame({ width: 540, height: 960 }, { width: 408, height: 726 });
    expect(frame.width).toBe(408);
    expect(frame.pixelRatio).toBeCloseTo(1.32, 2);
  });

  it("falls back to a 1080p-screen preview for compositions saved without one", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, null)).toEqual({ width: 405, height: 720, pixelRatio: 1080 / 405 });
    expect(getExportFrame({ width: 1920, height: 1080 }, undefined)).toEqual({ width: 720, height: 405, pixelRatio: 1920 / 720 });
  });

  it("ignores a collapsed preview measurement", () => {
    expect(getExportFrame({ width: 1080, height: 1920 }, { width: 0, height: 0 }).width).toBe(405);
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
