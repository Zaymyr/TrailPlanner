import { describe, expect, it } from "vitest";

import {
  CARB_COMPARISONS,
  buildCarbCalculatorShareUrl,
  formatCarbComparison,
  formatDurationDifference,
  getCarbComparison,
  parseSharedCarbCalculatorState,
  selectCarbComparison,
} from "../../lib/carb-calculator-fun";

describe("carb calculator fun comparisons", () => {
  it("keeps stable unique comparison ids", () => {
    const ids = CARB_COMPARISONS.map((comparison) => comparison.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getCarbComparison("kilian-utmb-2022")?.finishSeconds).toBe(71370);
  });

  it("selects deterministically and avoids the previous comparison", () => {
    expect(selectCarbComparison(null, 0).id).toBe("kilian-utmb-2022");
    expect(selectCarbComparison("kilian-utmb-2022", 0).id).toBe("mathieu-utmb-2022");
    expect(selectCarbComparison("katie-utmb-2024", 0.999999).id).toBe("courtney-utmb-2023");
  });

  it("formats differences before, after, and around the elite time", () => {
    const comparison = getCarbComparison("kilian-utmb-2022")!;
    expect(formatDurationDifference(2 * 3600 + 10 * 60)).toBe("2 h 10");
    expect(formatCarbComparison(comparison, 24)).toContain("te mettrait 4 h 11");
    expect(formatCarbComparison(comparison, 6)).toContain("plus court");
    expect(formatCarbComparison(comparison, comparison.finishSeconds / 3600)).toContain("Photo-finish");
  });
});

describe("shared carb calculator state", () => {
  it("parses a complete valid shared result", () => {
    expect(
      parseSharedCarbCalculatorState("duration=6.5&tolerance=55&comparison=courtney-utmb-2023"),
    ).toEqual({ duration: 6.5, tolerance: 55, comparisonId: "courtney-utmb-2023" });
  });

  it.each([
    "duration=6&tolerance=50",
    "duration=6.25&tolerance=50&comparison=kilian-utmb-2022",
    "duration=6&tolerance=53&comparison=kilian-utmb-2022",
    "duration=31&tolerance=50&comparison=kilian-utmb-2022",
    "duration=6&tolerance=50&comparison=unknown",
  ])("rejects an incomplete or invalid query: %s", (query) => {
    expect(parseSharedCarbCalculatorState(query)).toBeNull();
  });

  it("builds a canonical reproducible URL", () => {
    expect(
      buildCarbCalculatorShareUrl("https://pace-yourself.com/calculateur-glucides-trail?old=1#result", {
        duration: 12,
        tolerance: 75,
        comparisonId: "jim-utmb-2023",
      }),
    ).toBe(
      "https://pace-yourself.com/calculateur-glucides-trail?duration=12&tolerance=75&comparison=jim-utmb-2023",
    );
  });
});
