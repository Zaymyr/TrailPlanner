import { describe, expect, it } from "vitest";

import {
  applyCommonEquipmentToRace,
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  deriveCommonEquipmentFromRaces,
  dedupeEquipmentItems,
} from "../../../lib/organizer-dashboard-details";

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
