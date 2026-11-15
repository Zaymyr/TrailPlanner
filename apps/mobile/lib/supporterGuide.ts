import type { RacebookAccessLocation, RacebookAccessPresentation, RacebookAccessTransport } from '../components/racebook/RacebookAccessSection';
import type { RacebookServiceItem } from '../components/racebook/RacebookServicesSection';
import type { RacebookSupporterPoint } from './racebook';

// Mirror of the transport-only `SupporterGuidePayload` contract in
// `packages/shared/src/supporter-guide.ts`. Mobile does not import that
// package at runtime; keep the two in sync (newer fields are optional so an
// older API response still renders).

export type SupporterGuideLocation = {
  label: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
};

export type SupporterGuideRaceDayClock = {
  date: string | null;
  time: string;
  dayOffset: number;
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

export type SupporterGuideAidStation = {
  id: string;
  name: string;
  km: number;
  assistanceAllowed: boolean;
  supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null;
  maxStopMinutes: number | null;
  amenities: string[];
  cutoffTime: string | null;
  cutoff?: SupporterGuideRaceDayClock | null;
  waterAvailable?: boolean;
  solidAvailable?: boolean;
  isFinish?: boolean;
};

export type SupporterGuideSupporterPoint = {
  id: string;
  name: string;
  km: number;
  encouragementAllowed: boolean;
  assistanceAllowed: boolean;
  accessLabel: string | null;
  accessNote: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  planUrl: string | null;
};

export type SupporterGuideStop = {
  id: string;
  name: string;
  km: number;
  kmMax: number | null;
  aidStation: boolean;
  isFinish: boolean;
  encouragementAllowed: boolean;
  assistanceAllowed: boolean;
  supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null;
  maxStopMinutes: number | null;
  services: { water: boolean; food: boolean; runnerAssistance: boolean; amenities: string[] };
  cutoff: SupporterGuideRaceDayClock | null;
  accessLabel: string | null;
  accessNote: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  planUrl: string | null;
};

export type SupporterGuideFormat = {
  raceId: string;
  name: string;
  date: string | null;
  distanceKm: number;
  elevationGainM?: number | null;
  startTime: string | null;
  finishCutoffTime: string | null;
  finishCutoff?: SupporterGuideRaceDayClock | null;
  startWaves: { id: string; name: string; time: string }[];
  awards: { id: string; label: string; time: string; location: string | null }[];
  supporterPoints: SupporterGuideSupporterPoint[];
  aidStations: SupporterGuideAidStation[];
  stops?: SupporterGuideStop[];
};

export type SupporterGuideTimelineEntry = {
  id: string;
  raceId: string;
  raceName: string;
  kind: 'start' | 'finish_cutoff' | 'awards' | 'arrival_estimate' | 'animation';
  date: string | null;
  time: string;
  label: string | null;
  location: string | null;
  mapsUrl?: string | null;
  audience?: 'men' | 'women' | null;
  /** Animations: event-wide (raceId and raceName empty), shown whatever races are followed. */
  eventWide?: boolean;
  endTime?: string | null;
  animationType?: 'animation' | 'concert' | 'kids_race' | 'briefing' | 'village' | 'other';
};

export type SupporterGuideAccess = {
  raceId: string;
  raceName: string;
  start: SupporterGuideLocation;
  finish: SupporterGuideLocation;
  parking: string | null;
  shuttles: string | null;
  shuttleSchedule: string | null;
  roadRestrictions: string | null;
  mapUrl: string | null;
  note?: string | null;
};

export type SupporterGuidePayload = {
  schemaVersion: 1;
  edition: { id: string; eventId: string; name: string; location: string | null; startDate: string | null; endDate: string | null; imageUrl: string | null };
  formats: SupporterGuideFormat[];
  timeline?: SupporterGuideTimelineEntry[];
  onSiteServices: SupporterGuideService[];
  stayServices: SupporterGuideService[];
  lodgingPartner: null | { mode: 'affiliate' | 'partner'; name: string; logoUrl: string | null; headline: string | null; clickUrl: string | null };
  practical: {
    access: SupporterGuideAccess[];
    thirdPartyBibPickup: { raceId: string; raceName: string; allowed: boolean; conditions: string | null }[];
    emergencyPhone: string | null;
    links: { kind: 'official' | 'instagram' | 'facebook'; url: string }[];
  };
  publicationIds: string[];
  publishedAt: string;
  organizerPreview: boolean;
};

export type SupporterGuideSection = 'programme' | 'follow' | 'onsite' | 'stay' | 'practical';

type Locale = 'fr' | 'en';

const localeTag = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : 'en-US');

/** Parses YYYY-MM-DD as a calendar day (UTC), so the device timezone never shifts it. */
function parseIsoDay(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "vendredi 13 novembre" / "Friday, November 13". */
export function formatGuideDay(value: string | null | undefined, locale: Locale): string | null {
  const date = parseIsoDay(value);
  if (!date) return null;
  const label = date.toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return label.charAt(0).toLocaleUpperCase(localeTag(locale)) + label.slice(1);
}

/** "13 – 15 nov. 2026" (same month), "30 oct. – 1 nov. 2026", or a single day. */
export function formatGuideDateRange(start: string | null | undefined, end: string | null | undefined, locale: Locale): string | null {
  const from = parseIsoDay(start);
  const to = parseIsoDay(end);
  const full = (date: Date) => date.toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!from) return to ? full(to) : null;
  if (!to || to.getTime() === from.getTime()) return full(from);
  if (from.getUTCFullYear() === to.getUTCFullYear() && from.getUTCMonth() === to.getUTCMonth()) {
    return `${from.getUTCDate()} – ${full(to)}`;
  }
  return `${from.toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${full(to)}`;
}

/** Number of calendar days covered by the edition (at least 1 when a start date exists). */
export function countGuideDays(start: string | null | undefined, end: string | null | undefined): number | null {
  const from = parseIsoDay(start);
  if (!from) return null;
  const to = parseIsoDay(end) ?? from;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

/** "15:00" on the reference day, otherwise "sam. 01:00" so supporters know which day. */
export function formatGuideClock(clock: SupporterGuideRaceDayClock | null | undefined, referenceDate: string | null, locale: Locale): string | null {
  if (!clock) return null;
  if (!clock.date || clock.date === referenceDate || clock.dayOffset === 0) return clock.time;
  const date = parseIsoDay(clock.date);
  if (!date) return clock.dayOffset > 0 ? `J+${clock.dayOffset} · ${clock.time}` : clock.time;
  const weekday = date.toLocaleDateString(localeTag(locale), { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${clock.time}`;
}

/** Server timeline, or the same chronology rebuilt from formats for an older API response. */
export function resolveGuideTimeline(guide: Pick<SupporterGuidePayload, 'formats' | 'timeline'>): SupporterGuideTimelineEntry[] {
  if (guide.timeline) return guide.timeline;
  const entries: SupporterGuideTimelineEntry[] = [];
  for (const format of guide.formats) {
    const starts = format.startWaves.length > 0
      ? format.startWaves.map((wave) => ({ id: `start-${wave.id}`, time: wave.time, label: wave.name as string | null }))
      : format.startTime ? [{ id: `start-${format.raceId}`, time: format.startTime, label: null }] : [];
    for (const start of starts) entries.push({ ...start, raceId: format.raceId, raceName: format.name, kind: 'start', date: format.date, location: null });
    for (const award of format.awards) {
      entries.push({ id: `awards-${award.id}`, raceId: format.raceId, raceName: format.name, kind: 'awards', date: format.date, time: award.time, label: award.label, location: award.location });
    }
  }
  return entries.sort((left, right) => (left.date ?? '9999').localeCompare(right.date ?? '9999') || left.time.localeCompare(right.time));
}

export type SupporterGuideDay = { date: string | null; entries: SupporterGuideTimelineEntry[] };

/** Groups an already sorted timeline by calendar day, optionally for one race. */
export function groupGuideTimelineByDay(entries: readonly SupporterGuideTimelineEntry[], raceId: string | null = null): SupporterGuideDay[] {
  const days: SupporterGuideDay[] = [];
  for (const entry of entries) {
    if (raceId && entry.raceId !== raceId) continue;
    const current = days.at(-1);
    if (current && current.date === entry.date) current.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  }
  return days;
}

/** Supporter-point shape accepted by `RacebookSupporterPointsSection` (coordinates may be absent). */
export function toRacebookSupporterPoints(points: readonly SupporterGuideSupporterPoint[]): RacebookSupporterPoint[] {
  return points.map((point, index) => ({
    id: point.id,
    name: point.name,
    km: point.km,
    encouragementAllowed: point.encouragementAllowed,
    assistanceAllowed: point.assistanceAllowed,
    accessLabel: point.accessLabel,
    latitude: point.latitude ?? Number.NaN,
    longitude: point.longitude ?? Number.NaN,
    googleMapsUrl: point.mapsUrl,
    accessNote: point.accessNote,
    planUrl: point.planUrl,
    orderIndex: index,
  }));
}

export function hasFollowContent(format: Pick<SupporterGuideFormat, 'supporterPoints' | 'aidStations'>) {
  return format.supporterPoints.length > 0 || format.aidStations.length > 0;
}

export function buildDirectionsUrl(location: Pick<SupporterGuideLocation, 'mapsUrl' | 'latitude' | 'longitude' | 'address'>): string | null {
  if (location.mapsUrl) return location.mapsUrl;
  if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && location.latitude !== null && location.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
  }
  return location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : null;
}

export function toRacebookServiceItems(services: readonly SupporterGuideService[]): RacebookServiceItem[] {
  return services.map((service) => ({
    id: service.id,
    category: service.type,
    name: service.name,
    description: service.description,
    address: service.location.address,
    distanceKm: null,
    directionsUrl: buildDirectionsUrl(service.location),
    websiteUrl: service.websiteUrl,
    phoneUrl: service.phone ? buildTelephoneUrl(service.phone) : null,
  }));
}

export function buildTelephoneUrl(phone: string): string | null {
  const normalized = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return normalized.length > 0 ? `tel:${normalized}` : null;
}

const normalizeAddress = (value: string | null | undefined) => value?.trim().toLocaleLowerCase().replace(/\s+/g, ' ') ?? '';

/** Same presentation as the runner RaceBook Accès tab, for one race of the guide. */
export function buildGuideAccessPresentation(
  access: SupporterGuideAccess | null | undefined,
  copy: { sameLocation: string; start: string; finish: string; importantInfo: string; restrictions: string; parking: string; shuttles: string },
): RacebookAccessPresentation | null {
  if (!access) return null;
  const startAddress = access.start.address;
  const finishAddress = access.finish.address;
  const sameLocation = Boolean(startAddress && normalizeAddress(startAddress) === normalizeAddress(finishAddress));
  const locations: RacebookAccessLocation[] = sameLocation
    ? [{ key: 'start-finish', label: copy.sameLocation, value: startAddress!, actionUrl: buildDirectionsUrl(access.start) ?? buildDirectionsUrl(access.finish) }]
    : [
        startAddress ? { key: 'start', label: copy.start, value: startAddress, actionUrl: buildDirectionsUrl(access.start) } : null,
        finishAddress ? { key: 'finish', label: copy.finish, value: finishAddress, actionUrl: buildDirectionsUrl(access.finish) } : null,
      ].filter((value): value is RacebookAccessLocation => Boolean(value));
  const priorityItems = [
    access.note ? { label: copy.importantInfo, value: access.note } : null,
    access.roadRestrictions ? { label: copy.restrictions, value: access.roadRestrictions } : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));
  const transportItems: RacebookAccessTransport[] = [];
  if (access.parking) transportItems.push({ key: 'parking', icon: 'car-outline', title: copy.parking, description: access.parking });
  if (access.shuttles || access.shuttleSchedule) {
    transportItems.push({
      key: 'shuttles',
      icon: 'bus-outline',
      title: copy.shuttles,
      description: access.shuttles ?? access.shuttleSchedule!,
      schedule: access.shuttles ? access.shuttleSchedule : null,
    });
  }
  return {
    locations,
    priorityItems,
    transportItems,
    generalMapUrl: access.mapUrl,
    hasContent: locations.length > 0 || priorityItems.length > 0 || transportItems.length > 0 || Boolean(access.mapUrl),
  };
}

export function resolveVisibleGuideSections(guide: SupporterGuidePayload): SupporterGuideSection[] {
  const visible: Record<SupporterGuideSection, boolean> = {
    programme: resolveGuideTimeline(guide).length > 0 || guide.formats.length > 0,
    follow: guide.formats.some(hasFollowContent),
    onsite: guide.onSiteServices.length > 0,
    stay: guide.stayServices.length > 0 || Boolean(guide.lodgingPartner?.clickUrl),
    practical: guide.practical.access.length > 0 || guide.practical.thirdPartyBibPickup.length > 0,
  };
  return (['programme', 'follow', 'onsite', 'stay', 'practical'] as const).filter((section) => visible[section]);
}


/** Server-grouped stops, or one stop per row for an older API response. */
export function resolveGuideStops(format: SupporterGuideFormat): SupporterGuideStop[] {
  if (format.stops) return format.stops;
  return [
    ...format.aidStations.map((station): SupporterGuideStop => ({
      id: `s:${station.id}`, name: station.name, km: station.km, kmMax: null, aidStation: true, isFinish: station.isFinish === true,
      encouragementAllowed: false, assistanceAllowed: false, supportersAccess: station.supportersAccess, maxStopMinutes: station.maxStopMinutes,
      services: { water: station.waterAvailable !== false, food: station.solidAvailable !== false, runnerAssistance: station.assistanceAllowed, amenities: station.amenities },
      cutoff: station.cutoff ?? (station.cutoffTime ? { date: null, time: station.cutoffTime, dayOffset: 0 } : null),
      accessLabel: null, accessNote: null, latitude: null, longitude: null, mapsUrl: null, planUrl: null,
    })),
    ...format.supporterPoints.map((point): SupporterGuideStop => ({
      id: `p:${point.id}`, name: point.name, km: point.km, kmMax: null, aidStation: false, isFinish: false,
      encouragementAllowed: point.encouragementAllowed, assistanceAllowed: point.assistanceAllowed, supportersAccess: null, maxStopMinutes: null,
      services: { water: false, food: false, runnerAssistance: false, amenities: [] }, cutoff: null,
      accessLabel: point.accessLabel, accessNote: point.accessNote, latitude: point.latitude, longitude: point.longitude, mapsUrl: point.mapsUrl, planUrl: point.planUrl,
    })),
  ].sort((left, right) => left.km - right.km);
}

export type GuideTimelineKind = 'all' | 'start' | 'arrival' | 'awards' | 'animations';

const KIND_BY_ENTRY: Record<SupporterGuideTimelineEntry['kind'], Exclude<GuideTimelineKind, 'all'>> = {
  start: 'start',
  finish_cutoff: 'arrival',
  arrival_estimate: 'arrival',
  awards: 'awards',
  animation: 'animations',
};

/** Programme filtered by type (tab) and by the races the supporter follows. */
export function filterGuideTimeline(
  entries: readonly SupporterGuideTimelineEntry[],
  kind: GuideTimelineKind,
  raceIds: ReadonlySet<string> | null,
): SupporterGuideTimelineEntry[] {
  return entries.filter((entry) =>
    (kind === 'all' || KIND_BY_ENTRY[entry.kind] === kind) && (entry.eventWide || !raceIds || raceIds.has(entry.raceId)),
  );
}

export function availableGuideKinds(entries: readonly SupporterGuideTimelineEntry[]): Exclude<GuideTimelineKind, 'all'>[] {
  const present = new Set(entries.map((entry) => KIND_BY_ENTRY[entry.kind]));
  return (['start', 'arrival', 'awards', 'animations'] as const).filter((kind) => present.has(kind));
}

/** Local race-day time (the supporter is assumed to be on the event's timezone). */
export function toLocalDate(date: string | null | undefined, time: string | null | undefined): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  const clock = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!day || !clock) return null;
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(clock[1]), Number(clock[2]));
}

export function localIsoDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type GuideEntryLiveStatus = 'past' | 'next' | 'upcoming';

/**
 * Live state of one day: past entries, the next one (highlighted with a
 * countdown) and where the « maintenant » line sits. Only today is live.
 */
export function resolveDayLiveState(entries: readonly SupporterGuideTimelineEntry[], dayDate: string | null, now: Date) {
  if (!dayDate || dayDate !== localIsoDay(now)) return null;
  const statusById: Record<string, GuideEntryLiveStatus> = {};
  let nowIndex = entries.length;
  let nextFound = false;
  entries.forEach((entry, index) => {
    const at = toLocalDate(entry.date ?? dayDate, entry.time);
    if (at && at.getTime() < now.getTime()) {
      statusById[entry.id] = 'past';
      return;
    }
    if (!nextFound) {
      nextFound = true;
      nowIndex = index;
      statusById[entry.id] = 'next';
      return;
    }
    statusById[entry.id] = 'upcoming';
  });
  return { statusById, nowIndex };
}

/** « dans 25 min » / « dans 2 h 41 ». */
export function formatCountdown(target: Date, now: Date, locale: Locale): string {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const duration = hours === 0 ? `${minutes} min` : `${hours} h ${String(rest).padStart(2, '0')}`;
  return locale === 'fr' ? `dans ${duration}` : `in ${duration}`;
}

export function formatClockNow(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** A place is closed once its last-runner cutoff has passed. */
export function isStopClosed(stop: Pick<SupporterGuideStop, 'cutoff'>, raceDate: string | null, now: Date): boolean {
  if (!stop.cutoff) return false;
  const at = toLocalDate(stop.cutoff.date ?? raceDate, stop.cutoff.time);
  return Boolean(at && at.getTime() < now.getTime());
}
