export type SupporterGuideLocation = {
  label: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
};

export type SupporterGuideFormat = {
  raceId: string;
  name: string;
  date: string | null;
  distanceKm: number;
  startTime: string | null;
  finishCutoffTime: string | null;
  startWaves: Array<{ id: string; name: string; time: string }>;
  awards: Array<{ id: string; label: string; time: string; location: string | null }>;
  supporterPoints: Array<{ id: string; name: string; km: number; encouragementAllowed: boolean; assistanceAllowed: boolean; accessLabel: string | null; accessNote: string | null; latitude: number | null; longitude: number | null; mapsUrl: string | null; planUrl: string | null }>;
  aidStations: Array<{ id: string; name: string; km: number; assistanceAllowed: boolean; supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null; maxStopMinutes: number | null; amenities: string[]; cutoffTime: string | null }>;
};

export type SupporterGuideService = {
  id: string;
  type: 'restaurant' | 'accommodation' | 'recovery' | 'other';
  name: string;
  description: string | null;
  location: SupporterGuideLocation;
  websiteUrl: string | null;
  phone: string | null;
};

export type SupporterGuidePayload = {
  schemaVersion: 1;
  edition: { id: string; eventId: string; name: string; location: string | null; startDate: string | null; endDate: string | null; imageUrl: string | null };
  formats: SupporterGuideFormat[];
  onSiteServices: SupporterGuideService[];
  stayServices: SupporterGuideService[];
  lodgingPartner: null | { mode: 'affiliate' | 'partner'; name: string; logoUrl: string | null; headline: string | null; clickUrl: string | null };
  practical: {
    access: Array<{ raceId: string; raceName: string; start: SupporterGuideLocation; finish: SupporterGuideLocation; parking: string | null; shuttles: string | null; shuttleSchedule: string | null; roadRestrictions: string | null; mapUrl: string | null }>;
    thirdPartyBibPickup: Array<{ raceId: string; raceName: string; allowed: boolean; conditions: string | null }>;
    emergencyPhone: string | null;
    links: Array<{ kind: 'official' | 'instagram' | 'facebook'; url: string }>;
  };
  publicationIds: string[];
  publishedAt: string;
  organizerPreview: boolean;
};
