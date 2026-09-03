import { trackGoogleAnalyticsEvent } from "./google-analytics";

type PlanSource = "web_planner" | "web_catalog";

export function trackPlanPersisted(input: {
  operation: "created" | "saved";
  source: PlanSource;
  aidStationCount: number;
  segmentCount: number;
  hasRaceLink: boolean;
  hasElevationProfile: boolean;
}) {
  trackGoogleAnalyticsEvent(input.operation === "created" ? "plan created" : "plan saved", {
    event_category: "plan",
    source: input.source,
    aid_station_count: input.aidStationCount,
    segment_count: input.segmentCount,
    has_race_link: input.hasRaceLink,
    has_elevation_profile: input.hasElevationProfile,
  });
}

export function trackPlanExported(input: {
  format: "gpx" | "assistance_print";
  planState: "saved" | "draft";
  aidStationCount: number;
}) {
  trackGoogleAnalyticsEvent("plan exported", {
    event_category: "plan",
    format: input.format,
    plan_state: input.planState,
    aid_station_count: input.aidStationCount,
  });
}

export function trackCrewLinkOpened(input: {
  checkpointCount: number;
  trackableCheckpointCount: number;
  confirmedPassageCount: number;
  hasDepartureTime: boolean;
}) {
  trackGoogleAnalyticsEvent("plan crew link opened", {
    event_category: "plan_share",
    checkpoint_count: input.checkpointCount,
    trackable_checkpoint_count: input.trackableCheckpointCount,
    confirmed_passage_count: input.confirmedPassageCount,
    has_departure_time: input.hasDepartureTime,
  });
}

export function trackCrewStateUpdated(input: {
  action: "start_time_saved" | "checkpoint_confirmed" | "tracking_reset";
  confirmedPassageCount: number;
}) {
  trackGoogleAnalyticsEvent("plan crew state updated", {
    event_category: "plan_share",
    action: input.action,
    confirmed_passage_count: input.confirmedPassageCount,
  });
}

type OrganizerTier = "visibility" | "racebook" | "pro";

export function trackOrganizerOfferViewed(input: {
  currentTier: OrganizerTier;
  editionYear: string;
}) {
  trackGoogleAnalyticsEvent("organizer offer viewed", {
    event_category: "organizer_commercial",
    current_tier: input.currentTier,
    edition_year: input.editionYear,
  });
}

export function trackOrganizerCheckoutStarted(input: {
  currentTier: OrganizerTier;
  targetTier: Exclude<OrganizerTier, "visibility">;
  editionYear: string;
}) {
  trackGoogleAnalyticsEvent("organizer checkout started", {
    event_category: "organizer_commercial",
    billing_provider: "stripe",
    current_tier: input.currentTier,
    target_tier: input.targetTier,
    edition_year: input.editionYear,
  });
}

export function trackOrganizerPurchaseVerified(input: {
  targetTier: Exclude<OrganizerTier, "visibility">;
  editionYear: string;
}) {
  trackGoogleAnalyticsEvent("organizer purchase verified", {
    event_category: "organizer_commercial",
    billing_provider: "stripe",
    target_tier: input.targetTier,
    edition_year: input.editionYear,
  });
}
