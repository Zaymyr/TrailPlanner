import { describe, expect, it } from "vitest";

import {
  COMPACT_TOP_CQMIN,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  isCompactOverlayEnabled,
  OVERLAY_FONT_CQMIN,
  OVERLAY_MIN_FONT_CQMIN,
  videoCompositionSettingsSchema,
} from "./video-composition";

const PX_PER_CQMIN_AT_1080 = 10.8;

describe("light phone overlay", () => {
  it("follows the story mode unless set explicitly", () => {
    expect(isCompactOverlayEnabled(DEFAULT_VIDEO_COMPOSITION_SETTINGS)).toBe(false);
    expect(isCompactOverlayEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" })).toBe(true);
    expect(isCompactOverlayEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights", compactOverlay: false })).toBe(false);
    expect(isCompactOverlayEnabled({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, compactOverlay: true })).toBe(true);
  });

  it("keeps old saved settings valid", () => {
    const { compactOverlay: _omitted, ...legacy } = DEFAULT_VIDEO_COMPOSITION_SETTINGS;
    expect(videoCompositionSettingsSchema.parse(legacy).compactOverlay).toBeNull();
  });

  it("puts every readable text at 32 px or more on a 1080 px wide reel", () => {
    expect(OVERLAY_MIN_FONT_CQMIN * PX_PER_CQMIN_AT_1080).toBeGreaterThanOrEqual(32);
    for (const [name, size] of Object.entries(OVERLAY_FONT_CQMIN)) {
      expect(size, name).toBeGreaterThanOrEqual(OVERLAY_MIN_FONT_CQMIN);
    }
  });

  it("starts the light band below Instagram's top bar", () => {
    expect(COMPACT_TOP_CQMIN * PX_PER_CQMIN_AT_1080).toBeGreaterThanOrEqual(120);
  });
});
