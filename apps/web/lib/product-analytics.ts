import { trackGoogleAnalyticsEvent } from "./google-analytics";

type PlanSource = "web_planner" | "web_catalog";

export function trackPlanPersisted(input: {
  operation: "created" | "saved";
  source: PlanSource;
  aidStationCount: number;
  segmentCount: number;
  hasRaceLink: boolean;
  hasElevationProfile: boolean;
  /** Public catalog race id the plan is linked to (funnel attribution). */
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent(input.operation === "created" ? "plan created" : "plan saved", {
    event_category: "plan",
    source: input.source,
    source_race: input.sourceRace ?? undefined,
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
  action: "start_time_saved" | "checkpoint_confirmed" | "checkpoint_corrected" | "checkpoint_cleared" | "tracking_reset";
  confirmedPassageCount: number;
}) {
  trackGoogleAnalyticsEvent("plan crew state updated", {
    event_category: "plan_share",
    action: input.action,
    confirmed_passage_count: input.confirmedPassageCount,
  });
}

export function trackCrewAppGate(input: {
  action: "viewed" | "download" | "open_app" | "continue_web";
  platform: "android" | "ios" | "other";
}) {
  trackGoogleAnalyticsEvent("plan crew app gate", {
    event_category: "plan_share",
    action: input.action,
    platform: input.platform,
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

/*
 * Web runner funnel: race page -> estimate -> signup -> checkout -> purchase.
 * Naming follows the existing runner product events (lowercase words with spaces,
 * shared with mobile: "plan created", "quick estimate completed", "premium ...").
 * `source_race` is a public catalog race id only: no email, name, plan text or price.
 */
export type RaceFunnelPageType = "format" | "event";
export type RaceEstimatePlacement = "hero" | "sticky_bar" | "format_list" | "estimates_section" | "other";
export type RunnerCheckoutPlacement = "premium_page" | "planner_modal" | "profile";
export type SignUpMethod = "email" | "google" | "apple";

export function trackRacePageViewed(input: {
  pageType: RaceFunnelPageType;
  slug: string;
  raceId?: string | null;
  eventId?: string | null;
  hasGpx?: boolean | null;
  isUpcoming?: boolean | null;
  isDemo?: boolean | null;
}) {
  trackGoogleAnalyticsEvent("race page viewed", {
    event_category: "race_funnel",
    page_type: input.pageType,
    slug: input.slug,
    race_id: input.raceId ?? undefined,
    event_id: input.eventId ?? undefined,
    has_gpx: input.hasGpx ?? undefined,
    is_upcoming: input.isUpcoming ?? undefined,
    is_demo: input.isDemo ?? undefined,
  });
}

export function trackRaceEstimateCtaClicked(input: {
  placement: RaceEstimatePlacement;
  pageType: RaceFunnelPageType;
  raceId: string;
  slug?: string | null;
}) {
  trackGoogleAnalyticsEvent("race estimate cta clicked", {
    event_category: "race_funnel",
    placement: input.placement,
    page_type: input.pageType,
    race_id: input.raceId,
    source_race: input.raceId,
    slug: input.slug ?? undefined,
  });
}

export function trackQuickEstimateCompleted(input: {
  input: "pace_and_utmb" | "pace" | "utmb";
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent("quick estimate completed", {
    event_category: "plan",
    source: "web_catalog",
    input: input.input,
    source_race: input.sourceRace ?? undefined,
  });
}

export function trackSignUpStarted(input: { method: SignUpMethod; sourceRace?: string | null }) {
  trackGoogleAnalyticsEvent("sign up started", {
    event_category: "acquisition",
    method: input.method,
    source_race: input.sourceRace ?? undefined,
  });
}

export function trackSignUpCompleted(input: {
  method: SignUpMethod;
  emailConfirmationPending: boolean;
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent("sign up completed", {
    event_category: "acquisition",
    method: input.method,
    email_confirmation_pending: input.emailConfirmationPending,
    source_race: input.sourceRace ?? undefined,
  });
}

export function trackPremiumPaywallViewed(input: {
  placement: RunnerCheckoutPlacement;
  hasPlanContext: boolean;
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent("premium paywall viewed", {
    event_category: "premium",
    store: "web",
    placement: input.placement,
    has_plan_context: input.hasPlanContext,
    source_race: input.sourceRace ?? undefined,
  });
}

/** Annual keeps the mobile "premium checkout started"; the one-time course keeps "runner course checkout started". */
export function trackRunnerCheckoutStarted(input: {
  offer: "course" | "annual";
  placement: RunnerCheckoutPlacement;
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent(input.offer === "course" ? "runner course checkout started" : "premium checkout started", {
    event_category: "premium",
    billing_provider: "stripe",
    store: "web",
    offer: input.offer,
    purchase_type: input.offer === "course" ? "course" : "annual",
    placement: input.placement,
    source_race: input.sourceRace ?? undefined,
  });
}

/** Emitted only after the server-side entitlement (webhook result) is visible to the returning runner. */
export function trackRunnerPurchaseVerified(input: {
  offer: "course" | "annual";
  sourceRace?: string | null;
}) {
  trackGoogleAnalyticsEvent(input.offer === "course" ? "runner course purchase verified" : "premium purchase verified", {
    event_category: "premium",
    billing_provider: "stripe",
    store: "web",
    offer: input.offer,
    purchase_type: input.offer === "course" ? "course" : "annual",
    verification_source: "web_entitlement_check",
    source_race: input.sourceRace ?? undefined,
  });
}
