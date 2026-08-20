import type { FuelType } from '../../../../lib/fuel-types';
import type {
  OrganizerAidStationDetails,
  OrganizerEventDetails,
  OrganizerRaceDetails,
} from '../../../../lib/organizer-dashboard-details';
import type { FuelProduct } from '../../../../lib/product-types';

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
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  created_at: string;
};

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
  racebook_is_live?: boolean;
  racebook_publication_approved_at?: string | null;
  organizerDetails?: OrganizerRaceDetails;
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

export type WebsiteImportRaceMode = "create" | "update" | "ignore";

export type WebsiteImportRaceSelection = {
  mode: WebsiteImportRaceMode;
  targetRaceId: string | null;
};

export type WebsiteImportConfidence = "high" | "medium" | "low";

export type WebsiteImportFinding = {
  key: string;
  label: string;
  value: string | null;
  required: boolean;
  confidence: WebsiteImportConfidence | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
};

export type WebsiteImportAssessment = {
  score: number;
  coverageScore: number;
  reliabilityScore: number;
  foundCount: number;
  totalCount: number;
  reliableCount: number;
  findings: WebsiteImportFinding[];
};

export type WebsiteImportPreviewRace = {
  key: string;
  name: string;
  seriesName: string;
  raceDate: string | null;
  locationText: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  externalSiteUrl: string | null;
  thumbnailUrl: string | null;
  missingFields: string[];
  warnings: string[];
  suggestedTargetRaceId: string | null;
  canCreate: boolean;
  hasReliableGpx: boolean;
  detectedAidStationCount: number;
  assessment: WebsiteImportAssessment | null;
};

export type WebsiteImportPreview = {
  source: {
    provider: "utmb" | "tracedetrail" | "generic";
    url: string;
    label: string;
  };
  previewHash: string;
  event: {
    name: string | null;
    location: string | null;
    raceDate: string | null;
    officialWebsiteUrl: string | null;
    thumbnailUrl: string | null;
    logistics: {
      mandatoryEquipment: string[];
      shuttles: string | null;
      startAddress: string | null;
      officialParkings: string | null;
    };
  };
  races: WebsiteImportPreviewRace[];
  missingFields: string[];
  warnings: string[];
  canApply: boolean;
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
