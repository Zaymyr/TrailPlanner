import { describe, expect, it } from "vitest";

import { buildOrganizerLocation } from "./location-utils";
import {
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
} from "./organizer-dashboard-details";

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
});
