import { describe, expect, it } from "vitest";

import {
  CARB_COMPARISONS,
  CARB_JOKES,
  buildCarbCalculatorShareUrl,
  formatAverageSpeed,
  formatCarbComparison,
  formatDurationDifference,
  getAverageSpeed,
  getCarbComparison,
  parseSharedCarbCalculatorState,
  selectCarbComparison,
  selectCarbJoke,
} from "../../lib/carb-calculator-fun";

describe("carb calculator fun comparisons", () => {
  it("keeps stable unique comparison and joke ids", () => {
    expect(new Set(CARB_COMPARISONS.map((comparison) => comparison.id)).size).toBe(CARB_COMPARISONS.length);
    expect(new Set(CARB_JOKES.map((joke) => joke.id)).size).toBe(CARB_JOKES.length);
    expect(getCarbComparison("kilian-utmb-2022")?.finishSeconds).toBe(71370);
  });

  it("selects deterministically without immediately repeating", () => {
    expect(selectCarbComparison(null, 0).id).toBe("kilian-utmb-2022");
    expect(selectCarbComparison("kilian-utmb-2022", 0).id).toBe("mathieu-utmb-2022");
    expect(selectCarbJoke(null, 0).id).toBe("nutella");
    expect(selectCarbJoke("nutella", 0).id).toBe("buffet");
  });

  it("computes and formats average speed", () => {
    expect(getAverageSpeed(50, 10)).toBe(5);
    expect(getAverageSpeed(50, 0)).toBe(0);
    expect(formatAverageSpeed(8.594)).toBe("8,6 km/h");
    expect(formatDurationDifference(2 * 3600 + 10 * 60)).toBe("2 h 10");
  });

  it("returns a short projected comparison and a separate punchline", () => {
    const comparison = getCarbComparison("kilian-utmb-2022")!;
    const slower = formatCarbComparison(comparison, {
      duration: 10,
      distance: 50,
      elevation: 3000,
      jokeId: "nutella",
    });
    const faster = formatCarbComparison(comparison, {
      duration: 4,
      distance: 50,
      elevation: 500,
      jokeId: "gps",
    });
    expect(slower.headline).toContain("50 km / 3 000 m D+");
    expect(slower.headline).toContain("avant toi");
    expect(slower.punchline).toContain("Nutella");
    expect(faster.headline).toContain("avant Kilian Jornet");
    expect(faster.punchline).toContain("hors parcours");
  });
});

describe("shared carb calculator state", () => {
  it("parses a complete valid shared result", () => {
    expect(
      parseSharedCarbCalculatorState(
        "duration=10.5&tolerance=55&distance=80&elevation=4200&comparison=courtney-utmb-2023&joke=marmot",
      ),
    ).toEqual({
      duration: 10.5,
      tolerance: 55,
      distance: 80,
      elevation: 4200,
      comparisonId: "courtney-utmb-2023",
      jokeId: "marmot",
    });
  });

  it.each([
    "duration=6&tolerance=50&distance=50&elevation=2000&comparison=kilian-utmb-2022",
    "duration=6&distance=50&elevation=2000&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6&tolerance=50&distance=50&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6.25&tolerance=50&distance=50&elevation=2000&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6&tolerance=53&distance=50&elevation=2000&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6&tolerance=50&distance=52&elevation=2000&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6&tolerance=50&distance=50&elevation=2050&comparison=kilian-utmb-2022&joke=nutella",
    "duration=6&tolerance=50&distance=50&elevation=2000&comparison=unknown&joke=nutella",
    "duration=6&tolerance=50&distance=50&elevation=2000&comparison=kilian-utmb-2022&joke=unknown",
  ])("rejects an incomplete or invalid query: %s", (query) => {
    expect(parseSharedCarbCalculatorState(query)).toBeNull();
  });

  it("builds a canonical reproducible URL with course context", () => {
    expect(
      buildCarbCalculatorShareUrl("https://pace-yourself.com/calculateur-glucides-trail?old=1#result", {
        duration: 12,
        tolerance: 75,
        distance: 80,
        elevation: 4000,
        comparisonId: "jim-utmb-2023",
        jokeId: "strava",
      }),
    ).toBe(
      "https://pace-yourself.com/calculateur-glucides-trail?duration=12&tolerance=75&distance=80&elevation=4000&comparison=jim-utmb-2023&joke=strava",
    );
  });
});
