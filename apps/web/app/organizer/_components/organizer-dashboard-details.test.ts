import { describe, expect, it } from "vitest";

import {
  applyCommonEquipmentToRace,
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  deriveCommonEquipmentFromRaces,
  dedupeEquipmentItems,
  getOrganizerBibPickupLocations,
  parseOrganizerEventDetails,
} from "../../../lib/organizer-dashboard-details";

describe("organizer bib pickup details", () => {
  it("keeps legacy bib pickup data available as one fallback location", () => {
    const eventDetails = parseOrganizerEventDetails({
      bibPickup: {
        location: "Salle des fêtes, Annecy",
        schedule: "Vendredi de 16h à 20h",
      },
    });

    expect(eventDetails.bibPickup.locations).toEqual([]);
    expect(getOrganizerBibPickupLocations(eventDetails.bibPickup)).toEqual([
      {
        location: "Salle des fêtes, Annecy",
        locationDetails: defaultOrganizerEventDetails.bibPickup.locationDetails,
        slots: [],
      },
    ]);
    expect(eventDetails.bibPickup.schedule).toBe("Vendredi de 16h à 20h");
  });

  it("parses several bib pickup locations with independent dated time slots", () => {
    const eventDetails = parseOrganizerEventDetails({
      bibPickup: {
        locations: [
          {
            location: "Gymnase central",
            slots: [
              { date: "2026-09-18", startTime: "16:00", endTime: "20:00" },
              { date: "2026-09-19", startTime: "06:00", endTime: "08:00" },
            ],
          },
          {
            location: "Office du tourisme",
            slots: [{ date: "2026-09-18", startTime: "14:00", endTime: "18:00" }],
          },
        ],
      },
    });

    expect(eventDetails.bibPickup.locations).toHaveLength(2);
    expect(eventDetails.bibPickup.locations[0]?.slots).toHaveLength(2);
    expect(eventDetails.bibPickup.locations[1]?.slots[0]).toEqual({
      date: "2026-09-18",
      startTime: "14:00",
      endTime: "18:00",
    });
  });

  it("uses the format pickup only when its explicit override is enabled", () => {
    const eventDetails = parseOrganizerEventDetails({
      bibPickup: { location: "Retrait commun" },
    });
    const sharedRaceDetails = {
      ...defaultOrganizerRaceDetails,
      bibPickup: { ...defaultOrganizerRaceDetails.bibPickup, location: "Retrait format" },
    };
    const overrideRaceDetails = {
      ...sharedRaceDetails,
      bibPickup: { ...sharedRaceDetails.bibPickup, overrideEnabled: true },
    };

    expect(buildRunnerOrganizerDetails(eventDetails, sharedRaceDetails).bibPickup.location).toBe("Retrait commun");
    expect(buildRunnerOrganizerDetails(eventDetails, overrideRaceDetails).bibPickup.location).toBe("Retrait format");
  });
});

describe("organizer equipment syncing", () => {
  it("dedupes by weather tags as well as label and requirement", () => {
    const baseItem = { id: "shared-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null };
    const coldItem = { ...baseItem, id: "shared-2", cold: true };

    expect(dedupeEquipmentItems([baseItem, baseItem, coldItem])).toEqual([baseItem, coldItem]);
  });

  it("applies shared event equipment to a race while preserving specific items", () => {
    const previousCommon = {
      weatherPlan: "normal" as const,
      items: [{ id: "shared-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null }],
      note: null,
    };
    const nextCommon = {
      weatherPlan: "cold" as const,
      items: [{ id: "shared-2", label: "Telephone charge", required: true, cold: true, heat: false, note: null }],
      note: null,
    };
    const raceEquipment = {
      weatherPlan: "normal" as const,
      items: [
        { id: "shared-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null },
        { id: "race-1", label: "Lampe frontale", required: true, cold: false, heat: false, note: null },
      ],
      note: null,
    };

    expect(applyCommonEquipmentToRace(previousCommon, nextCommon, raceEquipment)).toEqual({
      weatherPlan: "normal",
      items: [
        { id: "shared-2", label: "Telephone charge", required: true, cold: true, heat: false, note: null },
        { id: "race-1", label: "Lampe frontale", required: true, cold: false, heat: false, note: null },
      ],
      note: null,
    });
  });

  it("derives shared event equipment from the intersection of all race lists", () => {
    const fallback = {
      ...defaultOrganizerEventDetails.mandatoryEquipment,
      weatherPlan: "heat" as const,
      note: "Commun",
    };
    const sharedItem = { id: "shared-1", label: "Couverture de survie", required: true, cold: true, heat: false, note: null };
    const waterItem = { id: "water-1", label: "Reserve d'eau", required: true, cold: false, heat: true, note: null };

    const commonEquipment = deriveCommonEquipmentFromRaces(
      [
        {
          ...defaultOrganizerRaceDetails,
          mandatoryEquipment: {
            weatherPlan: "normal",
            items: [sharedItem, waterItem],
            note: null,
          },
        },
        {
          ...defaultOrganizerRaceDetails,
          mandatoryEquipment: {
            weatherPlan: "normal",
            items: [sharedItem],
            note: null,
          },
        },
      ],
      fallback
    );

    expect(commonEquipment.items).toEqual([sharedItem]);
    expect(commonEquipment.note).toBe("Commun");
    expect(commonEquipment.weatherPlan).toBe("heat");
  });

  it("marks weather-tagged equipment inactive when no plan is active", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      mandatoryEquipment: {
        weatherPlan: "normal" as const,
        items: [
          { id: "shared-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null },
          { id: "shared-2", label: "Gants chauds", required: true, cold: true, heat: false, note: null },
          { id: "shared-3", label: "Casquette", required: false, cold: false, heat: true, note: null },
        ],
        note: "Commun",
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, defaultOrganizerRaceDetails);

    expect(runnerDetails.equipmentStatus.items).toEqual([
      { id: "shared-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null, active: true },
      { id: "shared-2", label: "Gants chauds", required: true, cold: true, heat: false, note: null, active: false },
      { id: "shared-3", label: "Casquette", required: false, cold: false, heat: true, note: null, active: false },
    ]);
  });

  it("activates weather-tagged equipment for the matching weather plan", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      mandatoryEquipment: {
        weatherPlan: "cold" as const,
        items: [{ id: "shared-1", label: "Gants chauds", required: true, cold: true, heat: false, note: null }],
        note: "Commun",
      },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      mandatoryEquipment: {
        weatherPlan: "normal" as const,
        items: [{ id: "race-1", label: "Casquette", required: false, cold: false, heat: true, note: null }],
        note: "Specifique",
      },
    };

    const coldRunnerDetails = buildRunnerOrganizerDetails(eventDetails, raceDetails);
    const heatRunnerDetails = buildRunnerOrganizerDetails(
      {
        ...eventDetails,
        mandatoryEquipment: { ...eventDetails.mandatoryEquipment, weatherPlan: "heat" },
      },
      raceDetails
    );

    expect(coldRunnerDetails.equipmentStatus.items.map((item) => ({ label: item.label, active: item.active }))).toEqual([
      { label: "Gants chauds", active: true },
      { label: "Casquette", active: false },
    ]);
    expect(heatRunnerDetails.equipmentStatus.items.map((item) => ({ label: item.label, active: item.active }))).toEqual([
      { label: "Gants chauds", active: false },
      { label: "Casquette", active: true },
    ]);
  });
});
