import { describe, expect, it } from "vitest";

import {
  applyCommonEquipmentToRace,
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  deriveCommonEquipmentFromRaces,
} from "../../../lib/organizer-dashboard-details";

describe("organizer equipment syncing", () => {
  it("applies shared event equipment to a race while preserving specific items", () => {
    const previousCommon = {
      items: [{ id: "shared-1", label: "Couverture de survie", required: true, note: null }],
      note: null,
    };
    const nextCommon = {
      items: [{ id: "shared-2", label: "Telephone charge", required: true, note: null }],
      note: null,
    };
    const raceEquipment = {
      items: [
        { id: "shared-1", label: "Couverture de survie", required: true, note: null },
        { id: "race-1", label: "Lampe frontale", required: true, note: null },
      ],
      note: null,
    };

    expect(applyCommonEquipmentToRace(previousCommon, nextCommon, raceEquipment).items).toEqual([
      { id: "shared-2", label: "Telephone charge", required: true, note: null },
      { id: "race-1", label: "Lampe frontale", required: true, note: null },
    ]);
  });

  it("derives shared event equipment from the intersection of all race lists", () => {
    const fallback = {
      ...defaultOrganizerEventDetails.mandatoryEquipment,
      note: "Commun",
    };
    const sharedItem = { id: "shared-1", label: "Couverture de survie", required: true, note: null };
    const waterItem = { id: "water-1", label: "Reserve d'eau", required: true, note: null };

    const commonEquipment = deriveCommonEquipmentFromRaces(
      [
        {
          ...defaultOrganizerRaceDetails,
          mandatoryEquipment: {
            items: [sharedItem, waterItem],
            note: null,
          },
        },
        {
          ...defaultOrganizerRaceDetails,
          mandatoryEquipment: {
            items: [sharedItem],
            note: null,
          },
        },
      ],
      fallback
    );

    expect(commonEquipment.items).toEqual([sharedItem]);
    expect(commonEquipment.note).toBe("Commun");
  });

  it("splits shared and specific equipment when building runner-facing details", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      mandatoryEquipment: {
        items: [{ id: "shared-1", label: "Couverture de survie", required: true, note: null }],
        note: "Commun",
      },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      mandatoryEquipment: {
        items: [
          { id: "shared-1", label: "Couverture de survie", required: true, note: null },
          { id: "race-1", label: "Lampe frontale", required: true, note: null },
        ],
        note: "Specifique",
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, raceDetails);

    expect(runnerDetails.commonEquipment.items).toEqual(eventDetails.mandatoryEquipment.items);
    expect(runnerDetails.raceEquipment.items).toEqual([{ id: "race-1", label: "Lampe frontale", required: true, note: null }]);
    expect(runnerDetails.equipment.items).toEqual([
      { id: "shared-1", label: "Couverture de survie", required: true, note: null },
      { id: "race-1", label: "Lampe frontale", required: true, note: null },
    ]);
    expect(runnerDetails.equipment.note).toBe("Commun\nSpecifique");
  });
});
