import { describe, expect, it } from "vitest";

import { buildOrganizerLocation } from "./location-utils";
import {
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  parseOrganizerEventDetails,
} from "./organizer-dashboard-details";

describe("parseOrganizerEventDetails", () => {
  it("normalizes the event links and emergency contact", () => {
    const details = parseOrganizerEventDetails({
      officialWebsiteUrl: "https://grand-trail.example",
      instagramUrl: "https://www.instagram.com/grandtrail",
      facebookUrl: "https://www.facebook.com/grandtrail",
      emergencyContact: { name: "PC course", phone: "06 12 34 56 78" },
    });

    expect(details.officialWebsiteUrl).toBe("https://grand-trail.example");
    expect(details.instagramUrl).toBe("https://www.instagram.com/grandtrail");
    expect(details.facebookUrl).toBe("https://www.facebook.com/grandtrail");
    expect(details.emergencyContact).toEqual({ name: "PC course", phone: "+33 6 12 34 56 78" });
  });

  it("normalizes French international emergency numbers", () => {
    const details = parseOrganizerEventDetails({
      emergencyContact: { name: null, phone: "0033 (0)6.12.34.56.78" },
    });

    expect(details.emergencyContact.phone).toBe("+33 6 12 34 56 78");
  });

  it("keeps short emergency numbers intact", () => {
    const details = parseOrganizerEventDetails({ emergencyContact: { phone: "112" } });

    expect(details.emergencyContact.phone).toBe("112");
  });
});

describe("buildRunnerOrganizerDetails", () => {
  it("keeps event access locations when the race override is empty", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: {
        ...defaultOrganizerEventDetails.access,
        startAddress: "Parking de la mairie",
        startLocation: buildOrganizerLocation({
          label: "Parking de la mairie, Annecy",
          lat: 45.899247,
          lng: 6.129384,
          source: "autocomplete",
        }),
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, defaultOrganizerRaceDetails);

    expect(runnerDetails.access.startAddress).toBe("Parking de la mairie");
    expect(runnerDetails.access.startLocation.label).toBe("Parking de la mairie, Annecy");
    expect(runnerDetails.access.startLocation.lat).toBe(45.899247);
  });

  it("lets a race override event access locations with its own geocoded point", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: {
        ...defaultOrganizerEventDetails.access,
        finishAddress: "Centre ville",
        finishLocation: buildOrganizerLocation({
          label: "Centre ville, Annecy",
          lat: 45.900688,
          lng: 6.129289,
          source: "autocomplete",
        }),
      },
    };

    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: {
        ...defaultOrganizerRaceDetails.access,
        overrideEnabled: true,
        finishAddress: "Ligne d'arrivée format 80K",
        finishLocation: buildOrganizerLocation({
          label: "Ligne d'arrivée format 80K, Annecy",
          lat: 45.901111,
          lng: 6.130222,
          source: "autocomplete",
        }),
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, raceDetails);

    expect(runnerDetails.access.finishAddress).toBe("Ligne d'arrivée format 80K");
    expect(runnerDetails.access.finishLocation.label).toBe("Ligne d'arrivée format 80K, Annecy");
    expect(runnerDetails.access.finishLocation.lng).toBe(6.130222);
  });

  it("inherits event access until the format override is explicitly enabled", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: { ...defaultOrganizerEventDetails.access, startAddress: "Départ commun" },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: { ...defaultOrganizerRaceDetails.access, overrideEnabled: false, startAddress: "Départ format" },
    };

    expect(buildRunnerOrganizerDetails(eventDetails, raceDetails).access.startAddress).toBe("Départ commun");
    expect(
      buildRunnerOrganizerDetails(eventDetails, {
        ...raceDetails,
        access: { ...raceDetails.access, overrideEnabled: true },
      }).access.startAddress
    ).toBe("Départ format");
  });

  it("preserves legacy format access values without an override flag", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: { ...defaultOrganizerEventDetails.access, startAddress: "Départ commun", officialParkings: "Parking commun" },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: { ...defaultOrganizerRaceDetails.access, overrideEnabled: undefined, startAddress: "Départ historique" },
    };

    const access = buildRunnerOrganizerDetails(eventDetails, raceDetails).access;

    expect(access.startAddress).toBe("Départ historique");
    expect(access.officialParkings).toBe("Parking commun");
  });

  it("uses format equipment only when its explicit override is enabled", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      mandatoryEquipment: {
        ...defaultOrganizerEventDetails.mandatoryEquipment,
        items: [{ id: "event-item", label: "Couverture", required: true, cold: false, heat: false, note: null }],
      },
    };
    const formatEquipment = {
      ...defaultOrganizerRaceDetails,
      mandatoryEquipment: {
        ...defaultOrganizerRaceDetails.mandatoryEquipment,
        items: [{ id: "format-item", label: "Lampe", required: true, cold: false, heat: false, note: null }],
      },
    };

    expect(buildRunnerOrganizerDetails(eventDetails, formatEquipment).equipment.items.map((item) => item.label)).toEqual(["Couverture"]);
    expect(
      buildRunnerOrganizerDetails(eventDetails, {
        ...formatEquipment,
        mandatoryEquipment: { ...formatEquipment.mandatoryEquipment, overrideEnabled: true },
      }).equipment.items.map((item) => item.label)
    ).toEqual(["Lampe"]);
  });
});
