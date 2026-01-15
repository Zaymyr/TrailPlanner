import { describe, expect, it } from "vitest";
import type { FormValues } from "../../types";
import { formatMinutes } from "../format";
import { minutesPerKm } from "../pacing";
import { buildSegments } from "../segments";

const baseValues: FormValues = {
  raceDistanceKm: 20,
  elevationGain: 0,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 60,
  waterIntakePerHour: 600,
  sodiumIntakePerHour: 500,
  waterBagLiters: 1,
  aidStations: [],
};

describe("minutesPerKm", () => {
  it("returns minutes per km from pace input", () => {
    const minutes = minutesPerKm({ ...baseValues, paceMinutes: 4, paceSeconds: 30 });

    expect(minutes).toBeCloseTo(4.5);
  });

  it("returns minutes per km from speed input", () => {
    const minutes = minutesPerKm({ ...baseValues, paceType: "speed", speedKph: 12 });

    expect(minutes).toBeCloseTo(5);
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes with padding", () => {
    const units = {
      hourShort: "h",
      minuteShort: "m",
      kilometer: "km",
      meter: "m",
      grams: "g",
      milliliters: "ml",
      milligrams: "mg",
    };

    expect(formatMinutes(125.4, units)).toBe("2h 05m");
  });
});

describe("buildSegments", () => {
  it("builds paced segments with elevation and water tracking", () => {
    const values: FormValues = {
      ...baseValues,
      aidStations: [
        { name: "Aid 1", distanceKm: 8 },
        {
          name: "Aid 2",
          distanceKm: 16,
          paceAdjustmentMinutesPerKm: 1,
          pauseMinutes: 5,
          waterRefill: false,
        },
      ],
    };
    const elevationProfile = [
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 10, elevationM: 200 },
      { distanceKm: 20, elevationM: 150 },
    ];

    const segments = buildSegments(values, "Start", "Finish", elevationProfile);

    expect(segments).toHaveLength(3);
    expect(segments[0].segmentKm).toBe(8);
    expect(segments[0].segmentMinutes).toBeCloseTo(48);
    expect(segments[0].etaMinutes).toBeCloseTo(48);
    expect(segments[0].elevationGainM).toBe(80);
    expect(segments[0].elevationLossM).toBe(0);

    expect(segments[1].paceAdjustmentMinutesPerKm).toBe(1);
    expect(segments[1].segmentMinutes).toBeCloseTo(56);
    expect(segments[1].etaMinutes).toBeCloseTo(104);
    expect(segments[1].pauseMinutes).toBe(5);
    expect(segments[1].elevationGainM).toBe(20);
    expect(segments[1].elevationLossM).toBe(30);

    expect(segments[2].isFinish).toBe(true);
    expect(segments[2].segmentKm).toBe(4);
    expect(segments[2].etaMinutes).toBeCloseTo(133);
    expect(segments[2].plannedWaterMl).toBeCloseTo(440);
    expect(segments[2].elevationGainM).toBe(0);
    expect(segments[2].elevationLossM).toBe(20);
  });
});
