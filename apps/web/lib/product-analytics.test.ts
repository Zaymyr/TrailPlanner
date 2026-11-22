import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackGoogleAnalyticsEvent } from "./google-analytics";
import {
  getChangedFieldNames,
  getDaysUntilDate,
  trackCrewLinkOpened,
  trackCrewStateUpdated,
  trackOrganizerCheckoutStarted,
  trackPremiumPaywallViewed,
  trackQuickEstimateCompleted,
  trackRaceEstimateCtaClicked,
  trackRacePageViewed,
  trackRunnerCheckoutStarted,
  trackRunnerPurchaseVerified,
  trackSignUpCompleted,
  trackSignUpStarted,
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

  it("adds the source race to plan creation without changing the existing properties", () => {
    trackPlanPersisted({
      operation: "created",
      source: "web_catalog",
      aidStationCount: 1,
      segmentCount: 1,
      hasRaceLink: true,
      hasElevationProfile: false,
      sourceRace: "race-1",
    });
    expect(track).toHaveBeenCalledWith("plan created", expect.objectContaining({ source: "web_catalog", source_race: "race-1" }));
  });

  describe("web runner funnel", () => {
    it("describes a format page view with the required properties", () => {
      trackRacePageViewed({
        pageType: "format",
        slug: "utmb-100",
        raceId: "race-1",
        eventId: "event-1",
        hasGpx: true,
        isUpcoming: false,
        isDemo: false,
      });
      expect(track).toHaveBeenCalledWith("race page viewed", {
        event_category: "race_funnel",
        page_type: "format",
        slug: "utmb-100",
        race_id: "race-1",
        event_id: "event-1",
        has_gpx: true,
        is_upcoming: false,
        is_demo: false,
      });
    });

    it("keeps unknown event page properties undefined instead of guessing", () => {
      trackRacePageViewed({ pageType: "event", slug: "utmb-2027" });
      expect(track).toHaveBeenCalledWith("race page viewed", expect.objectContaining({
        page_type: "event",
        race_id: undefined,
        has_gpx: undefined,
        is_upcoming: undefined,
      }));
    });

    it("attributes estimate CTA clicks to a placement and race", () => {
      trackRaceEstimateCtaClicked({ placement: "sticky_bar", pageType: "format", raceId: "race-1", slug: "utmb-100" });
      expect(track).toHaveBeenCalledWith("race estimate cta clicked", {
        event_category: "race_funnel",
        placement: "sticky_bar",
        page_type: "format",
        race_id: "race-1",
        source_race: "race-1",
        slug: "utmb-100",
      });
    });

    it("keeps the quick estimate event name and adds the source race", () => {
      trackQuickEstimateCompleted({ input: "pace", sourceRace: "race-1" });
      expect(track).toHaveBeenCalledWith("quick estimate completed", {
        event_category: "plan",
        source: "web_catalog",
        input: "pace",
        source_race: "race-1",
      });
    });

    it("tracks sign up start and completion without identity data", () => {
      trackSignUpStarted({ method: "email", sourceRace: "race-1" });
      trackSignUpCompleted({ method: "email", emailConfirmationPending: true, sourceRace: "race-1" });
      expect(track).toHaveBeenNthCalledWith(1, "sign up started", { event_category: "acquisition", method: "email", source_race: "race-1" });
      expect(track).toHaveBeenNthCalledWith(2, "sign up completed", {
        event_category: "acquisition",
        method: "email",
        email_confirmation_pending: true,
        source_race: "race-1",
      });
    });

    it("reuses the mobile premium event names with an offer property", () => {
      trackPremiumPaywallViewed({ placement: "premium_page", hasPlanContext: true });
      trackRunnerCheckoutStarted({ offer: "annual", placement: "planner_modal", sourceRace: "race-1" });
      trackRunnerCheckoutStarted({ offer: "course", placement: "premium_page" });
      trackRunnerPurchaseVerified({ offer: "annual", sourceRace: "race-1" });
      trackRunnerPurchaseVerified({ offer: "course" });

      expect(track.mock.calls.map(([name]) => name)).toEqual([
        "premium paywall viewed",
        "premium checkout started",
        "runner course checkout started",
        "premium purchase verified",
        "runner course purchase verified",
      ]);
      expect(track).toHaveBeenCalledWith("premium checkout started", expect.objectContaining({
        billing_provider: "stripe",
        store: "web",
        offer: "annual",
        placement: "planner_modal",
        source_race: "race-1",
      }));
      expect(track).toHaveBeenCalledWith("runner course purchase verified", expect.objectContaining({ offer: "course", purchase_type: "course" }));
    });

    it("never sends identity or price fields", () => {
      trackRunnerCheckoutStarted({ offer: "course", placement: "premium_page", sourceRace: "race-1" });
      trackSignUpCompleted({ method: "google", emailConfirmationPending: false });
      for (const [, props] of track.mock.calls) {
        expect(Object.keys(props ?? {}).join(",")).not.toMatch(/email(?!_confirmation)|name|price|amount/i);
      }
    });
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
