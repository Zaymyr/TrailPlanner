import { describe, expect, it } from "vitest";

import {
  defaultOrganizerAidStationDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
} from "../../../lib/organizer-dashboard-details";
import { buildOrganizerCompletion, isEventReadyToPublish, type CompletionEvent } from "./completion";

const baseEvent: CompletionEvent = {
  id: "event-1",
  name: "Grand Trail",
  location: "Annecy",
  race_date: "2026-09-12",
  is_live: false,
  organizerDetails: {
    ...defaultOrganizerEventDetails,
    dateRange: { endDate: "2026-09-13" },
  },
  races: [
    {
      id: "race-1",
      edition_group_id: "series-42k",
      series_name: "42K",
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
    expect(isEventReadyToPublish({ ...baseEvent, organizerDetails: { ...baseEvent.organizerDetails!, dateRange: { endDate: null } } })).toBe(false);
    expect(isEventReadyToPublish({ ...baseEvent, races: [{ ...baseEvent.races[0]!, is_live: false }] })).toBe(false);
    expect(isEventReadyToPublish({ ...baseEvent, races: [{ ...baseEvent.races[0]!, distance_km: 0 }] })).toBe(false);
  });

  it("keeps products inside the aid station module and removes schedule/products format tiles", () => {
    const completion = buildOrganizerCompletion(
      {
        ...baseEvent,
        races: [
          {
            ...baseEvent.races[0]!,
            organizerDetails: {
              ...defaultOrganizerRaceDetails,
              schedule: { ...defaultOrganizerRaceDetails.schedule, startTime: "07:00", finishCutoffTime: "15:00" },
            },
          },
        ],
      },
      {
        ...baseEvent.races[0]!,
        organizerDetails: {
          ...defaultOrganizerRaceDetails,
          schedule: { ...defaultOrganizerRaceDetails.schedule, startTime: "07:00", finishCutoffTime: "15:00" },
        },
      },
      [
        {
          id: "station-1",
          name: "Base vie",
          distanceKm: 12,
          waterRefill: true,
          solidRefill: true,
          assistanceAllowed: true,
          organizerDetails: defaultOrganizerAidStationDetails,
        },
      ],
      [{ aidStationId: "station-1", productId: "product-1" }]
    );

    expect(completion.modules.find((module) => module.id === "aidStations")?.countLabel).toContain("1 produit");
    expect(completion.formatModules.some((module) => module.id === "products")).toBe(false);
    expect(completion.formatModules.some((module) => module.id === "bibPickup")).toBe(false);
  });

  it("reports missing labels for event and format identity modules", () => {
    const incompleteRace = {
      ...baseEvent.races[0]!,
      name: "",
      distance_km: 0,
      elevation_gain_m: Number.NaN,
    };
    const completion = buildOrganizerCompletion(
      {
        ...baseEvent,
        name: "",
        location: "",
        race_date: "",
        organizerDetails: { ...baseEvent.organizerDetails!, dateRange: { endDate: null } },
        races: [incompleteRace],
      },
      incompleteRace,
      [],
      []
    );

    expect(completion.eventModules.find((module) => module.id === "event")?.missingLabels).toEqual(["Nom", "Lieu", "Début édition", "Fin édition"]);
    expect(completion.formatModules.find((module) => module.id === "formats")?.missingLabels).toEqual(["Nom", "Distance", "D+"]);
  });

  it("counts disabled access sections as satisfied", () => {
    const race = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        access: {
          ...defaultOrganizerRaceDetails.access,
          startAddress: "1 rue du départ",
          enabledSections: {
            ...defaultOrganizerRaceDetails.access.enabledSections,
            officialParkings: false,
            shuttles: false,
            roadRestrictions: false,
            mapUrl: false,
            runnerInfo: false,
          },
        },
      },
    };
    const completion = buildOrganizerCompletion({ ...baseEvent, races: [race] }, race, [], []);
    expect(completion.formatModules.find((module) => module.id === "access")?.missingLabels).toEqual([]);
  });

  it("requires a complete dated time slot for every structured bib pickup location", () => {
    const organizerDetails = {
      ...defaultOrganizerEventDetails,
      dateRange: { endDate: "2026-09-13" },
      bibPickup: {
        ...defaultOrganizerEventDetails.bibPickup,
        locations: [
          {
            location: "Gymnase central",
            locationDetails: defaultOrganizerEventDetails.bibPickup.locationDetails,
            slots: [{ date: "2026-09-11", startTime: "16:00", endTime: "20:00" }],
          },
          {
            location: "Office du tourisme",
            locationDetails: defaultOrganizerEventDetails.bibPickup.locationDetails,
            slots: [],
          },
        ],
      },
    };
    const incomplete = buildOrganizerCompletion({ ...baseEvent, organizerDetails }, baseEvent.races[0]!, [], []);
    const complete = buildOrganizerCompletion(
      {
        ...baseEvent,
        organizerDetails: {
          ...organizerDetails,
          bibPickup: {
            ...organizerDetails.bibPickup,
            locations: organizerDetails.bibPickup.locations.map((location, index) =>
              index === 1
                ? { ...location, slots: [{ date: "2026-09-12", startTime: "06:00", endTime: "08:00" }] }
                : location
            ),
          },
        },
      },
      baseEvent.races[0]!,
      [],
      []
    );

    expect(incomplete.eventModules.find((module) => module.id === "bibPickup")?.missingLabels).toEqual(["Jours et horaires"]);
    expect(complete.eventModules.find((module) => module.id === "bibPickup")?.missingLabels).toEqual([]);
  });

  it("derives event header progress from per-format completion modules", () => {
    const completion = buildOrganizerCompletion(
      {
        ...baseEvent,
        races: [
          {
            ...baseEvent.races[0]!,
            gpx_storage_path: "race.gpx",
          },
          {
            ...baseEvent.races[0]!,
            id: "race-2",
            edition_group_id: "series-25k",
            series_name: "25K",
            name: "25K",
            gpx_storage_path: null,
          },
        ],
      },
      baseEvent.races[0]!,
      [],
      []
    );

    expect(completion.raceProgress).toEqual([
      { id: "race-1", editionGroupId: "series-42k", seriesName: "42K", name: "42K", score: 25 },
      { id: "race-2", editionGroupId: "series-25k", seriesName: "25K", name: "25K", score: 25 },
    ]);
    expect(completion.raceProgressScore).toBe(25);
  });

  it("does not change completion percentages when publication toggles change", () => {
    const draftRace = { ...baseEvent.races[0]!, is_live: false };
    const draftCompletion = buildOrganizerCompletion({ ...baseEvent, is_live: false, races: [draftRace] }, draftRace, [], []);
    const liveCompletion = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], []);

    expect(draftCompletion.raceProgress).toEqual(liveCompletion.raceProgress);
    expect(draftCompletion.raceProgressScore).toBe(liveCompletion.raceProgressScore);
    expect(draftCompletion.formatModules.find((module) => module.id === "formats")?.status).toBe("complete");
  });

  it("keeps per-format progress independent from the selected tab sidecars", () => {
    const races = [
      { ...baseEvent.races[0]!, aidStationCount: 1 },
      {
        ...baseEvent.races[0]!,
        id: "race-2",
        edition_group_id: "series-25k",
        series_name: "25K",
        name: "25K",
        aidStationCount: 0,
      },
    ];
    const selectedRaceSidecars = [
      {
        id: "station-1",
        name: "Base vie",
        distanceKm: 12,
        waterRefill: true,
        solidRefill: true,
        assistanceAllowed: true,
        organizerDetails: defaultOrganizerAidStationDetails,
      },
    ];

    const firstSelected = buildOrganizerCompletion({ ...baseEvent, races }, races[0]!, selectedRaceSidecars, []);
    const secondSelected = buildOrganizerCompletion({ ...baseEvent, races }, races[1]!, selectedRaceSidecars, []);

    expect(firstSelected.raceProgress).toEqual(secondSelected.raceProgress);
    expect(firstSelected.raceProgressScore).toBe(secondSelected.raceProgressScore);
    expect(firstSelected.raceProgress[0]?.score).toBe(50);
    expect(firstSelected.raceProgress[1]?.score).toBe(25);
  });

  it("marks re-enabled empty access sections as incomplete", () => {
    const race = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        access: {
          ...defaultOrganizerRaceDetails.access,
          startAddress: "1 rue du départ",
          enabledSections: {
            ...defaultOrganizerRaceDetails.access.enabledSections,
            officialParkings: true,
            shuttles: true,
          },
          officialParkings: null,
          shuttles: null,
          shuttleSchedule: null,
        },
      },
    };
    const completion = buildOrganizerCompletion({ ...baseEvent, races: [race] }, race, [], []);
    expect(completion.formatModules.find((module) => module.id === "access")?.missingLabels).toContain("Parkings");
    expect(completion.formatModules.find((module) => module.id === "access")?.missingLabels).toContain("Navettes");
  });
});
