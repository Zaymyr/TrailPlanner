import { describe, expect, it } from "vitest";

import { ORGANIZER_MODULES, getMinimumOrganizerPublicationTier, getOrganizerModuleState, isOrganizerModuleAvailable } from "./organizer-modules";

describe("organizer module catalog", () => {
  it("declares every module once with its contractual scope", () => {
    expect(new Set(ORGANIZER_MODULES.map((module) => module.key)).size).toBe(11);
    expect(ORGANIZER_MODULES.filter((module) => module.scope === "edition").map((module) => module.key)).toEqual([
      "equipment", "bib_pickup", "access", "services", "branding", "sponsors",
    ]);
  });

  it("keeps modules outside the offer editable as private drafts", () => {
    expect(getOrganizerModuleState("essential", "services", true)).toBe("draftOnly");
    expect(getOrganizerModuleState("complete", "services", true)).toBe("active");
    expect(getOrganizerModuleState("signature", "sponsors", false)).toBe("inactive");
    expect(isOrganizerModuleAvailable("visibility", "equipment")).toBe(false);
  });

  it("returns the highest minimum tier among populated modules", () => {
    expect(getMinimumOrganizerPublicationTier([])).toBe("essential");
    expect(getMinimumOrganizerPublicationTier(["aid_stations", "services"])).toBe("complete");
    expect(getMinimumOrganizerPublicationTier(["services", "branding"])).toBe("signature");
    expect(getMinimumOrganizerPublicationTier(["equipment"], ["format_equipment"])).toBe("complete");
  });
});
