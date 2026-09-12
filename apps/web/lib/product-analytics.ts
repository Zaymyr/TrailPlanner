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

type OrganizerTier = "visibility" | "essential" | "complete" | "signature";

type OrganizerSaveMode = "manual" | "background";

export function getChangedFieldNames(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  return Object.keys(after).filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

export function getDaysUntilDate(dateValue: string | null | undefined, now = new Date()): number | null {
  if (!dateValue) return null;
  const target = new Date(`${dateValue.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}

function organizerEditProperties(input: {
  eventId: string;
  raceId?: string;
  editionYear: string;
  daysUntilRace: number | null;
  changedFields: string[];
  saveMode: OrganizerSaveMode;
}) {
  const changedFields = [...new Set(input.changedFields)].sort();
  return {
    event_category: "organizer_content",
    event_id: input.eventId,
    race_id: input.raceId,
    edition_year: input.editionYear,
    days_until_race: input.daysUntilRace,
    changed_fields: changedFields.join(","),
    changed_field_count: changedFields.length,
    save_mode: input.saveMode,
  };
}

export function trackOrganizerEventUpdated(input: {
  eventId: string;
  editionYear: string;
  daysUntilRace: number | null;
  changedFields: string[];
  saveMode: OrganizerSaveMode;
}) {
  if (input.changedFields.length === 0) return;
  trackGoogleAnalyticsEvent("organizer event updated", organizerEditProperties(input));
}

export function trackOrganizerRaceCreated(input: {
  eventId: string;
  raceId: string;
  editionYear: string;
  daysUntilRace: number | null;
  distanceKm: number;
  hasGpx: boolean;
}) {
  trackGoogleAnalyticsEvent("organizer race created", {
    event_category: "organizer_content",
    event_id: input.eventId,
    race_id: input.raceId,
    edition_year: input.editionYear,
    days_until_race: input.daysUntilRace,
    distance_km: input.distanceKm,
    has_gpx: input.hasGpx,
  });
}

export function trackOrganizerRaceUpdated(input: {
  eventId: string;
  raceId: string;
  editionYear: string;
  daysUntilRace: number | null;
  changedFields: string[];
  saveMode: OrganizerSaveMode;
}) {
  if (input.changedFields.length === 0) return;
  trackGoogleAnalyticsEvent("organizer race updated", organizerEditProperties(input));
}

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
