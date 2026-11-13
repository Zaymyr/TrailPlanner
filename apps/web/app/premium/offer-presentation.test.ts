import { describe, expect, it } from "vitest";

import { orderRunnerOffers, resolvePlanCourseName } from "./offer-presentation";

describe("premium offer presentation", () => {
  it("prioritizes the course offer only for a plan-scoped paywall", () => {
    expect(orderRunnerOffers(true)).toEqual(["course", "annual"]);
    expect(orderRunnerOffers(false)).toEqual(["annual", "course"]);
  });

  it("uses the linked race name before the runner plan name", () => {
    expect(resolvePlanCourseName({ name: "Mon plan", races: { name: "Bibracte 12 km" } })).toBe("Bibracte 12 km");
    expect(resolvePlanCourseName({ name: "Mon plan", races: null })).toBe("Mon plan");
  });
});
