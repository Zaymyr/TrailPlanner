import { describe, expect, it } from "vitest";

import { buildOrganizerRacebookPreviewModel } from "./index";

describe("buildOrganizerRacebookPreviewModel", () => {
  it("renders draft content locally, including draft-only modules", () => {
    const model = buildOrganizerRacebookPreviewModel({
      event: { id: "event-1", name: "Trail des Bauges", organizerDetails: { mandatoryEquipment: { items: [{ label: "Coupe-vent", required: true }], weatherPlan: "normal" } } },
      format: { id: "race-1", name: "42 km", distanceKm: 42, elevationGainM: 2100, participationMode: "solo" },
      modules: { services: true, officialProducts: true },
      moduleStatus: { services: "draftOnly", officialProducts: "draftOnly" },
      aidStations: [{ id: "station-1", name: "Col", distanceKm: 18, waterRefill: true, organizerDetails: {} }],
      stationProducts: [{ id: "product-1", aidStationId: "station-1", product: { name: "Gel citron" } }],
    });

    expect(model.data.race.name).toBe("42 km");
    expect(model.data.aidStations[0]?.products[0]?.label).toBe("Gel citron");
    expect(model.modules.services).toBe(true);
    expect(model.moduleStatus.services).toBe("draftOnly");
  });

  it("keeps partial drafts safe and filters only invalid structured entries", () => {
    const model = buildOrganizerRacebookPreviewModel({
      format: { name: "", distanceKm: null },
      startWaves: [{ name: "SAS A", startTime: "invalid" }],
      services: [{ serviceType: "restaurant", name: "" }, { serviceType: "other", name: "Village expo" }],
      gpx: { elevationProfile: [{ distanceKm: 0, elevationM: 500, lat: 45.1, lon: 6.2 }, { distanceKm: null, elevationM: 600 }] },
    });

    expect(model.data.race.name).toBe("—");
    expect(model.data.startWaves[0]?.startTime).toBe("—");
    expect(model.data.editionServices).toHaveLength(1);
    expect(model.route.previewPoints).toEqual([{ latitude: 45.1, longitude: 6.2 }]);
  });

  it("uses the format override only when it is explicitly enabled", () => {
    const input = {
      event: { organizerDetails: { access: { note: "Navette événement", enabledSections: {} } } },
      format: { organizerDetails: { access: { overrideEnabled: false, note: "Navette format", enabledSections: {} } } },
    };
    expect(buildOrganizerRacebookPreviewModel(input).data.access.note).toBe("Navette événement");
    expect(buildOrganizerRacebookPreviewModel({ ...input, format: { organizerDetails: { access: { overrideEnabled: true, note: "Navette format", enabledSections: {} } } } }).data.access.note).toBe("Navette format");
  });

  it("preserves the date range, start coordinates, event location and legacy bib schedule", () => {
    const model = buildOrganizerRacebookPreviewModel({
      event: {
        raceDate: "2027-06-12",
        endDate: "2027-06-13",
        organizerDetails: {
          eventLocation: { label: "Annecy", lat: 45.899, lng: 6.129 },
          bibPickup: { schedule: "Vendredi de 16 h à 20 h" },
        },
      },
      format: {
        organizerDetails: {
          raceLocation: { label: "Le Pâquier", lat: 45.903, lng: 6.127 },
        },
      },
    });

    expect(model.data.event.endDate).toBe("2027-06-13");
    expect(model.data.event.locationDetails).toMatchObject({ label: "Annecy", lat: 45.899, lng: 6.129 });
    expect(model.data.race).toMatchObject({ startLatitude: 45.903, startLongitude: 6.127 });
    expect(model.data.bibPickup.schedule).toBe("Vendredi de 16 h à 20 h");
  });
});
