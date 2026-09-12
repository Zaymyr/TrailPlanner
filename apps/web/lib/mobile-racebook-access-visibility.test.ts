import { describe, expect, it } from "vitest";

import { canShowRacebook, isRunnerInfoVisible } from "../../mobile/lib/racebook";

const accessFields = [
  ["officialParkings", "Parking de la mairie"],
  ["shuttles", "Navette depuis la gare"],
  ["roadRestrictions", "Route fermée dès 6 h"],
  ["mapUrl", "https://maps.example.com/start"],
] as const;

describe("mobile Racebook access visibility", () => {
  it("keeps saved runner information hidden until the format access override is enabled", () => {
    const access = {
      overrideEnabled: false,
      startAddress: null,
      startLocation: { label: null, lat: null, lng: null, googleMapsUrl: null, source: null },
      finishAddress: null,
      finishLocation: { label: null, lat: null, lng: null, googleMapsUrl: null, source: null },
      officialParkings: null,
      shuttles: null,
      shuttleSchedule: null,
      roadRestrictions: null,
      mapUrl: null,
      note: null,
      enabledSections: {
        officialParkings: true,
        shuttles: true,
        roadRestrictions: true,
        mapUrl: true,
        runnerInfo: true,
      },
    } as const;

    expect(isRunnerInfoVisible(access)).toBe(false);
    expect(isRunnerInfoVisible({ ...access, overrideEnabled: true })).toBe(true);
    expect(isRunnerInfoVisible({
      ...access,
      overrideEnabled: true,
      enabledSections: { ...access.enabledSections, runnerInfo: false },
    })).toBe(false);
  });

  it("does not let stored runner information alone unlock the RaceBook while its override is disabled", () => {
    expect(canShowRacebook({
      raceIsLive: true,
      racebookIsLive: true,
      hasAidStations: false,
      eventOrganizerDetails: {},
      raceOrganizerDetails: {
        access: { overrideEnabled: false, enabledSections: { runnerInfo: true } },
        runnerInfo: { startArea: "Saved start area" },
      },
    })).toBe(false);
  });

  it("hides a format from its organizer preview independently of publication", () => {
    expect(canShowRacebook({
      raceIsLive: true,
      racebookIsLive: false,
      racebookPreviewIsVisible: false,
      hasOrganizerAccess: true,
      hasAidStations: true,
      eventOrganizerDetails: {},
      raceOrganizerDetails: {},
    })).toBe(false);
  });

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
