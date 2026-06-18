import { describe, expect, it } from "vitest";

import { autoSegmentSection } from "./segmentation";

const buildSamples = (points: Array<[number, number]>) =>
  points.map(([distanceKm, elevationM]) => ({ distanceKm, elevationM }));

describe("autoSegmentSection", () => {
  it.each([
    { preset: "grossier", slopePct: 4 },
    { preset: "moyen", slopePct: 3 },
    { preset: "fin", slopePct: 2 },
  ] as const)("classifies climbs at the %s threshold", ({ preset, slopePct }) => {
    const samples = buildSamples([
      [0, 0],
      [1, slopePct * 10],
    ]);

    const segments = autoSegmentSection(samples, preset);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.label).toBe("climb");
    expect(segments[0]?.segmentKm).toBeCloseTo(1);
  });

  it("merges consecutive same-type intervals", () => {
    const samples = buildSamples([
      [0, 0],
      [1, 50],
      [2, 100],
    ]);

    const segments = autoSegmentSection(samples, "fin");

    expect(segments).toHaveLength(1);
    expect(segments[0]?.label).toBe("climb");
    expect(segments[0]?.segmentKm).toBeCloseTo(2);
  });

  it("merges short intervals into neighboring segments", () => {
    const samples = buildSamples([
      [0, 0],
      [1, 50],
      [1.2, 50],
      [2.2, 100],
    ]);

    const segments = autoSegmentSection(samples, "fin");

    expect(segments).toHaveLength(1);
    expect(segments[0]?.label).toBe("climb");
    expect(segments[0]?.segmentKm).toBeCloseTo(2.2);
  });
});
