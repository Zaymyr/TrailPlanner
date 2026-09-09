import type {
  OrganizerAidStationDetails,
  OrganizerEventDetails,
  OrganizerRaceDetails,
} from "../../../lib/organizer-dashboard-details";
import { buildRunnerOrganizerDetails, defaultOrganizerEventDetails, hasRaceAccessOverride } from "../../../lib/organizer-dashboard-details";

export type OrganizerModuleId =
  | "event"
  | "formats"
  | "aidStations"
  | "equipment"
  | "bibPickup"
  | "access"
  | "products"
  | "services"
  | "awards"
  | "branding"
  | "sponsors";

export type OrganizerModuleLevel = "required" | "recommended" | "optional";
export type OrganizerModuleStatus = "empty" | "incomplete" | "complete";

export type CompletionRace = {
  id: string;
  edition_id?: string | null;
  edition_group_id: string;
  series_name: string;
  name: string;
  slug?: string | null;
  location_text?: string | null;
  source_url?: string | null;
  external_site_url?: string | null;
  distance_km: number;
  elevation_gain_m: number | null;
  race_date?: string | null;
  gpx_storage_path?: string | null;
  is_live: boolean;
  data_status?: "draft" | "complete";
  missing_required_fields?: Array<"race_date" | "location" | "distance_km" | "source_url">;
  organizerDetails?: OrganizerRaceDetails;
  aidStationCount?: number;
  startWaveCount?: number;
  awardCount?: number;
};

export type CompletionEvent = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  is_live?: boolean | null;
  organizerDetails?: OrganizerEventDetails;
  editions?: Array<{
    id: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    serviceCount?: number;
    sponsorCount?: number;
    sponsorClicks?: number;
    brandingConfigured?: boolean;
    brandingUnpublished?: boolean;
  }>;
  races: CompletionRace[];
};

export type CompletionAidStation = {
  id?: string;
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  solidRefill: boolean;
  assistanceAllowed: boolean;
  notes?: string | null;
  organizerDetails?: OrganizerAidStationDetails;
};

export type CompletionStationProduct = {
  aidStationId: string;
  productId: string;
};

export type OrganizerModuleSummary = {
  id: OrganizerModuleId;
  title: string;
  description: string;
  level: OrganizerModuleLevel;
  status: OrganizerModuleStatus;
  countLabel: string;
  missingLabels?: string[];
};

export type OrganizerRaceProgress = {
  id: string;
  editionGroupId: string;
  seriesName: string;
  name: string;
  score: number;
};

export type OrganizerCompletionSummary = {
  score: number;
  eventScore: number;
  formatScore: number;
  raceProgress: OrganizerRaceProgress[];
  raceProgressScore: number;
  informationComplete: boolean;
  requiredComplete: boolean;
  modules: OrganizerModuleSummary[];
  eventModules: OrganizerModuleSummary[];
  formatModules: OrganizerModuleSummary[];
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const filledCount = (values: Array<unknown>) =>
  values.filter((value) => {
    if (typeof value === "string") return hasText(value);
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  }).length;

export const isPublishableRace = (race: CompletionRace) =>
  race.is_live &&
  hasText(race.name) &&
  hasText(race.slug) &&
  hasText(race.race_date) &&
  hasText(race.location_text) &&
  hasText(race.source_url ?? race.external_site_url) &&
  Number.isFinite(race.distance_km) &&
  race.distance_km > 0 &&
  (race.data_status ?? "complete") === "complete" &&
  (race.missing_required_fields?.length ?? 0) === 0;

const isRaceIdentityComplete = (race: CompletionRace) =>
  hasText(race.name) &&
  hasText(race.slug) &&
  hasText(race.race_date) &&
  hasText(race.location_text) &&
  hasText(race.source_url ?? race.external_site_url) &&
  Number.isFinite(race.distance_km) &&
  race.distance_km > 0;

const getCompletionEdition = (event: CompletionEvent, race?: CompletionRace | null) =>
  event.editions?.find((edition) => edition.id === race?.edition_id)
  ?? event.editions?.find((edition) => edition.is_current)
  ?? event.editions?.[0]
  ?? null;

export const isEventReadyToPublish = (event: CompletionEvent) => {
  const edition = getCompletionEdition(event);
  const startDate = edition?.start_date ?? event.race_date;
  const endDate = edition?.end_date ?? (event.organizerDetails ?? defaultOrganizerEventDetails).dateRange.endDate;
  return hasText(event.name) && hasText(event.location) && hasText(startDate) && hasText(endDate) && event.races.some(isPublishableRace);
};

const isEventCompleteForProgress = (event: CompletionEvent) => {
  const edition = getCompletionEdition(event);
  return hasText(event.name) &&
    hasText(event.location) &&
    hasText(edition?.start_date ?? event.race_date) &&
    hasText(edition?.end_date ?? (event.organizerDetails ?? defaultOrganizerEventDetails).dateRange.endDate) &&
    event.races.some(isRaceIdentityComplete);
};

const statusFrom = (filled: number, total: number, requiredFilled = total): OrganizerModuleStatus => {
  if (filled <= 0) return "empty";
  if (filled >= requiredFilled) return "complete";
  return "incomplete";
};

const scoreModules = (modules: OrganizerModuleSummary[]) => {
  const requiredModules = modules.filter((module) => module.level === "required");
  return requiredModules.length === 0
    ? 100
    : Math.round((requiredModules.filter((module) => module.status === "complete").length / requiredModules.length) * 100);
};

const compactMissingLabels = (entries: Array<[label: string, isFilled: boolean]>) =>
  entries.filter(([, isFilled]) => !isFilled).map(([label]) => label);

const buildFormatProgressModules = (
  eventDetails: OrganizerEventDetails,
  race: CompletionRace,
  aidStationCount: number,
  stationProductCount: number | null
): OrganizerModuleSummary[] => {
  const runnerDetails = buildRunnerOrganizerDetails(eventDetails, race.organizerDetails);
  const equipmentItems = runnerDetails.equipment.items;
  const equipmentOverrideEnabled = race.organizerDetails?.mandatoryEquipment.overrideEnabled === true;
  const access = runnerDetails.access;
  const bibPickup = runnerDetails.bibPickup;
  const hasStructuredBibLocations = bibPickup.locations.length > 0;
  const hasCompleteBibLocations = hasStructuredBibLocations
    ? bibPickup.locations.every((pickupLocation) => hasText(pickupLocation.location))
    : hasText(bibPickup.location);
  const hasCompleteBibSchedules = hasStructuredBibLocations
    ? bibPickup.locations.every((pickupLocation) =>
        pickupLocation.slots.some((slot) => hasText(slot.date) && hasText(slot.startTime) && hasText(slot.endTime))
      )
    : hasText(bibPickup.schedule);
  const hasAnyBibPickupData = hasStructuredBibLocations || filledCount([
    bibPickup.location,
    bibPickup.schedule,
    bibPickup.requiredDocuments,
    bibPickup.thirdPartyPickupAllowed,
    bibPickup.equipmentCheck,
    bibPickup.note,
  ]) > 0;
  const bibPickupStatus: OrganizerModuleStatus = hasCompleteBibLocations && hasCompleteBibSchedules
    ? "complete"
    : hasAnyBibPickupData || bibPickup.overrideEnabled
      ? "incomplete"
      : "empty";
  const accessMissingLabels = compactMissingLabels([
    ["Départ", hasText(access.startAddress)],
    ["Parkings", !access.enabledSections.officialParkings || hasText(access.officialParkings)],
    ["Navettes", !access.enabledSections.shuttles || hasText(access.shuttles) || hasText(access.shuttleSchedule)],
    ["Restrictions route", !access.enabledSections.roadRestrictions || hasText(access.roadRestrictions)],
    ["Carte / Google Maps", !access.enabledSections.mapUrl || hasText(access.mapUrl)],
    [
      "Infos coureur",
      !access.enabledSections.runnerInfo || filledCount([
        race.organizerDetails?.runnerInfo.startArea,
        race.organizerDetails?.runnerInfo.briefing,
        race.organizerDetails?.runnerInfo.rules,
        race.organizerDetails?.runnerInfo.note,
      ]) > 0,
    ],
  ]);
  const hasAnyAccessData = filledCount([
    access.startAddress,
    access.finishAddress,
    access.officialParkings,
    access.shuttles,
    access.shuttleSchedule,
    access.roadRestrictions,
    access.mapUrl,
    access.note,
    race.organizerDetails?.runnerInfo.startArea,
    race.organizerDetails?.runnerInfo.briefing,
    race.organizerDetails?.runnerInfo.rules,
    race.organizerDetails?.runnerInfo.note,
  ]) > 0;
  const accessStatus: OrganizerModuleStatus = accessMissingLabels.length === 0
    ? "complete"
    : hasAnyAccessData || access.overrideEnabled === true
      ? "incomplete"
      : "empty";
  const hasStartTime = hasText(race.organizerDetails?.schedule.startTime) || (race.startWaveCount ?? 0) > 0;
  const hasFinishCutoff = hasText(race.organizerDetails?.schedule.finishCutoffTime);
  const hasAidStations = aidStationCount > 0;

  return [
    {
      id: "formats",
      title: "Course",
      description: "Nom, date, lieu, distance et source. Dénivelé et GPX facultatifs.",
      level: "required",
      status: isRaceIdentityComplete(race) ? "complete" : hasText(race.name) ? "incomplete" : "empty",
      countLabel: race.gpx_storage_path ? "GPX prêt" : "Sans GPX",
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel visible sur cette course.",
      level: equipmentOverrideEnabled ? "required" : "optional",
      status: equipmentItems.length > 0 ? "complete" : equipmentOverrideEnabled || hasText(runnerDetails.equipment.note) ? "incomplete" : "empty",
      countLabel: `${equipmentItems.length} item${equipmentItems.length > 1 ? "s" : ""}`,
    },
    {
      id: "bibPickup",
      title: "Dossard",
      description: "Retrait et documents utilisés par ce format.",
      level: "recommended",
      status: bibPickupStatus,
      countLabel: bibPickup.overrideEnabled ? "Spécifique" : "Hérité de l'événement",
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès format, transports et infos coureur activées.",
      level: "recommended",
      status: accessStatus,
      countLabel: race.organizerDetails && hasRaceAccessOverride(race.organizerDetails.access)
        ? "Spécifique"
        : hasText(access.startAddress)
          ? "Hérité de l'événement"
          : "Non renseigné",
    },
    {
      id: "aidStations",
      title: "Départ, ravitos & relais",
      description: "Départ, arrivée, ravitos, relais, barrières et produits du format.",
      level: "recommended",
      status: hasStartTime && hasFinishCutoff && hasAidStations
        ? "complete"
        : hasStartTime || hasFinishCutoff || hasAidStations
          ? "incomplete"
          : "empty",
      countLabel: `${race.startWaveCount ?? 0} SAS · ${aidStationCount} ravito${aidStationCount > 1 ? "s" : ""}${aidStationCount > 0 && stationProductCount !== null ? ` · ${stationProductCount} produit${stationProductCount > 1 ? "s" : ""}` : ""}`,
    },
    { id: "awards", title: "Podiums & récompenses", description: "Catégories, places récompensées et horaires.", level: "optional", status: (race.awardCount ?? 0) > 0 ? "complete" : "empty", countLabel: (race.awardCount ?? 0) > 0 ? `${race.awardCount} catégorie${race.awardCount! > 1 ? "s" : ""}` : "Optionnel" },
  ];
};

export function buildOrganizerCompletion(
  event: CompletionEvent,
  activeRace: CompletionRace | null,
  aidStations: CompletionAidStation[],
  stationProducts: CompletionStationProduct[],
  persistedCounts?: { aidStations?: number; startWaves?: number; awards?: number; services?: number; stationProducts?: number; sponsors?: number; sponsorClicks?: number; brandingConfigured?: boolean; brandingUnpublished?: boolean },
  enabledModules?: {
    event: ReadonlySet<OrganizerModuleId>;
    races: Readonly<Record<string, ReadonlySet<OrganizerModuleId>>>;
  },
): OrganizerCompletionSummary {
  const eventDetails = event.organizerDetails ?? defaultOrganizerEventDetails;
  const activeEdition = getCompletionEdition(event, activeRace);
  const editionStartDate = activeEdition?.start_date ?? event.race_date;
  const editionEndDate = activeEdition?.end_date ?? eventDetails.dateRange.endDate;
  const eventFilled = filledCount([event.name, event.location, editionStartDate, editionEndDate]);
  const formatCount = event.races.length;
  const gpxCount = event.races.filter((race) => hasText(race.gpx_storage_path)).length;
  const raceProgress = event.races.map((race) => {
    return {
      id: race.id,
      editionGroupId: race.edition_group_id,
      seriesName: race.series_name,
      name: race.name,
      score: scoreModules(
        buildFormatProgressModules(eventDetails, race, race.aidStationCount ?? 0, null).filter(
          (module) => enabledModules?.races[race.id]?.has(module.id) ?? true,
        ),
      ),
    };
  });
  const raceProgressScore = raceProgress.length > 0 ? Math.round(raceProgress.reduce((total, race) => total + race.score, 0) / raceProgress.length) : 0;
  const runnerDetails = buildRunnerOrganizerDetails(eventDetails, activeRace?.organizerDetails);
  const equipmentItems = runnerDetails.equipment.items;
  const access = runnerDetails.access;
  const services = runnerDetails.services;
  const commonEquipment = eventDetails.mandatoryEquipment;
  const commonBibPickup = eventDetails.bibPickup;
  const commonAccess = eventDetails.access;
  const accessEnabledSections = access.enabledSections;
  const activeAidStationCount = persistedCounts?.aidStations ?? aidStations.length;
  const startWaveCount = persistedCounts?.startWaves ?? activeRace?.startWaveCount ?? 0;
  const awardCount = persistedCounts?.awards ?? activeRace?.awardCount ?? 0;
  const structuredServiceCount = persistedCounts?.services ?? activeEdition?.serviceCount ?? 0;
  const linkedStationProductCount = persistedCounts
    ? persistedCounts.stationProducts ?? null
    : stationProducts.length;
  const sponsorCount = persistedCounts?.sponsors ?? activeEdition?.sponsorCount ?? 0;
  const sponsorClicks = persistedCounts?.sponsorClicks ?? activeEdition?.sponsorClicks ?? 0;
  const brandingConfigured = persistedCounts?.brandingConfigured ?? activeEdition?.brandingConfigured ?? false;
  const brandingUnpublished = persistedCounts?.brandingUnpublished ?? activeEdition?.brandingUnpublished ?? false;
  const eventMissingLabels = compactMissingLabels([
    ["Nom", hasText(event.name)],
    ["Lieu", hasText(event.location)],
    ["Début édition", hasText(editionStartDate)],
    ["Fin édition", hasText(editionEndDate)],
  ]);
  const formatMissingLabels = activeRace
    ? compactMissingLabels([
        ["Nom", hasText(activeRace.name)],
        ["Date", hasText(activeRace.race_date)],
        ["Lieu", hasText(activeRace.location_text)],
        ["Distance", Number.isFinite(activeRace.distance_km) && activeRace.distance_km > 0],
        ["Source", hasText(activeRace.source_url ?? activeRace.external_site_url)],
      ])
    : [];
  const aidStationMissingLabels = activeRace
    ? compactMissingLabels([
        ["Heure départ", hasText(activeRace.organizerDetails?.schedule.startTime) || startWaveCount > 0],
        ["Barrière arrivée", hasText(activeRace.organizerDetails?.schedule.finishCutoffTime)],
        ["Ravitos", activeAidStationCount > 0],
      ])
    : [];
  const commonEquipmentMissingLabels: string[] = [];
  const formatEquipmentMissingLabels = activeRace?.organizerDetails?.mandatoryEquipment.overrideEnabled === true && equipmentItems.length === 0
    ? ["Matériel"]
    : [];
  const hasStructuredBibLocations = commonBibPickup.locations.length > 0;
  const hasCompleteBibLocations = hasStructuredBibLocations
    ? commonBibPickup.locations.every((pickupLocation) => hasText(pickupLocation.location))
    : hasText(commonBibPickup.location);
  const hasCompleteBibSchedules = hasStructuredBibLocations
    ? commonBibPickup.locations.every((pickupLocation) =>
        pickupLocation.slots.some((slot) => hasText(slot.date) && hasText(slot.startTime) && hasText(slot.endTime))
      )
    : hasText(commonBibPickup.schedule);
  const bibPickupMissingLabels = compactMissingLabels([
    ["Lieux retrait", hasCompleteBibLocations],
    ["Jours et horaires", hasCompleteBibSchedules],
  ]);
  const hasAnyCommonBibPickupData = hasStructuredBibLocations || filledCount([
    commonBibPickup.location,
    commonBibPickup.schedule,
    commonBibPickup.requiredDocuments,
    commonBibPickup.thirdPartyPickupAllowed,
    commonBibPickup.equipmentCheck,
    commonBibPickup.note,
  ]) > 0;
  const commonBibPickupStatus: OrganizerModuleStatus = bibPickupMissingLabels.length === 0
    ? "complete"
    : hasAnyCommonBibPickupData
      ? "incomplete"
      : "empty";
  const commonAccessMissingLabels = compactMissingLabels([
    ["Départ", hasText(commonAccess.startAddress)],
    ["Parkings", !commonAccess.enabledSections.officialParkings || hasText(commonAccess.officialParkings)],
    ["Navettes", !commonAccess.enabledSections.shuttles || hasText(commonAccess.shuttles) || hasText(commonAccess.shuttleSchedule)],
    ["Restrictions route", !commonAccess.enabledSections.roadRestrictions || hasText(commonAccess.roadRestrictions)],
    ["Carte / Google Maps", !commonAccess.enabledSections.mapUrl || hasText(commonAccess.mapUrl)],
  ]);
  const formatAccessMissingLabels = compactMissingLabels([
    ["Départ", hasText(access.startAddress)],
    ["Parkings", !accessEnabledSections.officialParkings || hasText(access.officialParkings)],
    ["Navettes", !accessEnabledSections.shuttles || hasText(access.shuttles) || hasText(access.shuttleSchedule)],
    ["Restrictions route", !accessEnabledSections.roadRestrictions || hasText(access.roadRestrictions)],
    ["Carte / Google Maps", !accessEnabledSections.mapUrl || hasText(access.mapUrl)],
    [
      "Infos coureur",
      !accessEnabledSections.runnerInfo ||
        filledCount([
          activeRace?.organizerDetails?.runnerInfo.startArea,
          activeRace?.organizerDetails?.runnerInfo.briefing,
          activeRace?.organizerDetails?.runnerInfo.rules,
          activeRace?.organizerDetails?.runnerInfo.note,
        ]) > 0,
    ],
  ]);
  const hasAnyCommonAccessData = filledCount([
    commonAccess.startAddress,
    commonAccess.finishAddress,
    commonAccess.officialParkings,
    commonAccess.shuttles,
    commonAccess.shuttleSchedule,
    commonAccess.roadRestrictions,
    commonAccess.mapUrl,
    commonAccess.note,
  ]) > 0;
  const commonAccessStatus: OrganizerModuleStatus = commonAccessMissingLabels.length === 0
    ? "complete"
    : hasAnyCommonAccessData
      ? "incomplete"
      : "empty";
  const activeHasStartTime = activeRace
    ? hasText(activeRace.organizerDetails?.schedule.startTime) || startWaveCount > 0
    : false;
  const activeHasFinishCutoff = activeRace ? hasText(activeRace.organizerDetails?.schedule.finishCutoffTime) : false;
  const activeHasAidStations = Boolean(activeRace) && activeAidStationCount > 0;
  const activeAidStationStatus: OrganizerModuleStatus = activeHasStartTime && activeHasFinishCutoff && activeHasAidStations
    ? "complete"
    : activeHasStartTime || activeHasFinishCutoff || activeHasAidStations
      ? "incomplete"
      : "empty";

  const modules: OrganizerModuleSummary[] = [
    {
      id: "event",
      title: "Informations",
      description: "Nom, lieu et dates de l'événement.",
      level: "required",
      status: statusFrom(eventFilled, 4),
      countLabel: `${eventFilled}/4 champs`,
      missingLabels: eventMissingLabels,
    },
    {
      id: "formats",
      title: "Formats & GPX",
      description: "Formats de course, distances, dénivelés et traces GPX.",
      level: "required",
      status: event.races.some(isRaceIdentityComplete) ? "complete" : formatCount > 0 ? "incomplete" : "empty",
      countLabel: `${formatCount} format${formatCount > 1 ? "s" : ""}, ${gpxCount} GPX`,
    },
    {
      id: "aidStations",
      title: "Départ, ravitos & relais",
      description: "Départ, arrivée, ravitos, relais, barrières et produits officiels.",
      level: "recommended",
      status: activeAidStationStatus,
      countLabel: `${startWaveCount} SAS · ${activeAidStationCount} ravito${activeAidStationCount > 1 ? "s" : ""}${activeAidStationCount > 0 && linkedStationProductCount !== null ? ` · ${linkedStationProductCount} produit${linkedStationProductCount > 1 ? "s" : ""}` : ""}`,
      missingLabels: aidStationMissingLabels,
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel visible sur la course sélectionnée.",
      level: activeRace?.organizerDetails?.mandatoryEquipment.overrideEnabled === true ? "required" : "optional",
      status: equipmentItems.length > 0
        ? "complete"
        : activeRace?.organizerDetails?.mandatoryEquipment.overrideEnabled === true || hasText(runnerDetails.equipment.note)
          ? "incomplete"
          : "empty",
      countLabel: `${equipmentItems.length} item${equipmentItems.length > 1 ? "s" : ""}`,
      missingLabels: formatEquipmentMissingLabels,
    },
    {
      id: "bibPickup",
      title: "Dossard commun",
      description: "Retrait et documents communs à tout l'événement.",
      level: "recommended",
      status: commonBibPickupStatus,
      countLabel: commonBibPickup.locations.length > 0
        ? `${commonBibPickup.locations.length} lieu${commonBibPickup.locations.length > 1 ? "x" : ""}`
        : hasText(commonBibPickup.location)
          ? "Lieu renseigné"
          : "Non renseigné",
      missingLabels: bibPickupMissingLabels,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès, transport et consignes utiles aux coureurs.",
      level: "recommended",
      status: activeRace ? buildFormatProgressModules(eventDetails, activeRace, activeAidStationCount, linkedStationProductCount)
        .find((module) => module.id === "access")?.status ?? "empty" : commonAccessStatus,
      countLabel: hasText(access.startAddress) ? "Accès renseignés" : "Non renseigné",
      missingLabels: formatAccessMissingLabels,
    },
    {
      id: "services",
      title: "Services & alentours",
      description: "Accompagnants, hébergement, restauration, récup, partenaires.",
      level: "optional",
      status: structuredServiceCount > 0 ? "complete" : statusFrom(
        filledCount([
          services?.supporters,
          services?.accommodations,
          services?.restaurants,
          services?.recovery,
          services?.partners,
          services?.lastMinuteMessage,
          services?.note,
        ]),
        7,
        1
      ),
      countLabel: structuredServiceCount > 0 ? `${structuredServiceCount} fiche${structuredServiceCount > 1 ? "s" : ""}` : hasText(services?.partners) ? "Partenaires renseignés" : "Optionnel",
    },
    {
      id: "branding",
      title: "Identité visuelle",
      description: "Logo et couleurs du RaceBook pour cette édition.",
      level: "optional",
      status: brandingUnpublished ? "incomplete" : brandingConfigured ? "complete" : "empty",
      countLabel: brandingUnpublished ? "Brouillon non publié" : brandingConfigured ? "DA publiée" : "Optionnel",
    },
    {
      id: "sponsors",
      title: "Sponsors",
      description: "Logos mis en avant dans le RaceBook de cette édition.",
      level: "optional",
      status: sponsorCount > 0 ? "complete" : "empty",
      countLabel: sponsorCount > 0 ? `${sponsorCount} sponsor${sponsorCount > 1 ? "s" : ""} · ${sponsorClicks} clic${sponsorClicks > 1 ? "s" : ""}` : "Optionnel",
    },
  ];

  const eventModules: OrganizerModuleSummary[] = [
    {
      id: "event",
      title: "Informations",
      description: "Nom, lieu et dates de l'événement.",
      level: "required",
      status: statusFrom(eventFilled, 4),
      countLabel: `${eventFilled}/4 champs`,
      missingLabels: eventMissingLabels,
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel valable pour tous les formats.",
      level: "optional",
      status: commonEquipment.items.length > 0 ? "complete" : hasText(commonEquipment.note) ? "incomplete" : "empty",
      countLabel: `${commonEquipment.items.length} item${commonEquipment.items.length > 1 ? "s" : ""}`,
      missingLabels: commonEquipmentMissingLabels,
    },
    {
      id: "bibPickup",
      title: "Dossard",
      description: "Retrait et documents communs à l'événement.",
      level: "recommended",
      status: commonBibPickupStatus,
      countLabel: commonBibPickup.locations.length > 0
        ? `${commonBibPickup.locations.length} lieu${commonBibPickup.locations.length > 1 ? "x" : ""}`
        : hasText(commonBibPickup.location)
          ? "Lieu commun"
          : "Non renseigné",
      missingLabels: bibPickupMissingLabels,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès, parking et navettes par défaut.",
      level: "recommended",
      status: commonAccessStatus,
      countLabel: hasText(commonAccess.startAddress) ? "Accès renseignés" : "Non renseigné",
      missingLabels: commonAccessMissingLabels,
    },
    {
      id: "services",
      title: "Services",
      description: "Accompagnants, hébergement, restauration, partenaires.",
      level: "optional",
      status: structuredServiceCount > 0 ? "complete" : statusFrom(
        filledCount([
          services.supporters,
          services.accommodations,
          services.restaurants,
          services.recovery,
          services.partners,
          services.lastMinuteMessage,
          services.note,
        ]),
        7,
        1
      ),
      countLabel: structuredServiceCount > 0
        ? `${structuredServiceCount} fiche${structuredServiceCount > 1 ? "s" : ""}`
        : hasText(services.partners)
          ? "Partenaires renseignés"
          : "Optionnel",
    },
    {
      id: "branding",
      title: "Identité visuelle",
      description: "Logo et couleurs du RaceBook pour cette édition.",
      level: "optional",
      status: brandingUnpublished ? "incomplete" : brandingConfigured ? "complete" : "empty",
      countLabel: brandingUnpublished ? "Brouillon non publié" : brandingConfigured ? "DA publiée" : "Optionnel",
    },
    {
      id: "sponsors",
      title: "Sponsors",
      description: "Chargement et bandeau du RaceBook pour l'édition.",
      level: "optional",
      status: sponsorCount > 0 ? "complete" : "empty",
      countLabel: sponsorCount > 0 ? `${sponsorCount} sponsor${sponsorCount > 1 ? "s" : ""} · ${sponsorClicks} clic${sponsorClicks > 1 ? "s" : ""}` : "Optionnel",
    },
  ];

  const formatModules: OrganizerModuleSummary[] = activeRace
    ? buildFormatProgressModules(eventDetails, { ...activeRace, startWaveCount, awardCount }, activeAidStationCount, linkedStationProductCount).map((module) => {
        if (module.id === "formats") return { ...module, missingLabels: formatMissingLabels };
        if (module.id === "equipment") return { ...module, missingLabels: formatEquipmentMissingLabels };
        if (module.id === "access") return { ...module, missingLabels: formatAccessMissingLabels };
        if (module.id === "aidStations") return { ...module, missingLabels: aidStationMissingLabels };
        return module;
      })
    : [];

  const visibleEventModules = enabledModules ? eventModules.filter((module) => enabledModules.event.has(module.id)) : eventModules;
  const visibleFormatModules = enabledModules && activeRace
    ? formatModules.filter((module) => enabledModules.races[activeRace.id]?.has(module.id) ?? false)
    : formatModules;
  const visibleModules = enabledModules
    ? modules.filter((module) => activeRace
      ? enabledModules.races[activeRace.id]?.has(module.id) ?? enabledModules.event.has(module.id)
      : enabledModules.event.has(module.id))
    : modules;
  const score = scoreModules(visibleModules);
  const eventScore = scoreModules(visibleEventModules);
  const formatScore = scoreModules(visibleFormatModules);

  return {
    score,
    eventScore,
    formatScore,
    raceProgress,
    raceProgressScore,
    informationComplete: isEventCompleteForProgress(event),
    requiredComplete: isEventReadyToPublish(event),
    modules: visibleModules,
    eventModules: visibleEventModules,
    formatModules: visibleFormatModules,
  };
}
