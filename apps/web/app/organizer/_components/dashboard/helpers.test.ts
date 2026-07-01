import { describe, expect, it } from "vitest";

import { defaultOrganizerAidStationDetails } from "../../../../lib/organizer-dashboard-details";
import { getGpxElevationTotalsAtDistance, syncAidStationsWithGpxPreview } from "./helpers";
import type { AidStationDraft, GpxPreview } from "./types";

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
