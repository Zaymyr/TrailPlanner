import { describe, expect, it } from "vitest";

import { estimateCarbs } from "../../lib/carb-calculator";

describe("estimateCarbs", () => {
  it("returns a conservative target for frequent nausea", () => {
    expect(estimateCarbs({ durationHours: 6, digestiveTolerance: 0 })).toEqual({
      carbsPerHour: 30,
      totalCarbs: 180,
      rangeMin: 30,
      rangeMax: 90,
    });
  });

  it("raises the target when digestive tolerance increases", () => {
    expect(estimateCarbs({ durationHours: 6, digestiveTolerance: 50 }).carbsPerHour).toBe(60);
    expect(estimateCarbs({ durationHours: 6, digestiveTolerance: 100 }).carbsPerHour).toBe(90);
  });

  it("changes the hourly target with duration", () => {
    expect(estimateCarbs({ durationHours: 2, digestiveTolerance: 100 }).carbsPerHour).toBe(50);
    expect(estimateCarbs({ durationHours: 3, digestiveTolerance: 100 }).carbsPerHour).toBe(65);
  });

  it("does not recommend carbs for efforts shorter than 45 minutes", () => {
    expect(estimateCarbs({ durationHours: 0.5, digestiveTolerance: 100 })).toMatchObject({
      carbsPerHour: 0,
      totalCarbs: 0,
      rangeMin: 0,
      rangeMax: 0,
    });
  });
});
