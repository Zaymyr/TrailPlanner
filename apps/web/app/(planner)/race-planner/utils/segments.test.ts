import { describe, expect, it } from "vitest";

import { buildSegments } from "./segments";

const baseValues = {
  raceDistanceKm: 10,
  elevationGain: 0,
  paceType: "pace" as const,
  paceMinutes: 5,
  paceSeconds: 0,
  speedKph: 0,
  fatigueLevel: 0.5,
  targetIntakePerHour: 60,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 1000,
  waterBagLiters: 1,
  aidStations: [],
};

describe("buildSegments", () => {
  it("prefers manual time overrides over adjusted pacing", () => {
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

  it("slows default timing on climbs using flat-equivalent distance", () => {
    const segments = buildSegments(
      {
        ...baseValues,
        aidStations: [{ name: "Aid 1", distanceKm: 1 }],
      },
      "Start",
      "Finish",
      [
        { distanceKm: 0, elevationM: 0 },
        { distanceKm: 1, elevationM: 100 },
        { distanceKm: 2, elevationM: 100 },
      ]
    );

    expect(segments[0].estimatedSegmentMinutes).toBeCloseTo(10);
    expect(segments[0].segmentMinutes).toBeCloseTo(10);
  });

  it("ignores duplicate and zero-length checkpoints from organizer data", () => {
    const segments = buildSegments(
      {
        ...baseValues,
        aidStations: [
          { name: "Départ dupliqué", distanceKm: 0 },
          { name: "Ravito", distanceKm: 5 },
          { name: "Arrivée organisateur", distanceKm: 5 },
          { name: "Arrivée source", distanceKm: 9.5 },
        ],
      },
      "Départ",
      "Arrivée",
      [],
    );

    expect(segments.map((segment) => [segment.from, segment.checkpoint, segment.segmentKm])).toEqual([
      ["Départ", "Ravito", 5],
      ["Ravito", "Arrivée", 5],
    ]);
    expect(segments.every((segment) => segment.segmentKm > 0)).toBe(true);
  });
});
