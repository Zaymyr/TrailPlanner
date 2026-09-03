import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackGoogleAnalyticsEvent } from "./google-analytics";
import {
  trackCrewLinkOpened,
  trackCrewStateUpdated,
  trackOrganizerCheckoutStarted,
  trackOrganizerOfferViewed,
  trackOrganizerPurchaseVerified,
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
    trackOrganizerCheckoutStarted({ currentTier: "visibility", targetTier: "pro", editionYear: "2027" });
    trackOrganizerPurchaseVerified({ targetTier: "pro", editionYear: "2027" });

    expect(track.mock.calls.map(([event]) => event)).toEqual([
      "organizer offer viewed",
      "organizer checkout started",
      "organizer purchase verified",
    ]);
    expect(track.mock.calls[1]?.[1]).toMatchObject({ billing_provider: "stripe", target_tier: "pro" });
  });
});
