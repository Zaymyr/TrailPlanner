import { describe, expect, it } from "vitest";

import { estimateCarbs } from "../../lib/carb-calculator";

describe("estimateCarbs", () => {
  it("uses the standard 60 g/h target", () => {
    expect(
      estimateCarbs({ durationHours: 5, distanceKm: 42, elevationGainM: 900, goal: "good_time" }),
    ).toEqual({ carbsPerHour: 60, totalCarbs: 300, portionsPerHour: 2.4, totalPortions: 12 });
  });

  it("uses 70 g/h for high elevation or a performance goal", () => {
    expect(
      estimateCarbs({ durationHours: 8, distanceKm: 60, elevationGainM: 2500, goal: "comfort" }),
    ).toEqual({ carbsPerHour: 70, totalCarbs: 560, portionsPerHour: 2.8, totalPortions: 23 });
  });

  it("prevents negative totals", () => {
    expect(
      estimateCarbs({ durationHours: -2, distanceKm: -10, elevationGainM: -100, goal: "good_time" }).totalCarbs,
    ).toBe(0);
  });
});
