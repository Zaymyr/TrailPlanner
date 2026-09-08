import { describe, expect, it } from "vitest";

import { ORGANIZER_MODULES, getOrganizerModuleState, isOrganizerModuleAvailable } from "./organizer-modules";

describe("organizer module catalog", () => {
  it("declares every module once with its contractual scope", () => {
    expect(new Set(ORGANIZER_MODULES.map((module) => module.key)).size).toBe(11);
    expect(ORGANIZER_MODULES.filter((module) => module.scope === "edition").map((module) => module.key)).toEqual([
      "equipment", "bib_pickup", "access", "services", "branding", "sponsors",
    ]);
  });

  it("locks modules outside the offer even when the organizer left them enabled", () => {
    expect(getOrganizerModuleState("essential", "services", true)).toBe("locked");
    expect(getOrganizerModuleState("complete", "services", true)).toBe("active");
    expect(getOrganizerModuleState("signature", "sponsors", false)).toBe("inactive");
    expect(isOrganizerModuleAvailable("visibility", "equipment")).toBe(false);
  });
});
