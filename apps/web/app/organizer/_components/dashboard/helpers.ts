import {
  expandRaceEquipmentWithCommon,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  hasRaceEquipmentOverride,
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
  EditionRequestRow,
  EventFormValues,
  GpxPreview,
  OrganizerEventDetail,
  RaceEventEdition,
  RaceFormat,
  RaceFormValues,
  StationProduct,
} from "./types";

export type RaceSeriesGroup = {
  id: string;
  seriesName: string;
  races: RaceFormat[];
};

export type EditionYearOption = {
  value: string;
  label: string;
  disabled: boolean;
};

export const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const getModuleForTab = (tabId: string, currentModule: OrganizerModuleId): OrganizerModuleId => {
  if (tabId === ADD_FORMAT_TAB_ID) return "formats";
  const targetModules = tabId === EVENT_TAB_ID ? EVENT_MODULE_IDS : FORMAT_MODULE_IDS;
  if (targetModules.includes(currentModule)) return currentModule;
  return tabId === EVENT_TAB_ID ? "event" : "formats";
};

export const RACE_DETAILS_MODULE_IDS: OrganizerModuleId[] = ["formats", "equipment", "bibPickup", "access"];

export const buildOrganizerFormatSavePlan = (dirtyModules: ReadonlySet<OrganizerModuleId>) => {
  const saveAidStations = dirtyModules.has("aidStations");
  const saveRaceDetails = saveAidStations || RACE_DETAILS_MODULE_IDS.some((moduleId) => dirtyModules.has(moduleId));

  return { saveRaceDetails, saveAidStations };
};

export const getOrganizerDirtyScopeKey = (eventId: string | null, activeTab: string, activeRaceId: string | null) => {
  if (!eventId) return null;
  if (activeTab === EVENT_TAB_ID) return `event:${eventId}`;
  return activeRaceId ? `race:${activeRaceId}` : null;
};

export const isOrganizerScopeSavePending = (dirtyCount: number, currentRevision: number, pendingRevision?: number) =>
  dirtyCount > 0 && pendingRevision === currentRevision;

export const shouldSaveActiveRaceBeforeRacebookChange = (
  activeRaceId: string | null | undefined,
  requestedRaceId: string
) => activeRaceId === requestedRaceId;

export const createEmptyEventForm = (): EventFormValues => ({
  name: "",
  location: "",
  editionStartDate: "",
  editionEndDate: "",
  thumbnailUrl: "",
  isLive: false,
  organizerDetails: cloneJson(defaultOrganizerEventDetails),
});

export const createEmptyRaceForm = (): RaceFormValues => ({
  seriesName: "",
  name: "",
  distanceKm: 0,
  elevationGainM: 0,
  elevationLossM: "",
  externalSiteUrl: "",
  locationText: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: false,
  participationMode: "solo",
  organizerDetails: cloneJson(defaultOrganizerRaceDetails),
});

export const createRaceFormFromEventDefaults = (eventForm: EventFormValues): RaceFormValues => ({
  ...createEmptyRaceForm(),
  seriesName: "",
  raceDate: eventForm.editionStartDate,
  thumbnailUrl: eventForm.thumbnailUrl,
  organizerDetails: {
    ...cloneJson(defaultOrganizerRaceDetails),
    mandatoryEquipment: cloneJson(defaultOrganizerRaceDetails.mandatoryEquipment),
    access: cloneJson(eventForm.organizerDetails.access),
  },
});

export const createRaceFormFromFormatDefaults = (race: RaceFormat, raceForm: RaceFormValues): RaceFormValues => ({
  ...createEmptyRaceForm(),
  seriesName: raceForm.seriesName || race.series_name || "",
  externalSiteUrl: raceForm.externalSiteUrl || race.external_site_url || "",
  locationText: raceForm.locationText || race.location_text || "",
  raceDate: raceForm.raceDate || formatDate(race.race_date),
  thumbnailUrl: raceForm.thumbnailUrl || race.thumbnail_url || "",
  participationMode: raceForm.participationMode || race.participation_mode || "solo",
  organizerDetails: cloneJson(raceForm.organizerDetails ?? race.organizerDetails ?? defaultOrganizerRaceDetails),
});

export const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

export const getRaceEditionYearLabel = (value?: string | null) => {
  const date = formatDate(value);
  return date ? date.slice(0, 4) : "Sans date";
};

export const getRaceEditionYearValue = (value?: string | null) => {
  const date = formatDate(value);
  return date ? date.slice(0, 4) : "";
};

export const getRaceEditionYear = (race?: RaceFormat | null, editions: RaceEventEdition[] = []) =>
  race?.edition_id
    ? String(editions.find((edition) => edition.id === race.edition_id)?.edition_year ?? getRaceEditionYearValue(race.race_date))
    : getRaceEditionYearValue(race?.race_date);

const compareRaceEditions = (left: RaceFormat, right: RaceFormat) => {
  const leftDate = formatDate(left.race_date);
  const rightDate = formatDate(right.race_date);
  if (leftDate && rightDate && leftDate !== rightDate) return rightDate.localeCompare(leftDate);
  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;
  return left.id.localeCompare(right.id);
};

export const groupRacesBySeries = (races: RaceFormat[]): RaceSeriesGroup[] => {
  const groups = new Map<string, RaceSeriesGroup>();

  races.forEach((race) => {
    const groupId = race.edition_group_id;
    const existing = groups.get(groupId);
    if (existing) {
      existing.races.push(race);
      if (!existing.seriesName && race.series_name) existing.seriesName = race.series_name;
      return;
    }

    groups.set(groupId, {
      id: groupId,
      seriesName: race.series_name || race.name,
      races: [race],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      races: [...group.races].sort(compareRaceEditions),
    }))
    .sort((left, right) => left.seriesName.localeCompare(right.seriesName, "fr", { sensitivity: "base" }));
};

export const getDefaultEditionRaceId = (races: RaceFormat[], editionGroupId: string) =>
  groupRacesBySeries(races).find((group) => group.id === editionGroupId)?.races[0]?.id ?? null;

export const getAvailableEditionYears = (races: RaceFormat[], editions: RaceEventEdition[] = []) =>
  Array.from(
    new Set([
      ...editions.map((edition) => String(edition.edition_year)),
      ...races.map((race) => getRaceEditionYear(race, editions)).filter(Boolean),
    ])
  ).sort((left, right) => right.localeCompare(left));

export const buildEditionYearOptions = (
  races: RaceFormat[],
  editions: RaceEventEdition[],
  editionRequests: EditionRequestRow[],
  eventId: string | null
): EditionYearOption[] => {
  const raceYears = getAvailableEditionYears(races, editions);
  const pendingYears = Array.from(
    new Set(
      editionRequests
        .filter((request) => request.event_id === eventId && request.status === "pending")
        .map((request) => request.requested_start_date.slice(0, 4))
        .filter(Boolean)
    )
  );

  const years = Array.from(new Set([...raceYears, ...pendingYears])).sort((left, right) => right.localeCompare(left));
  return years.map((year) => ({
    value: year,
    label: pendingYears.includes(year) && !raceYears.includes(year) ? `${year} (en attente de validation)` : year,
    disabled: pendingYears.includes(year) && !raceYears.includes(year),
  }));
};

export const getEventEdition = (event: Pick<OrganizerEventDetail, "editions"> | null | undefined, editionYear?: string | null) => {
  const editions = event?.editions ?? [];
  return editions.find((edition) => String(edition.edition_year) === editionYear)
    ?? editions.find((edition) => edition.is_current)
    ?? editions[0]
    ?? null;
};

export const formatEventDateRange = (
  event?: Pick<OrganizerEventDetail, "race_date" | "organizerDetails" | "editions"> | null,
  editionYear?: string | null
) => {
  const edition = getEventEdition(event, editionYear);
  const startDate = formatDate(edition?.start_date ?? event?.race_date);
  const endDate = formatDate(edition?.end_date ?? event?.organizerDetails?.dateRange.endDate);
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
  raceForm: RaceFormValues,
  selectedEditionYear: string
): OrganizerEventDetail | null =>
  eventDetail
    ? {
        ...eventDetail,
        name: eventForm.name,
        location: eventForm.location,
        race_date: eventForm.editionStartDate,
        thumbnail_url: eventForm.thumbnailUrl,
        is_live: eventForm.isLive,
        organizerDetails: {
          ...eventForm.organizerDetails,
          dateRange: { ...eventForm.organizerDetails.dateRange, endDate: eventForm.editionEndDate || null },
        },
        editions: (eventDetail.editions ?? []).map((edition) =>
          String(edition.edition_year) === selectedEditionYear
            ? { ...edition, start_date: eventForm.editionStartDate, end_date: eventForm.editionEndDate }
            : edition
        ),
        races: eventDetail.races.map((race) =>
          race.id === activeRace?.id
            ? {
                ...race,
                series_name: raceForm.seriesName,
                name: raceForm.name,
                distance_km: raceForm.distanceKm,
                elevation_gain_m: raceForm.elevationGainM,
                elevation_loss_m: toNumberOrNull(raceForm.elevationLossM),
                external_site_url: raceForm.externalSiteUrl || race.external_site_url || null,
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
  const sortedRaces = groupRacesBySeries(event.races).flatMap((group) => group.races);
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
          mandatoryEquipment: {
            ...expandRaceEquipmentWithCommon(organizerDetails.mandatoryEquipment, raceDetails.mandatoryEquipment),
            overrideEnabled: hasRaceEquipmentOverride(organizerDetails.mandatoryEquipment, raceDetails.mandatoryEquipment),
          },
        },
      };
    }),
  };
};

export const eventToForm = (event: OrganizerEventDetail, edition?: RaceEventEdition | null): EventFormValues => ({
  name: event.name,
  location: event.location ?? "",
  editionStartDate: formatDate(edition?.start_date ?? event.race_date),
  editionEndDate: formatDate(edition?.end_date ?? event.organizerDetails?.dateRange.endDate),
  thumbnailUrl: event.thumbnail_url ?? "",
  isLive: event.is_live !== false,
  organizerDetails: cloneJson(event.organizerDetails ?? defaultOrganizerEventDetails),
});

export const raceToForm = (race: RaceFormat): RaceFormValues => ({
  seriesName: race.series_name ?? "",
  name: race.name,
  distanceKm: race.distance_km,
  elevationGainM: race.elevation_gain_m,
  elevationLossM: race.elevation_loss_m?.toString() ?? "",
  externalSiteUrl: race.external_site_url ?? "",
  locationText: race.location_text ?? "",
  raceDate: formatDate(race.race_date),
  thumbnailUrl: race.thumbnail_url ?? "",
  isLive: race.is_live,
  participationMode: race.participation_mode ?? "",
  organizerDetails: cloneJson(race.organizerDetails ?? defaultOrganizerRaceDetails),
});

export const applyGpxStatsToRaceForm = (
  form: RaceFormValues,
  stats: GpxPreview["stats"]
): RaceFormValues =>
  stats
    ? {
        ...form,
        distanceKm: stats.distanceKm,
        elevationGainM: stats.gainM,
        elevationLossM: stats.lossM.toString(),
      }
    : form;

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
  sortAidStationsByDistance(
    rows.map((station) => ({
      id: station.id,
      name: station.name,
      distanceKm: station.km,
      waterRefill: station.water_available !== false,
      solidRefill: station.solid_available !== false,
      assistanceAllowed: station.assistance_allowed !== false,
      notes: station.notes ?? "",
      organizerDetails: parseOrganizerAidStationDetails(station.organizerDetails),
    }))
  );

export const sortAidStationsByDistance = (stations: AidStationDraft[]): AidStationDraft[] =>
  stations
    .map((station, index) => ({ station, index }))
    .sort((left, right) => {
      const distanceDelta = left.station.distanceKm - right.station.distanceKm;
      if (distanceDelta !== 0) return distanceDelta;
      return left.index - right.index;
    })
    .map(({ station }) => station);

export const normalizeGpxPreview = (data: GpxPreview | null): GpxPreview | null =>
  data
    ? {
        stats: data.stats,
        elevationProfile: data.elevationProfile ?? [],
        detectedAidStations: data.detectedAidStations ?? [],
      }
    : null;

const roundInterpolatedMeters = (value: number) => Math.max(0, Math.round(value));

export const getGpxElevationTotalsAtDistance = (preview: GpxPreview | null, distanceKm: number) => {
  const profile = preview?.elevationProfile ?? [];
  if (profile.length === 0) return null;

  const safeDistanceKm = Math.max(0, distanceKm);
  const firstPoint = profile[0];
  const lastPoint = profile.at(-1) ?? firstPoint;
  if (!firstPoint || !lastPoint) return null;

  if (safeDistanceKm <= firstPoint.distanceKm) {
    return {
      cumulativeElevationGainM: roundInterpolatedMeters(firstPoint.cumulativeGainM ?? 0),
      cumulativeElevationLossM: roundInterpolatedMeters(firstPoint.cumulativeLossM ?? 0),
    };
  }

  if (safeDistanceKm >= lastPoint.distanceKm) {
    return {
      cumulativeElevationGainM: roundInterpolatedMeters(lastPoint.cumulativeGainM ?? 0),
      cumulativeElevationLossM: roundInterpolatedMeters(lastPoint.cumulativeLossM ?? 0),
    };
  }

  for (let index = 1; index < profile.length; index += 1) {
    const previousPoint = profile[index - 1];
    const nextPoint = profile[index];
    if (safeDistanceKm > nextPoint.distanceKm) continue;

    const spanKm = nextPoint.distanceKm - previousPoint.distanceKm;
    const ratio = spanKm > 0 ? (safeDistanceKm - previousPoint.distanceKm) / spanKm : 0;
    const gainStart = previousPoint.cumulativeGainM ?? 0;
    const gainEnd = nextPoint.cumulativeGainM ?? gainStart;
    const lossStart = previousPoint.cumulativeLossM ?? 0;
    const lossEnd = nextPoint.cumulativeLossM ?? lossStart;

    return {
      cumulativeElevationGainM: roundInterpolatedMeters(gainStart + (gainEnd - gainStart) * ratio),
      cumulativeElevationLossM: roundInterpolatedMeters(lossStart + (lossEnd - lossStart) * ratio),
    };
  }

  return {
    cumulativeElevationGainM: roundInterpolatedMeters(lastPoint.cumulativeGainM ?? 0),
    cumulativeElevationLossM: roundInterpolatedMeters(lastPoint.cumulativeLossM ?? 0),
  };
};

export const syncAidStationWithGpxPreview = (station: AidStationDraft, preview: GpxPreview | null): AidStationDraft => {
  const totals = getGpxElevationTotalsAtDistance(preview, station.distanceKm);
  if (!totals) return station;

  const currentDetails = station.organizerDetails;
  if (
    currentDetails.cumulativeElevationGainM === totals.cumulativeElevationGainM &&
    currentDetails.cumulativeElevationLossM === totals.cumulativeElevationLossM
  ) {
    return station;
  }

  return {
    ...station,
    organizerDetails: {
      ...currentDetails,
      cumulativeElevationGainM: totals.cumulativeElevationGainM,
      cumulativeElevationLossM: totals.cumulativeElevationLossM,
    },
  };
};

export const syncAidStationsWithGpxPreview = (stations: AidStationDraft[], preview: GpxPreview | null): AidStationDraft[] => {
  if (!preview?.elevationProfile?.length) return stations;

  let changed = false;
  const nextStations = stations.map((station) => {
    const nextStation = syncAidStationWithGpxPreview(station, preview);
    if (nextStation !== station) changed = true;
    return nextStation;
  });

  return changed ? nextStations : stations;
};

export function getModuleTitle(moduleId: OrganizerModuleId) {
  const titles: Record<OrganizerModuleId, string> = {
    event: "Informations",
    formats: "Formats & GPX",
    aidStations: "Ravito / relais",
    equipment: "Matériel",
    bibPickup: "Dossard",
    access: "Accès",
    products: "Produits",
    services: "Services",
    sponsors: "Sponsors",
  };
  return titles[moduleId];
}

export function getModuleDescription(moduleId: OrganizerModuleId) {
  const descriptions: Record<OrganizerModuleId, string> = {
    event: "Les informations principales qui cadrent l'événement.",
    formats: "Les formats restent en onglets, avec résumé et actions rapides.",
    aidStations: "Départ, arrivée, ravitos et relais dans une même vue.",
    equipment: "Le matériel partagé se gère depuis l'événement, puis chaque course peut l'ajuster.",
    bibPickup: "Retrait dossard commun à tous les formats.",
    access: "Accès et sections optionnelles selon l'onglet actif.",
    products: "Produits officiels disponibles par ravito.",
    services: "Informations optionnelles utiles aux coureurs.",
    sponsors: "Logos et liens visibles pendant le chargement et dans le bandeau du RaceBook.",
  };
  return descriptions[moduleId];
}
