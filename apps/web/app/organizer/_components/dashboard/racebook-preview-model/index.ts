import { resolveRacebookTheme } from "@pace-yourself/design-system";

import type {
  RacebookAidStation,
  RacebookEditionService,
  RacebookModuleStatus,
  RacebookModuleVisibility,
  RacebookPresentationData,
  RacebookRelayPoint,
  RacebookSponsor,
  RacebookViewModel,
} from "@pace-yourself/racebook-ui";

type NullableText = string | null | undefined;
type PartialLocation = { label?: NullableText; lat?: number | null; lng?: number | null; googleMapsUrl?: NullableText };

/** Explicit draft boundary: this is intentionally serializable and contains no API clients or server state. */
export type OrganizerRacebookPreviewInput = {
  event?: {
    id?: string | null; name?: NullableText; location?: NullableText; raceDate?: NullableText; endDate?: NullableText; thumbnailUrl?: NullableText;
    organizerDetails?: Record<string, unknown> | null;
  } | null;
  format?: {
    id?: string | null; name?: NullableText; distanceKm?: number | null; elevationGainM?: number | null; elevationLossM?: number | null;
    raceDate?: NullableText; thumbnailUrl?: NullableText; locationText?: NullableText;
    participationMode?: "solo" | "relay" | "solo_and_relay" | "" | null;
    organizerDetails?: Record<string, unknown> | null;
  } | null;
  gpx?: {
    stats?: { distanceKm?: number | null; gainM?: number | null; lossM?: number | null } | null;
    elevationProfile?: Array<{ distanceKm?: number | null; elevationM?: number | null; lat?: number; lon?: number }> | null;
  } | null;
  aidStations?: Array<Record<string, unknown>> | null;
  stationProducts?: Array<Record<string, unknown>> | null;
  relayPoints?: Array<Record<string, unknown>> | null;
  startWaves?: Array<Record<string, unknown>> | null;
  awards?: Array<Record<string, unknown>> | null;
  services?: Array<Record<string, unknown>> | null;
  sponsors?: Array<Record<string, unknown>> | null;
  branding?: { logoUrl?: NullableText; primaryColor?: NullableText; accentColor?: NullableText } | null;
  /** true means the organizer selected the module. A draft-only selection remains visible in preview. */
  modules?: Partial<Record<keyof RacebookModuleVisibility, boolean>> | null;
  moduleStatus?: Partial<RacebookModuleStatus> | null;
};

const moduleKeys = ["equipment", "bibPickup", "access", "services", "branding", "sponsors", "aidStations", "startWaves", "awards", "relay", "officialProducts"] as const;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const bool = (value: unknown, fallback = false) => typeof value === "boolean" ? value : fallback;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown, fallback: string) => text(value) ?? fallback;
const time = (value: unknown) => {
  const candidate = text(value);
  return candidate && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : null;
};
const index = (value: unknown, fallback: number) => number(value) ?? fallback;

const location = (value: unknown): { label: string | null; lat: number | null; lng: number | null; googleMapsUrl: string | null } => {
  const source = object(value);
  return { label: text(source.label), lat: number(source.lat), lng: number(source.lng), googleMapsUrl: text(source.googleMapsUrl) };
};

const emptyModules = (): RacebookModuleVisibility => ({
  equipment: true, bibPickup: true, access: true, services: false, branding: false, sponsors: false,
  aidStations: true, startWaves: false, awards: false, relay: false, officialProducts: false,
});

const moduleState = (input: OrganizerRacebookPreviewInput): { modules: RacebookModuleVisibility; moduleStatus: RacebookModuleStatus } => {
  const defaults = emptyModules();
  const modules = { ...defaults };
  const status = {} as RacebookModuleStatus;
  for (const key of moduleKeys) {
    if (typeof input.modules?.[key] === "boolean") modules[key] = input.modules[key]!;
    status[key] = input.moduleStatus?.[key] ?? (modules[key] ? "active" : "inactive");
  }
  return { modules, moduleStatus: status };
};

function mapAidStations(input: OrganizerRacebookPreviewInput): RacebookAidStation[] {
  const productsByStation = new Map<string, Array<{ id: string; label: string; notes: string | null; orderIndex: number }>>();
  for (const [position, raw] of (input.stationProducts ?? []).entries()) {
    const row = object(raw);
    const stationId = text(row.aidStationId ?? row.aid_station_id);
    const product = object(row.product);
    const label = text(row.label) ?? text(product.name) ?? text(product.label);
    if (!stationId || !label) continue;
    const products = productsByStation.get(stationId) ?? [];
    products.push({ id: id(row.id, `draft-product-${position}`), label, notes: text(row.notes), orderIndex: index(row.orderIndex ?? row.order_index, position) });
    productsByStation.set(stationId, products);
  }
  return (input.aidStations ?? []).map((raw, position) => {
    const row = object(raw);
    const details = object(row.organizerDetails ?? row.organizer_details);
    const stationId = id(row.id, `draft-station-${position}`);
    return {
      id: stationId,
      name: text(row.name) ?? "—",
      km: number(row.distanceKm ?? row.km) ?? 0,
      waterAvailable: bool(row.waterRefill ?? row.water_available),
      solidAvailable: bool(row.solidRefill ?? row.solid_available),
      assistanceAllowed: bool(row.assistanceAllowed ?? row.assistance_allowed),
      notes: text(row.notes), orderIndex: index(row.orderIndex ?? row.order_index, position),
      organizerDetails: {
        cumulativeElevationGainM: number(details.cumulativeElevationGainM ?? details.cumulative_elevation_gain_m),
        cumulativeElevationLossM: number(details.cumulativeElevationLossM ?? details.cumulative_elevation_loss_m),
        altitudeM: number(details.altitudeM ?? details.altitude_m), cutoffTime: time(details.cutoffTime ?? details.cutoff_time),
        dropBagAvailable: bool(details.dropBagAvailable ?? details.drop_bag_available), organizerNote: text(details.organizerNote ?? details.organizer_note),
      },
      products: (productsByStation.get(stationId) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
    };
  }).sort((a, b) => a.orderIndex - b.orderIndex || a.km - b.km);
}

const mapRelay = (rows: Array<Record<string, unknown>> | null | undefined): RacebookRelayPoint[] => (rows ?? []).map((raw, position) => {
  const row = object(raw);
  return { id: id(row.id, `draft-relay-${position}`), raceAidStationId: text(row.raceAidStationId ?? row.race_aid_station_id), name: text(row.name) ?? "—", km: number(row.distanceKm ?? row.km) ?? 0, handoverTime: time(row.handoverTime ?? row.handover_time), cutoffTime: time(row.cutoffTime ?? row.cutoff_time), notes: text(row.notes), orderIndex: index(row.orderIndex ?? row.order_index, position) };
}).sort((a, b) => a.orderIndex - b.orderIndex || a.km - b.km);

const mapSponsors = (rows: Array<Record<string, unknown>> | null | undefined): RacebookSponsor[] => (rows ?? []).map((raw, position) => {
  const row = object(raw);
  const logoUrl = text(row.logoUrl ?? row.logo_url);
  if (!logoUrl || !bool(row.isActive ?? row.is_active, true)) return null;
  return { id: id(row.id, `draft-sponsor-${position}`), name: text(row.name) ?? "—", logoUrl, websiteUrl: text(row.websiteUrl ?? row.website_url), showOnLoading: bool(row.showOnLoading ?? row.show_on_loading, true), showInBanner: bool(row.showInBanner ?? row.show_in_banner, true), position: index(row.position, position) };
}).filter((row): row is RacebookSponsor => row !== null).sort((a, b) => a.position - b.position);

/** Builds a local-only model. It deliberately never fetches or mutates organizer data. */
export function buildOrganizerRacebookPreviewModel(input: OrganizerRacebookPreviewInput): RacebookViewModel {
  const event = input.event ?? {};
  const format = input.format ?? {};
  const eventDetails = object(event.organizerDetails);
  const formatDetails = object(format.organizerDetails);
  const eventEquipment = object(eventDetails.mandatoryEquipment);
  const formatEquipment = object(formatDetails.mandatoryEquipment);
  const equipmentDetails = bool(formatEquipment.overrideEnabled) ? formatEquipment : eventEquipment;
  const eventBib = object(eventDetails.bibPickup);
  const formatBib = object(formatDetails.bibPickup);
  const bib = bool(formatBib.overrideEnabled) ? formatBib : eventBib;
  const eventAccess = object(eventDetails.access);
  const formatAccess = object(formatDetails.access);
  const access = bool(formatAccess.overrideEnabled) ? formatAccess : eventAccess;
  const schedule = object(formatDetails.schedule);
  const runnerInfo = object(formatDetails.runnerInfo);
  const raceLocation = location(formatDetails.raceLocation);
  const data: RacebookPresentationData = {
    race: {
      id: text(format.id) ?? "draft-race", name: text(format.name) ?? "—", distanceKm: number(format.distanceKm) ?? number(input.gpx?.stats?.distanceKm) ?? 0,
      elevationGainM: number(format.elevationGainM) ?? number(input.gpx?.stats?.gainM) ?? 0, elevationLossM: number(format.elevationLossM) ?? number(input.gpx?.stats?.lossM),
      raceDate: text(format.raceDate), thumbnailUrl: text(format.thumbnailUrl), location: text(format.locationText), startLatitude: raceLocation.lat, startLongitude: raceLocation.lng, participationMode: format.participationMode || null,
      locationDetails: raceLocation, schedule: { startTime: time(schedule.startTime), finishCutoffTime: time(schedule.finishCutoffTime), cutoffNote: text(schedule.cutoffNote), note: text(schedule.note) },
      runnerInfo: { startArea: text(runnerInfo.startArea), briefing: text(runnerInfo.briefing), rules: text(runnerInfo.rules), note: text(runnerInfo.note) },
    },
    event: {
      id: text(event.id), name: text(event.name), location: text(event.location), raceDate: text(event.raceDate), endDate: text(event.endDate), thumbnailUrl: text(event.thumbnailUrl),
      locationDetails: location(eventDetails.eventLocation),
      officialWebsiteUrl: text(eventDetails.officialWebsiteUrl), instagramUrl: text(eventDetails.instagramUrl), facebookUrl: text(eventDetails.facebookUrl),
      emergencyContact: { name: text(object(eventDetails.emergencyContact).name), phone: text(object(eventDetails.emergencyContact).phone) },
    },
    equipment: {
      weatherPlan: equipmentDetails.weatherPlan === "cold" || equipmentDetails.weatherPlan === "heat" ? equipmentDetails.weatherPlan : "normal",
      items: (Array.isArray(equipmentDetails.items) ? equipmentDetails.items : []).map((raw, position) => {
        const item = object(raw); const cold = bool(item.cold); const heat = bool(item.heat); const weatherPlan = equipmentDetails.weatherPlan;
        return { id: id(item.id, `draft-equipment-${position}`), label: text(item.label) ?? "—", required: bool(item.required, true), cold, heat, note: text(item.note), active: !cold && !heat || weatherPlan === "cold" && cold || weatherPlan === "heat" && heat };
      }), note: text(equipmentDetails.note),
    },
    bibPickup: {
      locations: (Array.isArray(bib.locations) ? bib.locations : []).map((raw) => { const item = object(raw); return { location: text(item.location), locationDetails: location(item.locationDetails), slots: (Array.isArray(item.slots) ? item.slots : []).map((slot) => { const value = object(slot); return { date: text(value.date), startTime: time(value.startTime), endTime: time(value.endTime) }; }) }; }),
      schedule: text(bib.schedule), requiredDocuments: text(bib.requiredDocuments), thirdPartyPickupAllowed: typeof bib.thirdPartyPickupAllowed === "boolean" ? bib.thirdPartyPickupAllowed : null, equipmentCheck: typeof bib.equipmentCheck === "boolean" ? bib.equipmentCheck : null, note: text(bib.note),
    },
    access: {
      startAddress: text(access.startAddress), startLocation: location(access.startLocation), finishAddress: text(access.finishAddress), finishLocation: location(access.finishLocation), officialParkings: text(access.officialParkings), shuttles: text(access.shuttles), shuttleSchedule: text(access.shuttleSchedule) ?? text(schedule.shuttleSchedule), roadRestrictions: text(access.roadRestrictions), mapUrl: text(access.mapUrl), note: text(access.note),
      enabledSections: { officialParkings: bool(object(access.enabledSections).officialParkings, true), shuttles: bool(object(access.enabledSections).shuttles, true), roadRestrictions: bool(object(access.enabledSections).roadRestrictions, true), mapUrl: bool(object(access.enabledSections).mapUrl, true), runnerInfo: bool(object(access.enabledSections).runnerInfo, true) },
    },
    legacyServices: Object.fromEntries(["supporters", "accommodations", "restaurants", "recovery", "partners", "lastMinuteMessage", "note"].map((key) => [key, text(object(eventDetails.services)[key])])) as RacebookPresentationData["legacyServices"],
    aidStations: mapAidStations(input), relayPoints: mapRelay(input.relayPoints),
    startWaves: (input.startWaves ?? []).map((raw, position) => { const row = object(raw); return { id: id(row.id, `draft-wave-${position}`), name: text(row.name) ?? "—", startTime: time(row.startTime) ?? "—", eligibilityType: ["all", "bib_range", "estimated_finish_time", "pace", "custom"].includes(String(row.eligibilityType)) ? row.eligibilityType as "all" : "all", bibNumberMin: number(row.bibNumberMin), bibNumberMax: number(row.bibNumberMax), finishMinutesMin: number(row.finishMinutesMin), finishMinutesMax: number(row.finishMinutesMax), paceSecondsMin: number(row.paceSecondsMin), paceSecondsMax: number(row.paceSecondsMax), eligibilityNote: text(row.eligibilityNote), orderIndex: index(row.orderIndex, position) }; }).sort((a, b) => a.orderIndex - b.orderIndex),
    awards: (input.awards ?? []).map((raw, position) => { const row = object(raw); const audience: "women" | "men" | "mixed" = row.audience === "women" || row.audience === "men" ? row.audience : "mixed"; return { id: id(row.id, `draft-award-${position}`), categoryKey: text(row.categoryKey) ?? "custom", categoryLabel: text(row.categoryLabel) ?? "—", audience, placeFrom: number(row.placeFrom) ?? 1, placeTo: number(row.placeTo) ?? 1, podiumTime: time(row.podiumTime) ?? "—", podiumLocation: text(row.podiumLocation), rewardNote: text(row.rewardNote), orderIndex: index(row.orderIndex, position) }; }).sort((a, b) => a.orderIndex - b.orderIndex),
    editionServices: (input.services ?? []).map((raw, position): RacebookEditionService | null => { const row = object(raw); const serviceType = ["restaurant", "accommodation", "recovery", "other"].includes(String(row.serviceType)) ? row.serviceType as RacebookEditionService["serviceType"] : "other"; const name = text(row.name); if (!name) return null; return { id: id(row.id, `draft-service-${position}`), serviceType, name, description: text(row.description), address: text(row.address), latitude: number(row.latitude), longitude: number(row.longitude), googleMapsUrl: text(row.googleMapsUrl), websiteUrl: text(row.websiteUrl), phone: text(row.phone), orderIndex: index(row.orderIndex, position) }; }).filter((row): row is RacebookEditionService => row !== null).sort((a, b) => a.orderIndex - b.orderIndex),
  };
  const { modules, moduleStatus } = moduleState(input);
  const sponsorRows = mapSponsors(input.sponsors);
  const theme = resolveRacebookTheme({ logoUrl: text(input.branding?.logoUrl), primaryColor: text(input.branding?.primaryColor) ?? undefined, accentColor: text(input.branding?.accentColor) ?? undefined });
  return {
    data, branding: theme, modules, moduleStatus,
    sponsors: { loading: sponsorRows.filter((sponsor) => sponsor.showOnLoading), banner: sponsorRows.filter((sponsor) => sponsor.showInBanner) },
    route: { elevationProfile: (input.gpx?.elevationProfile ?? []).flatMap((point) => { const distanceKm = number(point.distanceKm); const elevationM = number(point.elevationM); return distanceKm === null || elevationM === null ? [] : [{ distanceKm, elevationM, ...(typeof point.lat === "number" ? { lat: point.lat } : {}), ...(typeof point.lon === "number" ? { lon: point.lon } : {}) }]; }), previewPoints: (input.gpx?.elevationProfile ?? []).flatMap((point) => typeof point.lat === "number" && typeof point.lon === "number" ? [{ latitude: point.lat, longitude: point.lon }] : []), distanceKm: number(input.gpx?.stats?.distanceKm) ?? number(format.distanceKm), gainM: number(input.gpx?.stats?.gainM) ?? number(format.elevationGainM), lossM: number(input.gpx?.stats?.lossM) ?? number(format.elevationLossM) },
  };
}
