import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackGoogleAnalyticsEvent } from "./google-analytics";
import {
  getChangedFieldNames,
  getDaysUntilDate,
  trackCrewLinkOpened,
  trackCrewStateUpdated,
  trackOrganizerCheckoutStarted,
  trackOrganizerEventUpdated,
  trackOrganizerOfferViewed,
  trackOrganizerPurchaseVerified,
  trackOrganizerRaceCreated,
  trackOrganizerRaceUpdated,
  trackPlanExported,
  trackPlanPersisted,
} from "./product-analytics";

vi.mock("./google-analytics", () => ({
  trackGoogleAnalyticsEvent: vi.fn(),
}));

const track = vi.mocked(trackGoogleAnalyticsEvent);

describe("product analytics events", () => {
  beforeEach(() => track.mockClear());

  it("keeps web plan persistence aligned with the mobile event names", () => {
    trackPlanPersisted({
      operation: "created",
      source: "web_catalog",
      aidStationCount: 4,
      segmentCount: 3,
      hasRaceLink: true,
      hasElevationProfile: true,
    });

    expect(track).toHaveBeenCalledWith("plan created", {
      event_category: "plan",
      source: "web_catalog",
      aid_station_count: 4,
      segment_count: 3,
      has_race_link: true,
      has_elevation_profile: true,
    });
  });

  it("describes exports without plan names or identifiers", () => {
    trackPlanExported({ format: "assistance_print", planState: "saved", aidStationCount: 5 });
    expect(track).toHaveBeenCalledWith("plan exported", {
      event_category: "plan",
      format: "assistance_print",
      plan_state: "saved",
      aid_station_count: 5,
    });
  });

  it("captures aggregate-only crew link engagement", () => {
    trackCrewLinkOpened({
      checkpointCount: 7,
      trackableCheckpointCount: 4,
      confirmedPassageCount: 1,
      hasDepartureTime: true,
    });
    trackCrewStateUpdated({ action: "checkpoint_confirmed", confirmedPassageCount: 2 });

    expect(track).toHaveBeenNthCalledWith(1, "plan crew link opened", {
      event_category: "plan_share",
      checkpoint_count: 7,
      trackable_checkpoint_count: 4,
      confirmed_passage_count: 1,
      has_departure_time: true,
    });
    expect(track).toHaveBeenNthCalledWith(2, "plan crew state updated", {
      event_category: "plan_share",
      action: "checkpoint_confirmed",
      confirmed_passage_count: 2,
    });
  });

  it("uses separate organizer offer, checkout, and verified-purchase steps", () => {
    trackOrganizerOfferViewed({ currentTier: "visibility", editionYear: "2027" });
    trackOrganizerCheckoutStarted({ currentTier: "visibility", targetTier: "signature", editionYear: "2027" });
    trackOrganizerPurchaseVerified({ targetTier: "signature", editionYear: "2027" });

    expect(track.mock.calls.map(([event]) => event)).toEqual([
      "organizer offer viewed",
      "organizer checkout started",
      "organizer purchase verified",
    ]);
    expect(track.mock.calls[1]?.[1]).toMatchObject({ billing_provider: "stripe", target_tier: "signature" });
  });

  it("reports organizer edits without sending field values", () => {
    const changedFields = getChangedFieldNames(
      { name: "Ancien nom", location: "Annecy", schedule: { start: "06:00" } },
      { name: "Nouveau nom", location: "Annecy", schedule: { start: "07:00" } }
    );

    trackOrganizerRaceUpdated({
      eventId: "event-1",
      raceId: "race-1",
      editionYear: "2027",
      daysUntilRace: 42,
      changedFields,
      saveMode: "background",
    });

    expect(track).toHaveBeenCalledWith("organizer race updated", {
      event_category: "organizer_content",
      event_id: "event-1",
      race_id: "race-1",
      edition_year: "2027",
      days_until_race: 42,
      changed_fields: "name,schedule",
      changed_field_count: 2,
      save_mode: "background",
    });
    expect(JSON.stringify(track.mock.calls[0]?.[1])).not.toContain("Nouveau nom");
  });

  it("measures calendar days until a race and tracks organizer creation", () => {
    expect(getDaysUntilDate("2027-01-11", new Date("2027-01-01T23:30:00Z"))).toBe(10);
    expect(getDaysUntilDate("invalid", new Date("2027-01-01T00:00:00Z"))).toBeNull();

    trackOrganizerRaceCreated({
      eventId: "event-1",
      raceId: "race-1",
      editionYear: "2027",
      daysUntilRace: 10,
      distanceKm: 42,
      hasGpx: true,
    });
    expect(track).toHaveBeenCalledWith("organizer race created", expect.objectContaining({
      days_until_race: 10,
      distance_km: 42,
      has_gpx: true,
    }));
  });

  it("does not emit empty organizer update events", () => {
    trackOrganizerEventUpdated({
      eventId: "event-1",
      editionYear: "2027",
      daysUntilRace: 10,
      changedFields: [],
      saveMode: "manual",
    });
    expect(track).not.toHaveBeenCalled();
  });
});
