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

export type RaceFormat = {
  id: string;
  name: string;
  slug?: string | null;
  location_text?: string | null;
  race_date?: string | null;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  gpx_storage_path?: string | null;
  thumbnail_url?: string | null;
  is_live: boolean;
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
  name: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: string;
  locationText: string;
  raceDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  organizerDetails: OrganizerRaceDetails;
};

export type EventFormValues = {
  name: string;
  location: string;
  raceDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  organizerDetails: OrganizerEventDetails;
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
