import { describe, expect, it } from "vitest";

import { canShowRacebook } from "../../mobile/lib/racebook";

const accessFields = [
  ["officialParkings", "Parking de la mairie"],
  ["shuttles", "Navette depuis la gare"],
  ["roadRestrictions", "Route fermée dès 6 h"],
  ["mapUrl", "https://maps.example.com/start"],
] as const;

describe("mobile Racebook access visibility", () => {
  it.each(accessFields)("hides saved %s content when its format flag is disabled", (field, value) => {
    expect(
      canShowRacebook({
        raceIsLive: true,
        racebookIsLive: true,
        hasAidStations: false,
        eventOrganizerDetails: {
          access: {
            [field]: value,
          },
        },
        raceOrganizerDetails: {
          access: {
            enabledSections: {
              officialParkings: false,
              shuttles: false,
              roadRestrictions: false,
              mapUrl: false,
            },
          },
        },
      }),
    ).toBe(false);
  });

  it.each(accessFields)("keeps saved %s content when its format flag is enabled", (field, value) => {
    expect(
      canShowRacebook({
        raceIsLive: true,
        racebookIsLive: true,
        hasAidStations: false,
        eventOrganizerDetails: {
          access: {
            [field]: value,
          },
        },
        raceOrganizerDetails: {
          access: {
            enabledSections: {
              officialParkings: field === "officialParkings",
              shuttles: field === "shuttles",
              roadRestrictions: field === "roadRestrictions",
              mapUrl: field === "mapUrl",
            },
          },
        },
      }),
    ).toBe(true);
  });
});
