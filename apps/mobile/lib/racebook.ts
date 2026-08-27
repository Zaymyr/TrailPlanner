type OrganizerEquipmentItem = {
  id: string | null;
  label: string;
  required: boolean;
  cold: boolean;
  heat: boolean;
  note: string | null;
};

type OrganizerEquipmentDetails = {
  weatherPlan: 'normal' | 'cold' | 'heat';
  items: OrganizerEquipmentItem[];
  note: string | null;
};

type RunnerEquipmentItem = OrganizerEquipmentItem & {
  active: boolean;
};

type OrganizerLocationDetails = {
  label: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  source: 'manual' | 'autocomplete' | null;
};

type OrganizerBibPickupDetails = {
  overrideEnabled: boolean;
  location: string | null;
  locationDetails: OrganizerLocationDetails;
  schedule: string | null;
  locations: OrganizerBibPickupLocation[];
  requiredDocuments: string | null;
  thirdPartyPickupAllowed: boolean | null;
  equipmentCheck: boolean | null;
  note: string | null;
};

type OrganizerBibPickupSlot = {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
};

type OrganizerBibPickupLocation = {
  location: string | null;
  locationDetails: OrganizerLocationDetails;
  slots: OrganizerBibPickupSlot[];
};

type OrganizerAccessDetails = {
  startAddress: string | null;
  startLocation: OrganizerLocationDetails;
  finishAddress: string | null;
  finishLocation: OrganizerLocationDetails;
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

type OrganizerServicesDetails = {
  supporters: string | null;
  accommodations: string | null;
  restaurants: string | null;
  recovery: string | null;
  partners: string | null;
  lastMinuteMessage: string | null;
  note: string | null;
};

type OrganizerRunnerInfoDetails = {
  startArea: string | null;
  briefing: string | null;
  rules: string | null;
  note: string | null;
};

type OrganizerEventDetails = {
  officialWebsiteUrl: string | null;
  emergencyContact: {
    name: string | null;
    phone: string | null;
  };
  dateRange: {
    endDate: string | null;
  };
  eventLocation: OrganizerLocationDetails;
  mandatoryEquipment: OrganizerEquipmentDetails;
  bibPickup: OrganizerBibPickupDetails;
  access: OrganizerAccessDetails;
  services: OrganizerServicesDetails;
};

type OrganizerRaceDetails = {
  raceLocation: OrganizerLocationDetails;
  schedule: {
    startTime: string | null;
    finishCutoffTime: string | null;
    shuttleSchedule: string | null;
    cutoffNote: string | null;
    note: string | null;
  };
  mandatoryEquipment: OrganizerEquipmentDetails;
  bibPickup: OrganizerBibPickupDetails;
  access: OrganizerAccessDetails;
  runnerInfo: OrganizerRunnerInfoDetails;
};

type OrganizerAidStationDetails = {
  cumulativeElevationGainM: number | null;
  cumulativeElevationLossM: number | null;
  cutoffTime: string | null;
  dropBagAvailable: boolean;
  organizerNote: string | null;
};

type AidStationProduct = {
  id: string;
  label: string;
  notes: string | null;
  orderIndex: number;
};

export type RaceParticipationMode = 'solo' | 'relay' | 'solo_and_relay';

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

export type RacebookAidStation = {
  id: string;
  name: string;
  km: number;
  waterAvailable: boolean;
  solidAvailable: boolean;
  assistanceAllowed: boolean;
  notes: string | null;
  orderIndex: number;
  organizerDetails: OrganizerAidStationDetails;
  products: AidStationProduct[];
};

export type RacebookScreenData = {
  race: {
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number | null;
    raceDate: string | null;
    isLive: boolean;
    thumbnailUrl: string | null;
    location: string | null;
    participationMode: RaceParticipationMode | null;
    organizerDetails: OrganizerRaceDetails;
  };
  event: {
    id: string | null;
    name: string | null;
    location: string | null;
    raceDate: string | null;
    thumbnailUrl: string | null;
    isLive: boolean;
    organizerDetails: OrganizerEventDetails;
  };
  runnerDetails: {
    equipment: OrganizerEquipmentDetails;
    equipmentStatus: {
      weatherPlan: OrganizerEquipmentDetails['weatherPlan'];
      items: RunnerEquipmentItem[];
      commonItems: RunnerEquipmentItem[];
      raceItems: RunnerEquipmentItem[];
    };
    commonEquipment: OrganizerEquipmentDetails;
    raceEquipment: OrganizerEquipmentDetails;
    bibPickup: OrganizerBibPickupDetails;
    access: OrganizerAccessDetails;
    services: OrganizerServicesDetails;
    schedule: OrganizerRaceDetails['schedule'];
    runnerInfo: OrganizerRunnerInfoDetails;
  };
  aidStations: RacebookAidStation[];
  relayPoints: RacebookRelayPoint[];
  canOpen: boolean;
};

export type RacebookSignals = {
  raceIsLive: boolean | null | undefined;
  racebookIsLive: boolean | null | undefined;
  hasOrganizerAccess?: boolean;
  hasAidStations: boolean | null | undefined;
  hasRelayCourse?: boolean | null;
  eventOrganizerDetails: unknown;
  raceOrganizerDetails: unknown;
};

const DEFAULT_EQUIPMENT: OrganizerEquipmentDetails = {
  weatherPlan: 'normal',
  items: [],
  note: null,
};

const DEFAULT_LOCATION_DETAILS: OrganizerLocationDetails = {
  label: null,
  lat: null,
  lng: null,
  googleMapsUrl: null,
  source: null,
};

const DEFAULT_BIB_PICKUP: OrganizerBibPickupDetails = {
  overrideEnabled: false,
  location: null,
  locationDetails: DEFAULT_LOCATION_DETAILS,
  schedule: null,
  locations: [],
  requiredDocuments: null,
  thirdPartyPickupAllowed: null,
  equipmentCheck: null,
  note: null,
};

const DEFAULT_ACCESS: OrganizerAccessDetails = {
  startAddress: null,
  startLocation: DEFAULT_LOCATION_DETAILS,
  finishAddress: null,
  finishLocation: DEFAULT_LOCATION_DETAILS,
  officialParkings: null,
  shuttles: null,
  shuttleSchedule: null,
  roadRestrictions: null,
  mapUrl: null,
  note: null,
  enabledSections: {
    officialParkings: true,
    shuttles: true,
    roadRestrictions: true,
    mapUrl: true,
    runnerInfo: true,
  },
};

const DEFAULT_SERVICES: OrganizerServicesDetails = {
  supporters: null,
  accommodations: null,
  restaurants: null,
  recovery: null,
  partners: null,
  lastMinuteMessage: null,
  note: null,
};

const DEFAULT_RUNNER_INFO: OrganizerRunnerInfoDetails = {
  startArea: null,
  briefing: null,
  rules: null,
  note: null,
};

const DEFAULT_EVENT_DETAILS: OrganizerEventDetails = {
  officialWebsiteUrl: null,
  emergencyContact: {
    name: null,
    phone: null,
  },
  dateRange: {
    endDate: null,
  },
  eventLocation: DEFAULT_LOCATION_DETAILS,
  mandatoryEquipment: DEFAULT_EQUIPMENT,
  bibPickup: DEFAULT_BIB_PICKUP,
  access: DEFAULT_ACCESS,
  services: DEFAULT_SERVICES,
};

const DEFAULT_RACE_DETAILS: OrganizerRaceDetails = {
  raceLocation: DEFAULT_LOCATION_DETAILS,
  schedule: {
    startTime: null,
    finishCutoffTime: null,
    shuttleSchedule: null,
    cutoffNote: null,
    note: null,
  },
  mandatoryEquipment: DEFAULT_EQUIPMENT,
  bibPickup: DEFAULT_BIB_PICKUP,
  access: DEFAULT_ACCESS,
  runnerInfo: DEFAULT_RUNNER_INFO,
};

const DEFAULT_AID_STATION_DETAILS: OrganizerAidStationDetails = {
  cumulativeElevationGainM: null,
  cumulativeElevationLossM: null,
  cutoffTime: null,
  dropBagAvailable: false,
  organizerNote: null,
};

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOrganizerPhoneNumber(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('330') && digits.length === 12) digits = `33${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 10) digits = `33${digits.slice(1)}`;

  if (digits.startsWith('33') && digits.length === 11) {
    const nationalNumber = digits.slice(2);
    return `+33 ${nationalNumber[0]} ${nationalNumber.slice(1).match(/.{1,2}/g)?.join(' ') ?? ''}`.trim();
  }

  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    return digits.length > 0 ? `+${digits}` : trimmed;
  }

  if (digits.length <= 4) return digits || trimmed;
  return digits.length > 0 ? digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : trimmed;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseLocationDetails(value: unknown): OrganizerLocationDetails {
  const record = readRecord(value);
  const source = record.source === 'manual' || record.source === 'autocomplete' ? record.source : null;

  return {
    label: readText(record.label),
    lat: readNumber(record.lat),
    lng: readNumber(record.lng),
    googleMapsUrl: readText(record.googleMapsUrl),
    source,
  };
}

function parseEquipmentDetails(value: unknown): OrganizerEquipmentDetails {
  const record = readRecord(value);
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item) => {
        const entry = readRecord(item);
        const label = readText(entry.label);
        if (!label) return [];

        return [
          {
            id: readText(entry.id),
            label,
            required: readBoolean(entry.required, true),
            cold: readBoolean(entry.cold, false),
            heat: readBoolean(entry.heat, false),
            note: readText(entry.note),
          },
        ];
      })
    : [];

  return {
    weatherPlan: record.weatherPlan === 'cold' || record.weatherPlan === 'heat' ? record.weatherPlan : 'normal',
    items,
    note: readText(record.note),
  };
}

function parseBibPickupDetails(value: unknown): OrganizerBibPickupDetails {
  const record = readRecord(value);
  const locations = Array.isArray(record.locations)
    ? record.locations.map((locationValue) => {
        const locationRecord = readRecord(locationValue);
        const slots = Array.isArray(locationRecord.slots)
          ? locationRecord.slots.map((slotValue) => {
              const slotRecord = readRecord(slotValue);
              return {
                date: readText(slotRecord.date),
                startTime: readText(slotRecord.startTime),
                endTime: readText(slotRecord.endTime),
              };
            })
          : [];

        return {
          location: readText(locationRecord.location),
          locationDetails: parseLocationDetails(locationRecord.locationDetails),
          slots,
        };
      })
    : [];

  return {
    overrideEnabled: readBoolean(record.overrideEnabled, false),
    location: readText(record.location),
    locationDetails: parseLocationDetails(record.locationDetails),
    schedule: readText(record.schedule),
    locations,
    requiredDocuments: readText(record.requiredDocuments),
    thirdPartyPickupAllowed: readNullableBoolean(record.thirdPartyPickupAllowed),
    equipmentCheck: readNullableBoolean(record.equipmentCheck),
    note: readText(record.note),
  };
}

function parseAccessDetails(value: unknown): OrganizerAccessDetails {
  const record = readRecord(value);
  const enabledSections = readRecord(record.enabledSections);

  return {
    startAddress: readText(record.startAddress),
    startLocation: parseLocationDetails(record.startLocation),
    finishAddress: readText(record.finishAddress),
    finishLocation: parseLocationDetails(record.finishLocation),
    officialParkings: readText(record.officialParkings),
    shuttles: readText(record.shuttles),
    shuttleSchedule: readText(record.shuttleSchedule),
    roadRestrictions: readText(record.roadRestrictions),
    mapUrl: readText(record.mapUrl),
    note: readText(record.note),
    enabledSections: {
      officialParkings: readBoolean(enabledSections.officialParkings, true),
      shuttles: readBoolean(enabledSections.shuttles, true),
      roadRestrictions: readBoolean(enabledSections.roadRestrictions, true),
      mapUrl: readBoolean(enabledSections.mapUrl, true),
      runnerInfo: readBoolean(enabledSections.runnerInfo, true),
    },
  };
}

function parseServicesDetails(value: unknown): OrganizerServicesDetails {
  const record = readRecord(value);

  return {
    supporters: readText(record.supporters),
    accommodations: readText(record.accommodations),
    restaurants: readText(record.restaurants),
    recovery: readText(record.recovery),
    partners: readText(record.partners),
    lastMinuteMessage: readText(record.lastMinuteMessage),
    note: readText(record.note),
  };
}

function parseRunnerInfoDetails(value: unknown): OrganizerRunnerInfoDetails {
  const record = readRecord(value);

  return {
    startArea: readText(record.startArea),
    briefing: readText(record.briefing),
    rules: readText(record.rules),
    note: readText(record.note),
  };
}

function parseEventDetails(value: unknown): OrganizerEventDetails {
  const record = readRecord(value);
  const dateRange = readRecord(record.dateRange);
  const emergencyContact = readRecord(record.emergencyContact);
  const emergencyPhone = readText(emergencyContact.phone);

  return {
    officialWebsiteUrl: readText(record.officialWebsiteUrl),
    emergencyContact: {
      name: readText(emergencyContact.name),
      phone: emergencyPhone ? normalizeOrganizerPhoneNumber(emergencyPhone) : null,
    },
    dateRange: {
      endDate: readText(dateRange.endDate),
    },
    eventLocation: parseLocationDetails(record.eventLocation),
    mandatoryEquipment: parseEquipmentDetails(record.mandatoryEquipment),
    bibPickup: parseBibPickupDetails(record.bibPickup),
    access: parseAccessDetails(record.access),
    services: parseServicesDetails(record.services),
  };
}

function parseRaceDetails(value: unknown): OrganizerRaceDetails {
  const record = readRecord(value);
  const schedule = readRecord(record.schedule);
  const access = parseAccessDetails(record.access);
  const shuttleSchedule = access.shuttleSchedule ?? readText(schedule.shuttleSchedule);

  return {
    raceLocation: parseLocationDetails(record.raceLocation),
    schedule: {
      startTime: readText(schedule.startTime),
      finishCutoffTime: readText(schedule.finishCutoffTime),
      shuttleSchedule,
      cutoffNote: readText(schedule.cutoffNote),
      note: readText(schedule.note),
    },
    mandatoryEquipment: parseEquipmentDetails(record.mandatoryEquipment),
    bibPickup: parseBibPickupDetails(record.bibPickup),
    access: {
      ...access,
      shuttleSchedule,
    },
    runnerInfo: parseRunnerInfoDetails(record.runnerInfo),
  };
}

function parseAidStationDetails(value: unknown): OrganizerAidStationDetails {
  const record = readRecord(value);

  return {
    cumulativeElevationGainM: readNumber(record.cumulativeElevationGainM),
    cumulativeElevationLossM: readNumber(record.cumulativeElevationLossM),
    cutoffTime: readText(record.cutoffTime),
    dropBagAvailable: readBoolean(record.dropBagAvailable, false),
    organizerNote: readText(record.organizerNote),
  };
}

function hasAnyText(values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasLocationContent(location: OrganizerLocationDetails): boolean {
  return hasAnyText([location.label, location.googleMapsUrl]) || (location.lat !== null && location.lng !== null);
}

function hasEquipmentContent(details: OrganizerEquipmentDetails): boolean {
  return details.items.length > 0 || hasAnyText([details.note]);
}

function hasBibContent(details: OrganizerBibPickupDetails): boolean {
  return (
    hasAnyText([details.location, details.schedule, details.requiredDocuments, details.note]) ||
    hasLocationContent(details.locationDetails) ||
    details.locations.some(
      (location) =>
        hasAnyText([location.location]) ||
        hasLocationContent(location.locationDetails) ||
        location.slots.some((slot) => hasAnyText([slot.date, slot.startTime, slot.endTime]))
    ) ||
    details.thirdPartyPickupAllowed !== null ||
    details.equipmentCheck !== null
  );
}

function hasAccessContent(details: OrganizerAccessDetails): boolean {
  return hasAnyText([
    details.startAddress,
    details.finishAddress,
    details.enabledSections.officialParkings ? details.officialParkings : null,
    details.enabledSections.shuttles ? details.shuttles : null,
    details.enabledSections.shuttles ? details.shuttleSchedule : null,
    details.enabledSections.roadRestrictions ? details.roadRestrictions : null,
    details.enabledSections.mapUrl ? details.mapUrl : null,
    details.note,
  ]) || hasLocationContent(details.startLocation) || hasLocationContent(details.finishLocation);
}

function hasServicesContent(details: OrganizerServicesDetails): boolean {
  return hasAnyText([
    details.supporters,
    details.accommodations,
    details.restaurants,
    details.recovery,
    details.partners,
    details.lastMinuteMessage,
    details.note,
  ]);
}

function hasRunnerInfoContent(details: OrganizerRunnerInfoDetails): boolean {
  return hasAnyText([details.startArea, details.briefing, details.rules, details.note]);
}

function hasScheduleContent(details: OrganizerRaceDetails['schedule']): boolean {
  return hasAnyText([
    details.startTime,
    details.finishCutoffTime,
    details.shuttleSchedule,
    details.cutoffNote,
    details.note,
  ]);
}

function buildEquipmentKey(item: Pick<OrganizerEquipmentItem, 'label' | 'required' | 'cold' | 'heat'>) {
  return `${item.label.trim().toLocaleLowerCase('fr-FR')}::${item.required ? 'required' : 'recommended'}::${item.cold ? 'cold' : 'base'}::${item.heat ? 'heat' : 'base'}`;
}

function dedupeEquipmentItems(items: OrganizerEquipmentItem[]): OrganizerEquipmentItem[] {
  const seen = new Set<string>();
  const deduped: OrganizerEquipmentItem[] = [];

  items.forEach((item) => {
    const key = buildEquipmentKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
}

function getRaceSpecificEquipment(
  commonEquipment: OrganizerEquipmentDetails,
  raceEquipment: OrganizerEquipmentDetails,
): OrganizerEquipmentDetails {
  const commonKeys = new Set(commonEquipment.items.map((item) => buildEquipmentKey(item)));

  return {
    ...raceEquipment,
    items: dedupeEquipmentItems(raceEquipment.items).filter((item) => !commonKeys.has(buildEquipmentKey(item))),
  };
}

function mergeEquipmentItems(...lists: OrganizerEquipmentItem[][]): OrganizerEquipmentItem[] {
  return dedupeEquipmentItems(lists.flat());
}

function mergePreferredText(eventValue: string | null, raceValue: string | null): string | null {
  return raceValue ?? eventValue;
}

function isWeatherTaggedEquipment(item: Pick<OrganizerEquipmentItem, 'cold' | 'heat'>) {
  return item.cold || item.heat;
}

function isEquipmentItemActiveForWeatherPlan(
  item: Pick<OrganizerEquipmentItem, 'cold' | 'heat'>,
  weatherPlan: OrganizerEquipmentDetails['weatherPlan'],
) {
  if (!isWeatherTaggedEquipment(item)) return true;
  if (weatherPlan === 'cold') return item.cold;
  if (weatherPlan === 'heat') return item.heat;
  return false;
}

function decorateEquipmentItemsWithWeatherPlan(
  items: OrganizerEquipmentItem[],
  weatherPlan: OrganizerEquipmentDetails['weatherPlan'],
): RunnerEquipmentItem[] {
  return items.map((item) => ({
    ...item,
    active: isEquipmentItemActiveForWeatherPlan(item, weatherPlan),
  }));
}

function buildRunnerDetails(eventDetails: OrganizerEventDetails, raceDetails: OrganizerRaceDetails) {
  const commonEquipment = eventDetails.mandatoryEquipment;
  const raceSpecificEquipment = getRaceSpecificEquipment(commonEquipment, raceDetails.mandatoryEquipment);
  const weatherPlan = commonEquipment.weatherPlan;
  const mergedEquipmentItems = mergeEquipmentItems(commonEquipment.items, raceSpecificEquipment.items);

  return {
    commonEquipment,
    raceEquipment: raceSpecificEquipment,
    equipment: {
      weatherPlan,
      items: mergedEquipmentItems,
      note: [commonEquipment.note, raceDetails.mandatoryEquipment.note].filter(Boolean).join('\n') || null,
    },
    equipmentStatus: {
      weatherPlan,
      items: decorateEquipmentItemsWithWeatherPlan(mergedEquipmentItems, weatherPlan),
      commonItems: decorateEquipmentItemsWithWeatherPlan(commonEquipment.items, weatherPlan),
      raceItems: decorateEquipmentItemsWithWeatherPlan(raceSpecificEquipment.items, weatherPlan),
    },
    bibPickup: raceDetails.bibPickup.overrideEnabled ? raceDetails.bibPickup : eventDetails.bibPickup,
    access: {
      startAddress: mergePreferredText(eventDetails.access.startAddress, raceDetails.access.startAddress),
      startLocation: hasLocationContent(raceDetails.access.startLocation)
        ? raceDetails.access.startLocation
        : eventDetails.access.startLocation,
      finishAddress: mergePreferredText(eventDetails.access.finishAddress, raceDetails.access.finishAddress),
      finishLocation: hasLocationContent(raceDetails.access.finishLocation)
        ? raceDetails.access.finishLocation
        : eventDetails.access.finishLocation,
      officialParkings: raceDetails.access.enabledSections.officialParkings
        ? mergePreferredText(eventDetails.access.officialParkings, raceDetails.access.officialParkings)
        : null,
      shuttles: raceDetails.access.enabledSections.shuttles
        ? mergePreferredText(eventDetails.access.shuttles, raceDetails.access.shuttles)
        : null,
      shuttleSchedule: raceDetails.access.enabledSections.shuttles
        ? mergePreferredText(eventDetails.access.shuttleSchedule, raceDetails.access.shuttleSchedule)
        : null,
      roadRestrictions: raceDetails.access.enabledSections.roadRestrictions
        ? mergePreferredText(eventDetails.access.roadRestrictions, raceDetails.access.roadRestrictions)
        : null,
      mapUrl: raceDetails.access.enabledSections.mapUrl
        ? mergePreferredText(eventDetails.access.mapUrl, raceDetails.access.mapUrl)
        : null,
      note: mergePreferredText(eventDetails.access.note, raceDetails.access.note),
      enabledSections: {
        officialParkings: raceDetails.access.enabledSections.officialParkings,
        shuttles: raceDetails.access.enabledSections.shuttles,
        roadRestrictions: raceDetails.access.enabledSections.roadRestrictions,
        mapUrl: raceDetails.access.enabledSections.mapUrl,
        runnerInfo: raceDetails.access.enabledSections.runnerInfo,
      },
    },
    services: eventDetails.services,
    schedule: raceDetails.schedule,
    runnerInfo: raceDetails.runnerInfo,
  };
}

function hasOrganizerContent(eventDetails: OrganizerEventDetails, raceDetails: OrganizerRaceDetails): boolean {
  const runnerDetails = buildRunnerDetails(eventDetails, raceDetails);

  return (
    hasAnyText([
      eventDetails.dateRange.endDate,
      eventDetails.emergencyContact.phone,
    ]) ||
    hasLocationContent(eventDetails.eventLocation) ||
    hasLocationContent(raceDetails.raceLocation) ||
    hasEquipmentContent(eventDetails.mandatoryEquipment) ||
    hasEquipmentContent(raceDetails.mandatoryEquipment) ||
    hasBibContent(eventDetails.bibPickup) ||
    hasAccessContent(runnerDetails.access) ||
    hasServicesContent(eventDetails.services) ||
    hasRunnerInfoContent(raceDetails.runnerInfo) ||
    hasScheduleContent(raceDetails.schedule)
  );
}

function normalizeProductLabel(productRecord: Record<string, unknown>): string | null {
  const name = readText(productRecord.name);
  if (!name) return null;

  const brand = readText(productRecord.brand);
  if (!brand) return name;
  if (name.toLocaleLowerCase('fr-FR').startsWith(brand.toLocaleLowerCase('fr-FR'))) return name;
  return `${brand} ${name}`;
}

export function canShowRacebook(signals: RacebookSignals): boolean {
  if (signals.hasOrganizerAccess !== true) {
    if (signals.raceIsLive !== true) return false;
    if (signals.racebookIsLive !== true) return false;
  }

  const eventDetails = parseEventDetails(signals.eventOrganizerDetails);
  const raceDetails = parseRaceDetails(signals.raceOrganizerDetails);

  return hasOrganizerContent(eventDetails, raceDetails) || signals.hasRelayCourse === true;
}

export async function fetchRaceRacebookData(raceId: string): Promise<RacebookScreenData | null> {
  const { supabase } = await import('./supabase');

  const { data: raceRow, error: raceError } = await supabase
    .from('races')
    .select(`
      id,
      name,
      distance_km,
      elevation_gain_m,
      elevation_loss_m,
      race_date,
      is_live,
      racebook_is_live,
      thumbnail_url,
      location_text,
      participation_mode,
      organizer_details,
      race_events (
        id,
        name,
        location,
        race_date,
        thumbnail_url,
        is_live,
        organizer_details
      )
    `)
    .eq('id', raceId)
    .maybeSingle();

  if (raceError || !raceRow) return null;

  const { data: stationRows, error: stationError } = await supabase
    .from('race_aid_stations')
    .select(`
      id,
      name,
      km,
      water_available,
      solid_available,
      assistance_allowed,
      notes,
      order_index,
      organizer_details,
      race_aid_station_products (
        id,
        notes,
        order_index,
        products (
          id,
          name,
          brand
        )
      )
    `)
    .eq('race_id', raceId)
    .order('order_index', { ascending: true });

  if (stationError) return null;

  const { data: relayPointRows, error: relayPointError } = await supabase
    .from('race_relay_points')
    .select('id,race_aid_station_id,name,km,handover_time,cutoff_time,notes,order_index')
    .eq('race_id', raceId)
    .order('order_index', { ascending: true });

  if (relayPointError) return null;

  const eventRelation = Array.isArray(raceRow.race_events) ? raceRow.race_events[0] ?? null : raceRow.race_events ?? null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  const { data: organizerMembership } =
    userId && eventRelation?.id
      ? await supabase
          .from('race_event_organizers')
          .select('event_id')
          .eq('event_id', eventRelation.id)
          .eq('user_id', userId)
          .is('revoked_at', null)
          .maybeSingle()
      : { data: null };

  const eventDetails = parseEventDetails(eventRelation?.organizer_details);
  const raceDetails = parseRaceDetails(raceRow.organizer_details);
  const runnerDetails = buildRunnerDetails(eventDetails, raceDetails);

  const aidStations = Array.isArray(stationRows)
    ? stationRows
        .map((row) => {
          const productLinks = Array.isArray(row.race_aid_station_products) ? row.race_aid_station_products : [];

          return {
            id: String(row.id),
            name: readText(row.name) ?? '',
            km: readNumber(row.km) ?? 0,
            waterAvailable: row.water_available !== false,
            solidAvailable: row.solid_available !== false,
            assistanceAllowed: row.assistance_allowed !== false,
            notes: readText(row.notes),
            orderIndex: readNumber(row.order_index) ?? 0,
            organizerDetails: parseAidStationDetails(row.organizer_details),
            products: productLinks
              .flatMap((link: unknown) => {
                const linkRecord = readRecord(link);
                const productValue = Array.isArray(linkRecord.products)
                  ? readRecord(linkRecord.products[0])
                  : readRecord(linkRecord.products);
                const label = normalizeProductLabel(productValue);
                const id = readText(productValue.id);

                if (!label || !id) return [];

                return [
                  {
                    id,
                    label,
                    notes: readText(linkRecord.notes),
                    orderIndex: readNumber(linkRecord.order_index) ?? 0,
                  },
                ];
              })
              .sort((left: AidStationProduct, right: AidStationProduct) => left.orderIndex - right.orderIndex),
          };
        })
        .filter((row) => row.name.length > 0 && Number.isFinite(row.km))
        .sort((left: RacebookAidStation, right: RacebookAidStation) => left.orderIndex - right.orderIndex || left.km - right.km)
    : [];

  const canOpen = canShowRacebook({
    raceIsLive: raceRow.is_live,
    racebookIsLive: raceRow.racebook_is_live,
    hasOrganizerAccess: Boolean(organizerMembership),
    hasAidStations: aidStations.length > 0,
    hasRelayCourse:
      raceRow.participation_mode === 'relay' || raceRow.participation_mode === 'solo_and_relay',
    eventOrganizerDetails: eventRelation?.organizer_details,
    raceOrganizerDetails: raceRow.organizer_details,
  });

  const participationMode =
    raceRow.participation_mode === 'solo' ||
    raceRow.participation_mode === 'relay' ||
    raceRow.participation_mode === 'solo_and_relay'
      ? raceRow.participation_mode
      : null;
  const relayPoints = Array.isArray(relayPointRows)
    ? relayPointRows
        .map((row) => ({
          id: String(row.id),
          raceAidStationId: readText(row.race_aid_station_id),
          name: readText(row.name) ?? '',
          km: readNumber(row.km) ?? 0,
          handoverTime: readText(row.handover_time),
          cutoffTime: readText(row.cutoff_time),
          notes: readText(row.notes),
          orderIndex: readNumber(row.order_index) ?? 0,
        }))
        .filter((row) => row.name.length > 0 && row.km > 0 && row.km < Number(raceRow.distance_km))
        .sort((left, right) => left.orderIndex - right.orderIndex || left.km - right.km)
    : [];

  return {
    race: {
      id: String(raceRow.id),
      name: readText(raceRow.name) ?? '',
      distanceKm: readNumber(raceRow.distance_km) ?? 0,
      elevationGainM: readNumber(raceRow.elevation_gain_m) ?? 0,
      elevationLossM: readNumber(raceRow.elevation_loss_m),
      raceDate: readText(raceRow.race_date),
      isLive: raceRow.is_live === true,
      thumbnailUrl: readText(raceRow.thumbnail_url),
      location: readText(raceRow.location_text),
      participationMode,
      organizerDetails: raceDetails,
    },
    event: {
      id: readText(eventRelation?.id),
      name: readText(eventRelation?.name),
      location: readText(eventRelation?.location),
      raceDate: readText(eventRelation?.race_date),
      thumbnailUrl: readText(eventRelation?.thumbnail_url),
      isLive: eventRelation?.is_live === true,
      organizerDetails: eventDetails,
    },
    runnerDetails,
    aidStations,
    relayPoints,
    canOpen,
  };
}
