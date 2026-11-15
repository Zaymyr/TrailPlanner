import type { RaceDayClock } from "./racebook-cutoffs";

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
  /** Finish cutoff resolved from the official departure (multi-day aware). */
  finishCutoff?: RaceDayClock | null;
  elevationGainM?: number | null;
  startWaves: Array<{ id: string; name: string; time: string }>;
  awards: Array<{ id: string; label: string; time: string; location: string | null }>;
  supporterPoints: Array<{ id: string; name: string; km: number; encouragementAllowed: boolean; assistanceAllowed: boolean; accessLabel: string | null; accessNote: string | null; latitude: number | null; longitude: number | null; mapsUrl: string | null; planUrl: string | null }>;
  aidStations: Array<{ id: string; name: string; km: number; assistanceAllowed: boolean; supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null; maxStopMinutes: number | null; amenities: string[]; cutoffTime: string | null; cutoff?: RaceDayClock | null; waterAvailable?: boolean; solidAvailable?: boolean; isFinish?: boolean }>;
};

/** One dated entry of the edition programme, already sorted by the server. */
export type SupporterGuideTimelineEntry = {
  id: string;
  raceId: string;
  raceName: string;
  kind: "start" | "finish_cutoff" | "awards";
  date: string | null;
  time: string;
  /** Start wave name or award category; null for a single common start. */
  label: string | null;
  location: string | null;
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
  /** Starts, finish cutoffs and podiums of every format, grouped-ready (date, then time). */
  timeline?: SupporterGuideTimelineEntry[];
  onSiteServices: SupporterGuideService[];
  stayServices: SupporterGuideService[];
  lodgingPartner: null | { mode: 'affiliate' | 'partner'; name: string; logoUrl: string | null; headline: string | null; clickUrl: string | null };
  practical: {
    access: Array<{ raceId: string; raceName: string; start: SupporterGuideLocation; finish: SupporterGuideLocation; parking: string | null; shuttles: string | null; shuttleSchedule: string | null; roadRestrictions: string | null; mapUrl: string | null; note?: string | null }>;
    thirdPartyBibPickup: Array<{ raceId: string; raceName: string; allowed: boolean; conditions: string | null }>;
    emergencyPhone: string | null;
    links: Array<{ kind: 'official' | 'instagram' | 'facebook'; url: string }>;
  };
  publicationIds: string[];
  publishedAt: string;
  organizerPreview: boolean;
};
