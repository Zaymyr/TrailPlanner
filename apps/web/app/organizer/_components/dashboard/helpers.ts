import {
  expandRaceEquipmentWithCommon,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  parseOrganizerAidStationDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
  type OrganizerAidStationDetails,
} from "../../../../lib/organizer-dashboard-details";
import type { FuelProduct } from "../../../../lib/product-types";
import type { OrganizerModuleId } from "../completion";
import { ADD_FORMAT_TAB_ID, EVENT_MODULE_IDS, EVENT_TAB_ID, FORMAT_MODULE_IDS } from "./constants";
import type {
  AidStationDraft,
  EventFormValues,
  GpxPreview,
  OrganizerEventDetail,
  RaceFormat,
  RaceFormValues,
  StationProduct,
} from "./types";

export const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const getModuleForTab = (tabId: string, currentModule: OrganizerModuleId): OrganizerModuleId => {
  if (tabId === ADD_FORMAT_TAB_ID) return "formats";
  const targetModules = tabId === EVENT_TAB_ID ? EVENT_MODULE_IDS : FORMAT_MODULE_IDS;
  if (targetModules.includes(currentModule)) return currentModule;
  return tabId === EVENT_TAB_ID ? "event" : "formats";
};

export const createEmptyEventForm = (): EventFormValues => ({
  name: "",
  location: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
  organizerDetails: cloneJson(defaultOrganizerEventDetails),
});

export const createEmptyRaceForm = (): RaceFormValues => ({
  name: "",
  distanceKm: 0,
  elevationGainM: 0,
  elevationLossM: "",
  locationText: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
  organizerDetails: cloneJson(defaultOrganizerRaceDetails),
});

export const createRaceFormFromEventDefaults = (eventForm: EventFormValues): RaceFormValues => ({
  ...createEmptyRaceForm(),
  locationText: eventForm.location,
  raceDate: eventForm.raceDate,
  thumbnailUrl: eventForm.thumbnailUrl,
  organizerDetails: {
    ...cloneJson(defaultOrganizerRaceDetails),
    mandatoryEquipment: cloneJson(eventForm.organizerDetails.mandatoryEquipment),
    access: cloneJson(eventForm.organizerDetails.access),
  },
});

export const createRaceFormFromFormatDefaults = (race: RaceFormat, raceForm: RaceFormValues): RaceFormValues => ({
  ...createEmptyRaceForm(),
  locationText: raceForm.locationText || race.location_text || "",
  raceDate: raceForm.raceDate || formatDate(race.race_date),
  thumbnailUrl: raceForm.thumbnailUrl || race.thumbnail_url || "",
  organizerDetails: cloneJson(raceForm.organizerDetails ?? race.organizerDetails ?? defaultOrganizerRaceDetails),
});

export const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

export const formatEventDateRange = (event?: Pick<OrganizerEventDetail, "race_date" | "organizerDetails"> | null) => {
  const startDate = formatDate(event?.race_date);
  const endDate = formatDate(event?.organizerDetails?.dateRange.endDate);
  if (startDate && endDate && startDate !== endDate) return `${startDate} - ${endDate}`;
  return startDate || endDate;
};

export const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatKm = (value: number) => `${Number(value || 0).toFixed(1)} km`;
export const formatProductAmount = (value: number | undefined, unit: string) => `${Number(value ?? 0)} ${unit}`;

export const getProductBrandLabel = (product: FuelProduct) => {
  const brand = product.brand?.trim();
  return brand && brand.length > 0 ? brand : "Sans marque";
};

export const groupProductsByBrand = (products: FuelProduct[]) => {
  const groups = products.reduce((map, product) => {
    const brand = getProductBrandLabel(product);
    const items = map.get(brand) ?? [];
    items.push(product);
    map.set(brand, items);
    return map;
  }, new Map<string, FuelProduct[]>());

  return Array.from(groups.entries())
    .map(([brand, items]) => ({
      brand,
      items: items.sort((left, right) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" })),
    }))
    .sort((left, right) => {
      if (left.brand === "Sans marque") return 1;
      if (right.brand === "Sans marque") return -1;
      return left.brand.localeCompare(right.brand, "fr", { sensitivity: "base" });
    });
};

export const buildProductsById = (catalogProducts: FuelProduct[], stationProducts: StationProduct[]) => {
  const map = new Map<string, FuelProduct>();
  catalogProducts.forEach((product) => map.set(product.id, product));
  stationProducts.forEach((link) => {
    if (link.product) map.set(link.product.id, link.product);
  });
  return map;
};

export const buildEventDraft = (
  eventDetail: OrganizerEventDetail | null,
  eventForm: EventFormValues,
  activeRace: RaceFormat | null,
  raceForm: RaceFormValues
): OrganizerEventDetail | null =>
  eventDetail
    ? {
        ...eventDetail,
        name: eventForm.name,
        location: eventForm.location,
        race_date: eventForm.raceDate,
        thumbnail_url: eventForm.thumbnailUrl,
        is_live: eventForm.isLive,
        organizerDetails: eventForm.organizerDetails,
        races: eventDetail.races.map((race) =>
          race.id === activeRace?.id
            ? {
                ...race,
                name: raceForm.name,
                distance_km: raceForm.distanceKm,
                elevation_gain_m: raceForm.elevationGainM,
                elevation_loss_m: toNumberOrNull(raceForm.elevationLossM),
                location_text: raceForm.locationText,
                race_date: raceForm.raceDate,
                thumbnail_url: raceForm.thumbnailUrl,
                is_live: raceForm.isLive,
                organizerDetails: raceForm.organizerDetails,
              }
            : race
        ),
      }
    : null;

export const normalizeOrganizerEventDetail = (event: OrganizerEventDetail): OrganizerEventDetail => {
  const sortedRaces = [...event.races].sort((left, right) => left.distance_km - right.distance_km);
  const organizerDetails = parseOrganizerEventDetails(event.organizerDetails);
  return {
    ...event,
    organizerDetails,
    races: sortedRaces.map((race) => {
      const raceDetails = parseOrganizerRaceDetails(race.organizerDetails);
      return {
        ...race,
        organizerDetails: {
          ...raceDetails,
          mandatoryEquipment: expandRaceEquipmentWithCommon(organizerDetails.mandatoryEquipment, raceDetails.mandatoryEquipment),
        },
      };
    }),
  };
};

export const eventToForm = (event: OrganizerEventDetail): EventFormValues => ({
  name: event.name,
  location: event.location ?? "",
  raceDate: formatDate(event.race_date),
  thumbnailUrl: event.thumbnail_url ?? "",
  isLive: event.is_live !== false,
  organizerDetails: cloneJson(event.organizerDetails ?? defaultOrganizerEventDetails),
});

export const raceToForm = (race: RaceFormat): RaceFormValues => ({
  name: race.name,
  distanceKm: race.distance_km,
  elevationGainM: race.elevation_gain_m,
  elevationLossM: race.elevation_loss_m?.toString() ?? "",
  locationText: race.location_text ?? "",
  raceDate: formatDate(race.race_date),
  thumbnailUrl: race.thumbnail_url ?? "",
  isLive: race.is_live,
  organizerDetails: cloneJson(race.organizerDetails ?? defaultOrganizerRaceDetails),
});

export type OrganizerAidStationRow = {
  id: string;
  name: string;
  km: number;
  water_available: boolean;
  solid_available?: boolean | null;
  assistance_allowed?: boolean | null;
  notes?: string | null;
  organizerDetails?: OrganizerAidStationDetails;
};

export const aidStationRowsToDrafts = (rows: OrganizerAidStationRow[]): AidStationDraft[] =>
  rows.map((station) => ({
    id: station.id,
    name: station.name,
    distanceKm: station.km,
    waterRefill: station.water_available !== false,
    solidRefill: station.solid_available !== false,
    assistanceAllowed: station.assistance_allowed !== false,
    notes: station.notes ?? "",
    organizerDetails: parseOrganizerAidStationDetails(station.organizerDetails),
  }));

export const normalizeGpxPreview = (data: GpxPreview | null): GpxPreview | null =>
  data
    ? {
        stats: data.stats,
        elevationProfile: data.elevationProfile ?? [],
        detectedAidStations: data.detectedAidStations ?? [],
      }
    : null;

export function getModuleTitle(moduleId: OrganizerModuleId) {
  const titles: Record<OrganizerModuleId, string> = {
    event: "Informations",
    formats: "Formats & GPX",
    aidStations: "Ravitos & points de course",
    equipment: "Matériel",
    bibPickup: "Dossard",
    access: "Accès",
    products: "Produits",
    services: "Services",
    preview: "Prévisualisation coureur",
  };
  return titles[moduleId];
}

export function getModuleDescription(moduleId: OrganizerModuleId) {
  const descriptions: Record<OrganizerModuleId, string> = {
    event: "Les informations principales qui cadrent l'événement.",
    formats: "Les formats restent en onglets, avec résumé et actions rapides.",
    aidStations: "Départ, arrivée et ravitos dans une même vue.",
    equipment: "Le matériel partagé se gère depuis l'événement, puis chaque course peut l'ajuster.",
    bibPickup: "Retrait dossard commun à tous les formats.",
    access: "Accès et sections optionnelles selon l'onglet actif.",
    products: "Produits officiels disponibles par ravito.",
    services: "Informations optionnelles utiles aux coureurs.",
    preview: "Contrôle visuel de la version coureur interne.",
  };
  return descriptions[moduleId];
}
