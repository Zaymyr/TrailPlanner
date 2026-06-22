import { describe, expect, it } from "vitest";

import { defaultOrganizerEventDetails, defaultOrganizerRaceDetails } from "../../../lib/organizer-dashboard-details";
import { buildOrganizerCompletion, isEventReadyToPublish, type CompletionEvent } from "./completion";

const baseEvent: CompletionEvent = {
  id: "event-1",
  name: "Grand Trail",
  location: "Annecy",
  race_date: "2026-09-12",
  is_live: false,
  organizerDetails: defaultOrganizerEventDetails,
  races: [
    {
      id: "race-1",
      name: "42K",
      distance_km: 42,
      elevation_gain_m: 2400,
      race_date: "2026-09-12",
      gpx_storage_path: "race.gpx",
      is_live: true,
      organizerDetails: defaultOrganizerRaceDetails,
    },
  ],
};

describe("organizer completion", () => {
  it("requires event basics and at least one publishable live format", () => {
    expect(isEventReadyToPublish(baseEvent)).toBe(true);

    expect(isEventReadyToPublish({ ...baseEvent, location: "" })).toBe(false);
    expect(
      isEventReadyToPublish({
        ...baseEvent,
        races: [{ ...baseEvent.races[0]!, is_live: false }],
      })
    ).toBe(false);
    expect(
      isEventReadyToPublish({
        ...baseEvent,
        races: [{ ...baseEvent.races[0]!, distance_km: 0 }],
      })
    ).toBe(false);
  });

  it("marks optional modules as non-blocking while computing a global score", () => {
    const completion = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], []);

    expect(completion.requiredComplete).toBe(true);
    expect(completion.modules.find((module) => module.id === "event")?.status).toBe("complete");
    expect(completion.modules.find((module) => module.id === "formats")?.status).toBe("complete");
    expect(completion.eventModules.find((module) => module.id === "event")?.status).toBe("complete");
    expect(completion.eventModules.some((module) => module.id === "formats")).toBe(false);
    expect(completion.formatModules.find((module) => module.id === "aidStations")?.status).toBe("empty");
    expect(completion.formatModules.some((module) => module.id === "preview")).toBe(false);
    expect(completion.eventScore).toBeGreaterThan(0);
    expect(completion.formatScore).toBeGreaterThan(0);
    expect(completion.modules.find((module) => module.id === "products")?.status).toBe("empty");
    expect(completion.score).toBeGreaterThan(0);
    expect(completion.score).toBeLessThan(100);
  });

  it("does not report format progress when no format is active", () => {
    const completion = buildOrganizerCompletion(baseEvent, null, [], []);

    expect(completion.formatScore).toBe(0);
    expect(completion.formatModules).toHaveLength(0);
    expect(completion.eventScore).toBeGreaterThan(0);
  });

  it("counts equipment items and station products in module statuses", () => {
    const event: CompletionEvent = {
      ...baseEvent,
      organizerDetails: {
        ...defaultOrganizerEventDetails,
        mandatoryEquipment: {
          items: [{ id: "item-1", label: "Couverture de survie", required: true, note: null }],
          note: null,
        },
      },
    };
    const completion = buildOrganizerCompletion(
      event,
      event.races[0]!,
      [],
      [{ aidStationId: "station-1", productId: "product-1" }]
    );

    expect(completion.modules.find((module) => module.id === "equipment")?.status).toBe("complete");
    expect(completion.modules.find((module) => module.id === "products")?.status).toBe("complete");
  });

  it("counts race-specific equipment separately from common equipment", () => {
    const race = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        mandatoryEquipment: {
          items: [{ id: "race-item-1", label: "Lampe frontale", required: true, note: null }],
          note: null,
        },
      },
    };
    const completion = buildOrganizerCompletion({ ...baseEvent, races: [race] }, race, [], []);
    const equipmentModule = completion.modules.find((module) => module.id === "equipment");
    const formatEquipmentModule = completion.formatModules.find((module) => module.id === "equipment");

    expect(equipmentModule?.status).toBe("complete");
    expect(equipmentModule?.countLabel).toBe("0 commun / 1 format");
    expect(formatEquipmentModule?.status).toBe("complete");
    expect(formatEquipmentModule?.countLabel).toBe("0 commun / 1 format");
  });
});
