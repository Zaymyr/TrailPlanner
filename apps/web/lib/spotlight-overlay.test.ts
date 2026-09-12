import { describe, expect, it } from "vitest";

import { clampSpotlightRect, getOnboardingModalTop } from "./spotlight-overlay";

describe("spotlight overlay geometry", () => {
  it("clips an oversized target to a useful viewport region", () => {
    expect(clampSpotlightRect({
      rect: { x: 20, y: -250, width: 350, height: 1_300 },
      viewportWidth: 390,
      viewportHeight: 844,
      dialogHeight: 286,
    })).toEqual({ x: 20, y: 12, width: 350, height: 360 });
  });

  it("keeps a target inside the viewport edges", () => {
    expect(clampSpotlightRect({
      rect: { x: -40, y: 780, width: 500, height: 100 },
      viewportWidth: 390,
      viewportHeight: 844,
      dialogHeight: 286,
    })).toEqual({ x: 12, y: 780, width: 366, height: 52 });
  });

  it("clips a central target so the dialog never overlaps it", () => {
    const viewportHeight = 844;
    const dialogHeight = 312;
    const spotlight = clampSpotlightRect({
      rect: { x: 20, y: 247, width: 350, height: 350 },
      viewportWidth: 390,
      viewportHeight,
      dialogHeight,
    });
    const dialogTop = getOnboardingModalTop({ spotlight, viewportHeight, dialogHeight });

    expect(spotlight).toEqual({ x: 20, y: 247, width: 350, height: 247 });
    expect(dialogTop).toBe(524);
    expect(dialogTop).toBeGreaterThanOrEqual(spotlight.y + spotlight.height + 30);
    expect(dialogTop + dialogHeight).toBeLessThanOrEqual(viewportHeight - 8);
  });

  it("positions the dialog below when it fits and above otherwise", () => {
    expect(getOnboardingModalTop({
      spotlight: { x: 20, y: 100, width: 200, height: 100 },
      viewportHeight: 844,
      dialogHeight: 286,
    })).toBe(230);
    expect(getOnboardingModalTop({
      spotlight: { x: 20, y: 650, width: 200, height: 100 },
      viewportHeight: 844,
      dialogHeight: 286,
    })).toBe(334);
  });
});
