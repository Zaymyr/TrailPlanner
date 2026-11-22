import { describe, expect, it } from "vitest";

import { formatKpiDelta, sparklinePaths } from "./kpi-delta";

describe("formatKpiDelta", () => {
  it("formats a relative change in French with a coloured direction", () => {
    expect(formatKpiDelta(1284, 1142)).toEqual({ direction: "up", tone: "positive", label: "▲ 12,4 %", description: "en hausse de 12,4 %" });
    expect(formatKpiDelta(342, 353)).toMatchObject({ direction: "down", tone: "negative", label: "▼ 3,1 %" });
  });

  it("shows small counts as an absolute difference", () => {
    expect(formatKpiDelta(23, 21, { mode: "absolute" })).toMatchObject({ label: "▲ 2", tone: "positive", description: "en hausse de 2" });
  });

  it("inverts the colour when lower is better", () => {
    expect(formatKpiDelta(3, 1, { higherIsBetter: false })).toMatchObject({ direction: "up", tone: "negative" });
    expect(formatKpiDelta(1, 3, { higherIsBetter: false })).toMatchObject({ direction: "down", tone: "positive" });
  });

  it("handles a stable value, a zero baseline and a missing baseline", () => {
    expect(formatKpiDelta(5, 5)).toEqual({ direction: "flat", tone: "neutral", label: "=", description: "stable" });
    expect(formatKpiDelta(4, 0)).toMatchObject({ label: "nouveau", tone: "positive" });
    expect(formatKpiDelta(4, null)).toBeNull();
    expect(formatKpiDelta(4, undefined)).toBeNull();
    expect(formatKpiDelta(Number.NaN, 3)).toBeNull();
  });
});

describe("sparklinePaths", () => {
  it("scales the series into the box, highest value at the top", () => {
    expect(sparklinePaths([0, 10], 100, 24)).toEqual({ line: "M0 22 L100 2", area: "M0 22 L100 2 L100 24 L0 24Z" });
  });

  it("draws a flat series in the middle and refuses fewer than two points", () => {
    expect(sparklinePaths([3, 3, 3], 10, 20)?.line).toBe("M0 10 L5 10 L10 10");
    expect(sparklinePaths([3])).toBeNull();
    expect(sparklinePaths([Number.NaN, 2])).toBeNull();
  });
});
