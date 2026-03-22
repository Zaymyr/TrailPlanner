import { describe, expect, it } from "vitest";

import { buildSegments } from "./segments";

const baseValues = {
  raceDistanceKm: 10,
  elevationGain: 0,
  paceType: "pace" as const,
  paceMinutes: 5,
  paceSeconds: 0,
  speedKph: 0,
  targetIntakePerHour: 60,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 1000,
  waterBagLiters: 1,
  aidStations: [],
};

describe("buildSegments", () => {
  it("prefers coach overrides over adjusted pacing", () => {
    const segments = buildSegments(
      {
        ...baseValues,
        aidStations: [
          {
            name: "Aid 1",
            distanceKm: 5,
            paceAdjustmentMinutesPerKm: 2,
            segmentMinutesOverride: 30,
          },
        ],
      },
      "Start",
      "Finish",
      []
    );

    const firstSegment = segments[0];
    expect(firstSegment.segmentMinutes).toBe(30);
    expect(firstSegment.plannedMinutesOverride).toBe(30);
    expect(firstSegment.estimatedSegmentMinutes).toBe(25);
  });
});
