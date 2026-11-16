import { describe, expect, it } from "vitest";

import { estimateEffortDurationSeconds } from "../pacing";
import {
  estimateCourseTime,
  flatPaceFromUtmbIndex,
  formatDurationHm,
  formatPaceMinPerKm,
} from "../quick-estimate";

describe("flatPaceFromUtmbIndex", () => {
  it("scales pace inversely with the index", () => {
    expect(flatPaceFromUtmbIndex(800)).toBeCloseTo(4, 5);
    expect(flatPaceFromUtmbIndex(400)).toBeCloseTo(8, 5);
  });

  it("clamps out-of-range values and rejects invalid ones", () => {
    expect(flatPaceFromUtmbIndex(2000)).toBeCloseTo(3.2, 5);
    expect(flatPaceFromUtmbIndex(10)).toBe(15);
    expect(flatPaceFromUtmbIndex(0)).toBeNull();
    expect(flatPaceFromUtmbIndex(Number.NaN)).toBeNull();
  });
});

describe("estimateCourseTime", () => {
  it("matches the planner effort model on a flat course without profile", () => {
    const result = estimateCourseTime({ distanceKm: 10, elevationGainM: 0, elevationLossM: 0 }, 6);
    expect(result?.totalSeconds).toBe(3600);
    expect(result?.averagePaceMinPerKm).toBeCloseTo(6, 5);
    expect(result?.checkpoints).toEqual([{ name: "Arrivée", distanceKm: 10, elapsedSeconds: 3600 }]);
  });

  it("scales a down-sampled profile to the published elevation totals", () => {
    const points = [
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 5, elevationM: 300 },
      { distanceKm: 10, elevationM: 100 },
    ];
    const result = estimateCourseTime(
      { distanceKm: 10, elevationGainM: 400, elevationLossM: 400, points, aidStations: [{ name: "Sommet", distanceKm: 5 }] },
      6,
    );
    const firstLeg = estimateEffortDurationSeconds(360, { distKm: 5, dPlus: 400, dMinus: 0, elapsedBeforeSeconds: 0, fatigueLevel: 0.5 });
    expect(result?.checkpoints[0]).toEqual({ name: "Sommet", distanceKm: 5, elapsedSeconds: Math.round(firstLeg) });
    expect(result?.checkpoints).toHaveLength(2);
    expect(result?.checkpoints[1].name).toBe("Arrivée");
    expect(result!.totalSeconds).toBeGreaterThan(3600 + 4 * 360);
  });

  it("ignores stations outside the course and rejects invalid paces", () => {
    const course = { distanceKm: 20, elevationGainM: 500, elevationLossM: null, aidStations: [{ name: "Hors parcours", distanceKm: 25 }] };
    expect(estimateCourseTime(course, 6)?.checkpoints.map((checkpoint) => checkpoint.name)).toEqual(["Arrivée"]);
    expect(estimateCourseTime(course, 1)).toBeNull();
    expect(estimateCourseTime({ distanceKm: null, elevationGainM: null, elevationLossM: null }, 6)).toBeNull();
  });
});

describe("formatters", () => {
  it("formats durations and paces in French", () => {
    expect(formatDurationHm(3 * 3600 + 5 * 60)).toBe("3 h 05");
    expect(formatDurationHm(45 * 60)).toBe("45 min");
    expect(formatPaceMinPerKm(6.5)).toBe("6:30 /km");
  });
});
