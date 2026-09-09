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
      slug: "42k",
      location_text: "Annecy",
      external_site_url: "https://trail.example/42k",
      distance_km: 42,
      elevation_gain_m: null,
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
    expect(completion.formatModules.find((module) => module.id === "bibPickup")?.title).toBe("Dossard");
  });

  it("uses the persisted ravito count before lazy sidecars are loaded", () => {
    const race = { ...baseEvent.races[0]!, aidStationCount: 3 };
    const completion = buildOrganizerCompletion(
      { ...baseEvent, races: [race] },
      race,
      [],
      [],
      { aidStations: race.aidStationCount }
    );

    const selectedModule = completion.formatModules.find((item) => item.id === "aidStations");
    expect(selectedModule?.status).toBe("incomplete");
    expect(selectedModule?.countLabel).toContain("3 ravitos");
    expect(selectedModule?.countLabel).not.toContain("produit");
    expect(selectedModule?.missingLabels).not.toContain("Ravitos");
  });

  it("shows edition sponsor and aggregate click counts on the optional tile", () => {
    const completion = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], [], {
      sponsors: 3,
      sponsorClicks: 12,
    });

    const selectedModule = completion.eventModules.find((item) => item.id === "sponsors");
    expect(selectedModule?.status).toBe("complete");
    expect(selectedModule?.countLabel).toContain("3 sponsors");
    expect(selectedModule?.countLabel).toContain("12 clics");
  });

  it("uses edition tile summaries before lazy editors are opened", () => {
    const completion = buildOrganizerCompletion(
      {
        ...baseEvent,
        editions: [{
          id: "edition-1",
          start_date: "2026-09-12",
          end_date: "2026-09-13",
          is_current: true,
          serviceCount: 2,
          sponsorCount: 1,
          sponsorClicks: 4,
          brandingConfigured: true,
          brandingUnpublished: false,
        }],
      },
      baseEvent.races[0]!,
      [],
      []
    );

    expect(completion.eventModules.find((module) => module.id === "services")).toMatchObject({ status: "complete", countLabel: "2 fiches" });
    expect(completion.eventModules.find((module) => module.id === "sponsors")).toMatchObject({ status: "complete" });
    expect(completion.eventModules.find((module) => module.id === "branding")).toMatchObject({ status: "complete" });
  });

  it("prioritizes an unpublished branding draft over the last published state", () => {
    const completion = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], [], {
      brandingConfigured: true,
      brandingUnpublished: true,
    });

    const selectedModule = completion.eventModules.find((item) => item.id === "branding");
    expect(selectedModule?.status).toBe("incomplete");
    expect(selectedModule?.countLabel).toBe("Brouillon non publié");
  });

  it("reports missing labels for event and format identity modules", () => {
    const incompleteRace = {
      ...baseEvent.races[0]!,
      name: "",
      distance_km: 0,
      location_text: "",
      external_site_url: "",
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
    expect(completion.formatModules.find((module) => module.id === "formats")?.missingLabels).toEqual(["Nom", "Lieu", "Distance", "Source"]);
  });

  it("counts disabled access sections as satisfied", () => {
    const race = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        access: {
          ...defaultOrganizerRaceDetails.access,
          overrideEnabled: true,
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
      { id: "race-1", editionGroupId: "series-42k", seriesName: "42K", name: "42K", score: 100 },
      { id: "race-2", editionGroupId: "series-25k", seriesName: "25K", name: "25K", score: 100 },
    ]);
    expect(completion.raceProgressScore).toBe(100);
  });

  it("does not change completion percentages when publication toggles change", () => {
    const draftRace = { ...baseEvent.races[0]!, is_live: false };
    const draftCompletion = buildOrganizerCompletion({ ...baseEvent, is_live: false, races: [draftRace] }, draftRace, [], []);
    const liveCompletion = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], []);

    expect(draftCompletion.raceProgress).toEqual(liveCompletion.raceProgress);
    expect(draftCompletion.raceProgressScore).toBe(liveCompletion.raceProgressScore);
    expect(draftCompletion.informationComplete).toBe(true);
    expect(liveCompletion.informationComplete).toBe(true);
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
    expect(firstSelected.raceProgress[0]?.score).toBe(100);
    expect(firstSelected.raceProgress[1]?.score).toBe(100);
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

  it("excludes inactive and locked modules from tiles, missing fields and scores", () => {
    const full = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], []);
    const filtered = buildOrganizerCompletion(baseEvent, baseEvent.races[0]!, [], [], undefined, {
      event: new Set(["event"]),
      races: { "race-1": new Set(["formats"]) },
    });

    expect(filtered.eventModules.map((module) => module.id)).toEqual(["event"]);
    expect(filtered.formatModules.map((module) => module.id)).toEqual(["formats"]);
    expect(filtered.score).toBe(full.score);
  });

  it("keeps optional equipment out of progress and requires one item for an explicit format override", () => {
    const inheritedRace = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        mandatoryEquipment: { ...defaultOrganizerRaceDetails.mandatoryEquipment, overrideEnabled: false },
      },
    };
    const emptyOverrideRace = {
      ...inheritedRace,
      organizerDetails: {
        ...inheritedRace.organizerDetails,
        mandatoryEquipment: {
          ...inheritedRace.organizerDetails.mandatoryEquipment,
          overrideEnabled: true,
          items: [],
          note: "Une note seule reste optionnelle",
        },
      },
    };
    const filledOverrideRace = {
      ...emptyOverrideRace,
      organizerDetails: {
        ...emptyOverrideRace.organizerDetails,
        mandatoryEquipment: {
          ...emptyOverrideRace.organizerDetails.mandatoryEquipment,
          items: [{ id: "equipment-1", label: "Gobelet", required: true, cold: false, heat: false, note: null }],
        },
      },
    };

    const inherited = buildOrganizerCompletion({ ...baseEvent, races: [inheritedRace] }, inheritedRace, [], []);
    const emptyOverride = buildOrganizerCompletion({ ...baseEvent, races: [emptyOverrideRace] }, emptyOverrideRace, [], []);
    const filledOverride = buildOrganizerCompletion({ ...baseEvent, races: [filledOverrideRace] }, filledOverrideRace, [], []);

    expect(inherited.eventModules.find((module) => module.id === "equipment")?.level).toBe("optional");
    expect(inherited.formatModules.find((module) => module.id === "equipment")?.level).toBe("optional");
    expect(inherited.formatScore).toBe(100);
    expect(emptyOverride.formatModules.find((module) => module.id === "equipment")).toMatchObject({
      level: "required",
      status: "incomplete",
      missingLabels: ["Matériel"],
    });
    expect(emptyOverride.formatScore).toBe(50);
    expect(filledOverride.formatModules.find((module) => module.id === "equipment")?.status).toBe("complete");
    expect(filledOverride.formatScore).toBe(100);
  });

  it("does not mark bib, access or ravito tiles complete from optional or partial values", () => {
    const race = {
      ...baseEvent.races[0]!,
      organizerDetails: {
        ...defaultOrganizerRaceDetails,
        schedule: { ...defaultOrganizerRaceDetails.schedule, startTime: "07:00" },
      },
    };
    const completion = buildOrganizerCompletion({ ...baseEvent, races: [race] }, race, [], []);

    expect(completion.eventModules.find((module) => module.id === "bibPickup")?.status).toBe("empty");
    expect(completion.eventModules.find((module) => module.id === "access")?.status).toBe("empty");
    expect(completion.formatModules.find((module) => module.id === "aidStations")?.status).toBe("incomplete");
  });

  it("requires the format date in the mandatory course completion", () => {
    const undatedRace = { ...baseEvent.races[0]!, race_date: null };
    const completion = buildOrganizerCompletion({ ...baseEvent, races: [undatedRace] }, undatedRace, [], []);

    expect(completion.formatModules.find((module) => module.id === "formats")).toMatchObject({
      status: "incomplete",
      missingLabels: ["Date"],
    });
    expect(completion.formatScore).toBe(0);
    expect(isEventReadyToPublish({ ...baseEvent, races: [undatedRace] })).toBe(false);
  });
});
