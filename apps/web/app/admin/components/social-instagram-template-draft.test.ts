import { describe, expect, it } from "vitest";

import {
  applySocialInstagramTemplateOverrides,
  buildSocialInstagramTemplateDraft,
  buildSocialInstagramTemplateOverrides,
} from "../../../lib/social-instagram-template-draft";
import { socialRacePlanTemplateSchema } from "../../../lib/social-race-plan-template";

const template = socialRacePlanTemplateSchema.parse({
  schemaVersion: 1,
  generatedAt: "2026-04-19T10:00:00.000Z",
  plan: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Edition 2026",
  },
  race: {
    name: "Grand Trail du Saint Jacques - 100K",
    subtitle: "Grand Trail du Saint Jacques",
    location: "Le Puy-en-Velay",
    dateIso: "2026-06-12",
    distanceKm: 85.9,
    elevationGainM: 3016,
    targetTime: {
      minutes: 884,
      label: "14h44",
      source: "computed",
    },
  },
  averagesPerHour: {
    carbsG: 45,
    waterMl: 500,
    sodiumMg: 700,
  },
  totals: {
    carbsG: 663,
    waterMl: 7365,
    sodiumMg: 10311,
    durationMinutes: 884,
  },
  startCarry: {
    items: [],
    fallbackUsed: false,
  },
  aidStations: [
    {
      name: "Aid 1",
      km: 24.5,
      eta: { minutes: 250, label: "4h10" },
      take: {
        fallbackUsed: false,
        items: [
          {
            kind: "product",
            label: "Maurten Gel 100",
            productId: "gel-1",
            quantity: 2,
            carbsG: 50,
            waterMl: null,
            sodiumMg: 170,
            note: null,
          },
          {
            kind: "estimate",
            label: "Estimation",
            productId: null,
            quantity: null,
            carbsG: 88,
            waterMl: 625,
            sodiumMg: 750,
            note: "A completer",
          },
        ],
      },
    },
  ],
  assumptions: [],
  disclaimer: "Plan indicatif.",
  cta: "Construit ton plan sur Pace Yourself.",
  missingData: [],
});

describe("social Instagram template draft", () => {
  it("maps the canonical payload into editable Instagram draft fields", () => {
    const draft = buildSocialInstagramTemplateDraft(template);

    expect(draft.raceName).toBe("Grand Trail du Saint Jacques - 100K");
    expect(draft.raceSubtitle).toBe("Grand Trail du Saint Jacques");
    expect(draft.raceYear).toBe("2026");
    expect(draft.startDate).toBe("12 juin 2026");
    expect(draft.raceLocation).toBe("Le Puy-en-Velay");
    expect(draft.totalWaterL).toBe("7.4");
    expect(draft.totalSodiumG).toBe("10.3");
    expect(draft.aidStations[0]?.take).toContain("2 x Maurten Gel 100");
    expect(draft.aidStations[0]?.take).toContain("88g glucides");
  });

  it("builds and reapplies local overrides without losing untouched defaults", () => {
    const defaults = buildSocialInstagramTemplateDraft(template);
    const edited = {
      ...defaults,
      tagline: "Mon ravito ne s'improvise pas.",
      accentKey: "earth" as const,
      aidStations: [...defaults.aidStations, { name: "Finish", km: "85.9", eta: "14h44", take: "Recup" }],
    };

    const overrides = buildSocialInstagramTemplateOverrides(defaults, edited);
    const hydrated = applySocialInstagramTemplateOverrides(defaults, overrides);

    expect(overrides.tagline).toBe("Mon ravito ne s'improvise pas.");
    expect(overrides.accentKey).toBe("earth");
    expect(overrides.aidStations).toHaveLength(2);
    expect(hydrated.tagline).toBe("Mon ravito ne s'improvise pas.");
    expect(hydrated.accentKey).toBe("earth");
    expect(hydrated.raceName).toBe(defaults.raceName);
    expect(hydrated.aidStations[1]?.name).toBe("Finish");
  });
});
