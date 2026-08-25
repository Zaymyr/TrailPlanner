import type { FuelType } from '../../../../lib/fuel-types';
import type {
  OrganizerAidStationDetails,
  OrganizerEventDetails,
  OrganizerRaceDetails,
} from '../../../../lib/organizer-dashboard-details';
import type { FuelProduct } from '../../../../lib/product-types';
import type {
  FormatCandidate,
  OrganizerImportClaimValue,
} from '../../../../lib/organizer-import-engine';

export type MembershipRow = {
  id: string;
  event_id: string;
  role: string;
  race_events?: {
    id: string;
    name: string;
    location?: string | null;
    race_date?: string | null;
    thumbnail_url?: string | null;
    is_live?: boolean | null;
  } | null;
};

export type ClaimRow = {
  id: string;
  event_id: string;
  organization_name: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    id: string;
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

export type EditionRequestRow = {
  id: string;
  event_id: string;
  source_year: number;
  requested_start_date: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    id: string;
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

export type PublicationRequestRow = {
  id: string;
  event_id: string;
  race_id?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  created_at: string;
};

export type RaceParticipationMode = "solo" | "relay" | "solo_and_relay";

export type RaceFormat = {
  id: string;
  edition_id?: string | null;
  edition_group_id: string;
  series_name: string;
  name: string;
  slug?: string | null;
  external_site_url?: string | null;
  location_text?: string | null;
  race_date?: string | null;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  gpx_storage_path?: string | null;
  thumbnail_url?: string | null;
  is_live: boolean;
  data_status?: "draft" | "complete";
  missing_required_fields?: Array<"race_date" | "distance_km" | "elevation_gain_m">;
  racebook_is_live?: boolean;
  racebook_publication_approved_at?: string | null;
  organizerDetails?: OrganizerRaceDetails;
  participation_mode?: RaceParticipationMode | null;
  aidStationCount?: number;
};

export type ElevationPoint = {
  distanceKm: number;
  elevationM: number;
  lat?: number;
  lon?: number;
  cumulativeGainM?: number;
  cumulativeLossM?: number;
};

export type RaceEventEdition = {
  id: string;
  event_id: string;
  edition_year: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_visible?: boolean;
};

export type GpxDetectedAidStation = {
  name: string;
  distanceKm: number;
};

export type GpxPreview = {
  stats?: {
    distanceKm: number;
    gainM: number;
    lossM: number;
    minAltM: number | null;
    maxAltM: number | null;
  };
  elevationProfile: ElevationPoint[];
  detectedAidStations: GpxDetectedAidStation[];
};

export type OrganizerEventDetail = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  thumbnail_url?: string | null;
  is_live?: boolean | null;
  organizerDetails?: OrganizerEventDetails;
  editions?: RaceEventEdition[];
  races: RaceFormat[];
};

export type AidStationDraft = {
  id?: string;
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  solidRefill: boolean;
  assistanceAllowed: boolean;
  notes?: string | null;
  organizerDetails: OrganizerAidStationDetails;
};

export type RelayPointDraft = {
  id?: string;
  raceAidStationId?: string | null;
  name: string;
  distanceKm: number;
  handoverTime: string;
  cutoffTime: string;
  notes: string;
};

export type StationProduct = {
  id: string;
  aidStationId: string;
  productId: string;
  notes?: string | null;
  orderIndex: number;
  product?: FuelProduct | null;
};

export type RaceFormValues = {
  seriesName: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: string;
  externalSiteUrl?: string;
  locationText: string;
  raceDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  participationMode: RaceParticipationMode | "";
  organizerDetails: OrganizerRaceDetails;
};

export type EventFormValues = {
  name: string;
  location: string;
  editionStartDate: string;
  editionEndDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  organizerDetails: OrganizerEventDetails;
};

export type WebsiteImportConfidence = "high" | "medium" | "low";

export type WebsiteImportValue = OrganizerImportClaimValue;

export type WebsiteImportFormatCandidate = FormatCandidate;

export type WebsiteImportSourceAudit = {
  sourceUrl: string | null;
  title: string | null;
  role: string;
  roleLabel: string;
  confidence: WebsiteImportConfidence;
  evidence: string[];
  assertionCount: number;
};

export type WebsiteImportDiscoveryWorkflow = {
  sessionId: string;
  step: "formats";
  expiresAt: string;
  candidates: WebsiteImportFormatCandidate[];
  discoverySnapshot: unknown;
  discoverySignature: string;
  sourceAudit?: WebsiteImportSourceAudit[];
  warnings?: string[];
};

export type WebsiteImportFormatDecision = {
  groupId: string;
  candidateKeys: string[];
  mode: "create" | "bind-existing" | "ignore";
  targetRaceId: string | null;
  name: string;
  manual?: boolean;
};

export type WebsiteImportConfirmedFormat = {
  formatKey: string;
  candidateKeys: string[];
  raceId: string;
  name: string;
  mode: "create" | "bind-existing";
  dataStatus: "draft" | "complete";
  missingRequiredFields: string[];
};

export type WebsiteImportFieldsWorkflow = {
  sessionId: string;
  step: "fields";
  confirmedFormats: WebsiteImportConfirmedFormat[];
};

export type WebsiteImportClaim = {
  id: string;
  value: WebsiteImportValue;
  source: {
    kind: string;
    label: string;
    url: string | null;
    fileName: string | null;
    page: number | null;
    editionYear: string | null;
  };
  evidence: string[];
  confidence: WebsiteImportConfidence;
};

export type WebsiteImportFieldResolution = {
  field: string;
  label: string;
  currentValue: WebsiteImportValue;
  claims: WebsiteImportClaim[];
  recommendedClaimId: string | null;
  status: "safe" | "review" | "conflict" | "missing";
  reason: string;
};

export type WebsiteImportFieldReport = {
  scope: "event" | "format";
  raceId?: string | null;
  name: string;
  resolutions: WebsiteImportFieldResolution[];
};

export type WebsiteImportReviewWorkflow = {
  sessionId: string;
  step: "review";
  confirmedFormats: WebsiteImportConfirmedFormat[];
  eventReport: WebsiteImportFieldReport;
  formatReports: WebsiteImportFieldReport[];
  fieldSnapshot: unknown;
  fieldSignature: string;
  warnings?: string[];
};

export type WebsiteImportWorkflow =
  | WebsiteImportDiscoveryWorkflow
  | WebsiteImportFieldsWorkflow
  | WebsiteImportReviewWorkflow;

export type WebsiteImportFieldSelection = {
  scope: "event" | "format";
  raceId?: string;
  field: string;
  decision: "claim" | "keep" | "missing";
  claimId?: string;
};

export type ProductFormValues = {
  name: string;
  brand: string;
  sku: string;
  fuelType: FuelType;
  productUrl: string;
  caloriesKcal: number;
  carbsGrams: number;
  sodiumMg: number;
  proteinGrams: number;
  fatGrams: number;
  notes: string;
};
