import { describe, expect, it } from "vitest";
import { estimateEffortDurationSeconds } from "../pacing";
import { recomputeSectionFromSubSections } from "../section-recompute";

const elevationProfile = [
  { distanceKm: 0, elevationM: 0 },
  { distanceKm: 1, elevationM: 100 },
  { distanceKm: 2, elevationM: 0 },
];

describe("recomputeSectionFromSubSections", () => {
  it("uses the flat-pace fallback when no trail estimator is supplied", () => {
    const result = recomputeSectionFromSubSections({
      segments: [{ segmentKm: 1 }, { segmentKm: 1 }],
      startDistanceKm: 0,
      elevationProfile,
      paceModel: { secondsPerKm: 360 },
    });

    expect(result.segmentStats).toHaveLength(2);
    expect(result.totals.distanceKm).toBeCloseTo(2);
    expect(result.totals.dPlus).toBe(100);
    expect(result.totals.dMinus).toBe(100);
    expect(result.totals.etaSeconds).toBe(720);
  });

  it("uses the supplied trail estimator for climb and descent effort", () => {
    const result = recomputeSectionFromSubSections({
      segments: [{ segmentKm: 1 }, { segmentKm: 1 }],
      startDistanceKm: 0,
      elevationProfile,
      paceModel: {
        secondsPerKm: 360,
        estimateSeconds: (input) => estimateEffortDurationSeconds(360, input),
      },
    });

    expect(result.totals.etaSeconds).toBe(1200);
  });
});
