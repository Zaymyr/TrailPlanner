/**
 * Platform-neutral presentation contract used by both the Expo RaceBook and
 * the organizer's local preview.  Keep this file free from React and app
 * imports so that a draft can be rendered without a network request.
 */
export type RacebookLocale = "fr" | "en";
export type RacebookPreviewMode = "content" | "sponsor-loading";
export type RacebookPrimaryTab = "gear" | "bib" | "course" | "access" | "services";
export type RacebookCourseTab = "route" | "start-waves" | "aid-stations" | "relay" | "awards";
export type RacebookParticipationMode = "solo" | "relay" | "solo_and_relay" | null;

export type RacebookLocation = {
  label: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
};

export type RacebookEquipmentItem = {
  id: string;
  label: string;
  required: boolean;
  cold: boolean;
  heat: boolean;
  note: string | null;
  active: boolean;
};

export type RacebookEquipment = {
  weatherPlan: "normal" | "cold" | "heat";
  items: RacebookEquipmentItem[];
  note: string | null;
};

export type RacebookBibPickup = {
  locations: Array<{
    location: string | null;
    locationDetails: RacebookLocation;
    slots: Array<{ date: string | null; startTime: string | null; endTime: string | null }>;
  }>;
  /** Legacy free-text pickup schedule, retained alongside structured slots. */
  schedule?: string | null;
  requiredDocuments: string | null;
  thirdPartyPickupAllowed: boolean | null;
  equipmentCheck: boolean | null;
  note: string | null;
};

export type RacebookAccess = {
  startAddress: string | null;
  startLocation: RacebookLocation;
  finishAddress: string | null;
  finishLocation: RacebookLocation;
  officialParkings: string | null;
  shuttles: string | null;
  shuttleSchedule: string | null;
  roadRestrictions: string | null;
  mapUrl: string | null;
  note: string | null;
  enabledSections: {
    officialParkings: boolean;
    shuttles: boolean;
    roadRestrictions: boolean;
    mapUrl: boolean;
    runnerInfo: boolean;
  };
};

export type RacebookAidStation = {
  id: string;
  name: string;
  km: number;
  waterAvailable: boolean;
  solidAvailable: boolean;
  assistanceAllowed: boolean;
  notes: string | null;
  orderIndex: number;
  organizerDetails: {
    cumulativeElevationGainM: number | null;
    cumulativeElevationLossM: number | null;
    altitudeM: number | null;
    cutoffTime: string | null;
    dropBagAvailable: boolean;
    organizerNote: string | null;
  };
  products: Array<{ id: string; label: string; notes: string | null; orderIndex: number }>;
};

export type RacebookStartWave = {
  id: string;
  name: string;
  startTime: string;
  eligibilityType: "all" | "bib_range" | "estimated_finish_time" | "pace" | "custom";
  bibNumberMin: number | null;
  bibNumberMax: number | null;
  finishMinutesMin: number | null;
  finishMinutesMax: number | null;
  paceSecondsMin: number | null;
  paceSecondsMax: number | null;
  eligibilityNote: string | null;
  orderIndex: number;
};

export type RacebookAward = {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  audience: "women" | "men" | "mixed";
  placeFrom: number;
  placeTo: number;
  podiumTime: string;
  podiumLocation: string | null;
  rewardNote: string | null;
  orderIndex: number;
};

export type RacebookRelayPoint = {
  id: string;
  raceAidStationId: string | null;
  name: string;
  km: number;
  handoverTime: string | null;
  cutoffTime: string | null;
  notes: string | null;
  orderIndex: number;
};

export type RacebookEditionService = {
  id: string;
  serviceType: "restaurant" | "accommodation" | "recovery" | "other";
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  orderIndex: number;
};

export type RacebookPresentationData = {
  race: {
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number | null;
    raceDate: string | null;
    thumbnailUrl: string | null;
    location: string | null;
    startLatitude?: number | null;
    startLongitude?: number | null;
    participationMode: RacebookParticipationMode;
    locationDetails: RacebookLocation;
    schedule: { startTime: string | null; finishCutoffTime: string | null; cutoffNote: string | null; note: string | null };
    runnerInfo: { startArea: string | null; briefing: string | null; rules: string | null; note: string | null };
  };
  event: {
    id: string | null;
    name: string | null;
    location: string | null;
    raceDate: string | null;
    endDate?: string | null;
    thumbnailUrl: string | null;
    locationDetails?: RacebookLocation;
    officialWebsiteUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    emergencyContact: { name: string | null; phone: string | null };
  };
  equipment: RacebookEquipment;
  bibPickup: RacebookBibPickup;
  access: RacebookAccess;
  legacyServices: Record<"supporters" | "accommodations" | "restaurants" | "recovery" | "partners" | "lastMinuteMessage" | "note", string | null>;
  aidStations: RacebookAidStation[];
  relayPoints: RacebookRelayPoint[];
  startWaves: RacebookStartWave[];
  awards: RacebookAward[];
  editionServices: RacebookEditionService[];
};

export type RacebookModuleVisibility = {
  equipment: boolean;
  bibPickup: boolean;
  access: boolean;
  services: boolean;
  branding: boolean;
  sponsors: boolean;
  aidStations: boolean;
  startWaves: boolean;
  awards: boolean;
  relay: boolean;
  officialProducts: boolean;
};

export type RacebookModuleStatus = Record<keyof RacebookModuleVisibility, "active" | "inactive" | "draftOnly">;

export type RacebookSponsor = {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string | null;
  showOnLoading: boolean;
  showInBanner: boolean;
  position: number;
};

export type RacebookSponsorPresentation = {
  loading: RacebookSponsor[];
  banner: RacebookSponsor[];
};

export type RacebookRoutePresentation = {
  elevationProfile: Array<{ distanceKm: number; elevationM: number; lat?: number; lon?: number }>;
  /** Lightweight route geometry used by platform adapters; it never implies an interactive map. */
  previewPoints: Array<{ latitude: number; longitude: number }>;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
};

export type RacebookBranding = {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  onPrimaryColor: "#FFFFFF" | "#1A1A1A";
  primarySurfaceColor: string;
  primaryBorderColor: string;
  accentSurfaceColor: string;
  accentBorderColor: string;
};

export type RacebookViewModel = {
  data: RacebookPresentationData;
  branding: RacebookBranding;
  modules: RacebookModuleVisibility;
  moduleStatus: RacebookModuleStatus;
  sponsors: RacebookSponsorPresentation;
  route: RacebookRoutePresentation;
};
