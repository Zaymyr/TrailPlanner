import { describe, expect, it } from "vitest";

import { defaultOrganizerAidStationDetails, defaultOrganizerEventDetails } from "../../../../lib/organizer-dashboard-details";
import { EVENT_TAB_ID } from "./constants";
import {
  applyGpxStatsToRaceForm,
  buildEditionYearOptions,
  buildOrganizerFormatSavePlan,
  createEmptyRaceForm,
  createRaceFormFromEventDefaults,
  getGpxElevationTotalsAtDistance,
  getOrganizerDirtyScopeKey,
  getRaceEditionYear,
  isOrganizerScopeSavePending,
  syncAidStationsWithGpxPreview,
} from "./helpers";
import type { AidStationDraft, EditionRequestRow, GpxPreview } from "./types";

const preview: GpxPreview = {
  stats: {
    distanceKm: 30,
    gainM: 1000,
    lossM: 700,
    minAltM: 500,
    maxAltM: 1800,
  },
  elevationProfile: [
    { distanceKm: 0, elevationM: 500, cumulativeGainM: 0, cumulativeLossM: 0 },
    { distanceKm: 10, elevationM: 900, cumulativeGainM: 400, cumulativeLossM: 50 },
    { distanceKm: 20, elevationM: 800, cumulativeGainM: 700, cumulativeLossM: 300 },
    { distanceKm: 30, elevationM: 1100, cumulativeGainM: 1000, cumulativeLossM: 700 },
  ],
  detectedAidStations: [],
};

const buildStation = (distanceKm: number): AidStationDraft => ({
  name: `Ravito ${distanceKm}`,
  distanceKm,
  waterRefill: true,
  solidRefill: true,
  assistanceAllowed: true,
  notes: null,
  organizerDetails: { ...defaultOrganizerAidStationDetails },
});

describe("organizer dashboard GPX helpers", () => {
  it("persists race schedule details together with aid-station edits", () => {
    expect(buildOrganizerFormatSavePlan(new Set(["aidStations"]))).toEqual({
      saveRaceDetails: true,
      saveAidStations: true,
    });
  });

  it("keeps dirty and pending autosave state scoped to the selected event or race", () => {
    expect(getOrganizerDirtyScopeKey("event-1", EVENT_TAB_ID, null)).toBe("event:event-1");
    expect(getOrganizerDirtyScopeKey("event-1", "series-42k", "race-1")).toBe("race:race-1");
    expect(isOrganizerScopeSavePending(1, 3, 3)).toBe(true);
    expect(isOrganizerScopeSavePending(1, 4, 3)).toBe(false);
  });

  it("copies the exact parsed GPX metrics into the race form", () => {
    expect(
      applyGpxStatsToRaceForm(createEmptyRaceForm(), {
        distanceKm: 42.37,
        gainM: 1234.6,
        lossM: 1198.4,
        minAltM: 320,
        maxAltM: 1640,
      })
    ).toMatchObject({
      distanceKm: 42.37,
      elevationGainM: 1234.6,
      elevationLossM: "1198.4",
    });
  });

  it("keeps a new format location inherited from the event by default", () => {
    const raceForm = createRaceFormFromEventDefaults({
      name: "Trail test",
      location: "Annecy",
      editionStartDate: "2027-06-12",
      editionEndDate: "2027-06-13",
      thumbnailUrl: "",
      isLive: false,
      organizerDetails: {
        ...defaultOrganizerEventDetails,
        eventLocation: {
          label: "Annecy",
          lat: 45.8992,
          lng: 6.1294,
          googleMapsUrl: "https://maps.google.com/?q=Annecy",
          source: "autocomplete",
        },
      },
    });

    expect(raceForm.locationText).toBe("");
    expect(raceForm.organizerDetails.raceLocation).toEqual({
      label: null,
      lat: null,
      lng: null,
      googleMapsUrl: null,
      source: null,
    });
  });

  it("keeps pending future edition years visible but disabled in the selector", () => {
    const options = buildEditionYearOptions(
      [{ id: "r1", edition_group_id: "g1", series_name: "42K", name: "42K", distance_km: 42, elevation_gain_m: 1000, is_live: false, race_date: "2026-06-20" }],
      [],
      [
        {
          id: "req1",
          event_id: "event-1",
          source_year: 2026,
          requested_start_date: "2027-06-19",
          status: "pending",
        } as EditionRequestRow,
      ],
      "event-1"
    );

    expect(options).toEqual([
      { value: "2027", label: "2027 (en attente de validation)", disabled: true },
      { value: "2026", label: "2026", disabled: false },
    ]);
  });

  it("uses canonical edition membership when a multi-day format crosses into the next year", () => {
    expect(
      getRaceEditionYear(
        { id: "r1", edition_id: "edition-2026", edition_group_id: "g1", series_name: "Ultra", name: "Ultra", distance_km: 100, elevation_gain_m: 4000, is_live: false, race_date: "2027-01-01" },
        [{ id: "edition-2026", event_id: "event-1", edition_year: 2026, start_date: "2026-12-31", end_date: "2027-01-01", is_current: true }]
      )
    ).toBe("2026");
  });

  it("interpolates cumulative elevation totals from the GPX profile", () => {
    expect(getGpxElevationTotalsAtDistance(preview, 15)).toEqual({
      cumulativeElevationGainM: 550,
      cumulativeElevationLossM: 175,
    });
  });

  it("clamps cumulative elevation totals before start and after finish", () => {
    expect(getGpxElevationTotalsAtDistance(preview, -2)).toEqual({
      cumulativeElevationGainM: 0,
      cumulativeElevationLossM: 0,
    });

    expect(getGpxElevationTotalsAtDistance(preview, 45)).toEqual({
      cumulativeElevationGainM: 1000,
      cumulativeElevationLossM: 700,
    });
  });

  it("syncs every aid station with GPX-derived cumulative values", () => {
    const syncedStations = syncAidStationsWithGpxPreview([buildStation(5), buildStation(22)], preview);

    expect(syncedStations.map((station) => station.organizerDetails)).toMatchObject([
      { cumulativeElevationGainM: 200, cumulativeElevationLossM: 25 },
      { cumulativeElevationGainM: 760, cumulativeElevationLossM: 380 },
    ]);
  });
});
