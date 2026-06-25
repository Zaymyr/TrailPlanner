import type {
  OrganizerAidStationDetails,
  OrganizerEventDetails,
  OrganizerRaceDetails,
} from "../../../lib/organizer-dashboard-details";
import { buildRunnerOrganizerDetails, defaultOrganizerEventDetails } from "../../../lib/organizer-dashboard-details";

export type OrganizerModuleId =
  | "event"
  | "formats"
  | "aidStations"
  | "equipment"
  | "bibPickup"
  | "access"
  | "products"
  | "services"
  | "preview";

export type OrganizerModuleLevel = "required" | "recommended" | "optional";
export type OrganizerModuleStatus = "empty" | "incomplete" | "complete";

export type CompletionRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  race_date?: string | null;
  gpx_storage_path?: string | null;
  is_live: boolean;
  organizerDetails?: OrganizerRaceDetails;
};

export type CompletionEvent = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  is_live?: boolean | null;
  organizerDetails?: OrganizerEventDetails;
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
  name: string;
  score: number;
};

export type OrganizerCompletionSummary = {
  score: number;
  eventScore: number;
  formatScore: number;
  raceProgress: OrganizerRaceProgress[];
  raceProgressScore: number;
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
  Number.isFinite(race.distance_km) &&
  race.distance_km > 0 &&
  Number.isFinite(race.elevation_gain_m) &&
  race.elevation_gain_m >= 0;

export const isEventReadyToPublish = (event: CompletionEvent) =>
  hasText(event.name) &&
  hasText(event.location) &&
  hasText(event.race_date) &&
  hasText((event.organizerDetails ?? defaultOrganizerEventDetails).dateRange.endDate) &&
  event.races.some(isPublishableRace);

const statusFrom = (filled: number, total: number, requiredFilled = total): OrganizerModuleStatus => {
  if (filled <= 0) return "empty";
  if (filled >= requiredFilled) return "complete";
  return "incomplete";
};

const scoreModules = (modules: OrganizerModuleSummary[]) =>
  modules.length === 0 ? 0 : Math.round((modules.filter((module) => module.status === "complete").length / modules.length) * 100);

const compactMissingLabels = (entries: Array<[label: string, isFilled: boolean]>) =>
  entries.filter(([, isFilled]) => !isFilled).map(([label]) => label);

const buildFormatProgressModules = (
  eventDetails: OrganizerEventDetails,
  race: CompletionRace,
  aidStations: CompletionAidStation[],
  stationProducts: CompletionStationProduct[]
): OrganizerModuleSummary[] => {
  const runnerDetails = buildRunnerOrganizerDetails(eventDetails, race.organizerDetails);
  const equipmentItems = runnerDetails.equipment.items;
  const access = runnerDetails.access;

  return [
    {
      id: "formats",
      title: "Identité",
      description: "Nom, distance, dénivelé, statut et GPX.",
      level: "required",
      status: isPublishableRace(race) ? "complete" : hasText(race.name) ? "incomplete" : "empty",
      countLabel: `${race.is_live ? "Live" : "Brouillon"} / ${race.gpx_storage_path ? "GPX" : "Sans GPX"}`,
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel visible sur cette course.",
      level: "recommended",
      status: equipmentItems.length > 0 ? "complete" : hasText(runnerDetails.equipment.note) ? "incomplete" : "empty",
      countLabel: `${equipmentItems.length} item${equipmentItems.length > 1 ? "s" : ""}`,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès format, transports et infos coureur activées.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          access.startAddress,
          access.finishAddress,
          access.enabledSections.officialParkings ? access.officialParkings : true,
          access.enabledSections.shuttles ? access.shuttles || access.shuttleSchedule : true,
          access.enabledSections.roadRestrictions ? access.roadRestrictions : true,
          access.enabledSections.mapUrl ? access.mapUrl : true,
          access.enabledSections.runnerInfo
            ? race.organizerDetails?.runnerInfo.startArea ||
              race.organizerDetails?.runnerInfo.briefing ||
              race.organizerDetails?.runnerInfo.rules ||
              race.organizerDetails?.runnerInfo.note
            : true,
          access.note,
        ]),
        8,
        2
      ),
      countLabel: hasText(race.organizerDetails?.access.startAddress) ? "Spécifique" : hasText(access.startAddress) ? "Hérité" : "Non renseigné",
    },
    {
      id: "aidStations",
      title: "Ravitos",
      description: "Départ, arrivée, ravitos, barrières et produits du format.",
      level: "recommended",
      status:
        hasText(race.organizerDetails?.schedule.startTime) ||
        hasText(race.organizerDetails?.schedule.finishCutoffTime) ||
        aidStations.length > 0
          ? "complete"
          : "empty",
      countLabel: `${aidStations.length} ravito${aidStations.length > 1 ? "s" : ""}${aidStations.length > 0 ? ` - ${stationProducts.length} produit${stationProducts.length > 1 ? "s" : ""}` : ""}`,
    },
  ];
};

export function buildOrganizerCompletion(
  event: CompletionEvent,
  activeRace: CompletionRace | null,
  aidStations: CompletionAidStation[],
  stationProducts: CompletionStationProduct[]
): OrganizerCompletionSummary {
  const eventDetails = event.organizerDetails ?? defaultOrganizerEventDetails;
  const eventFilled = filledCount([event.name, event.location, event.race_date, eventDetails.dateRange.endDate]);
  const publishableRaceCount = event.races.filter(isPublishableRace).length;
  const formatCount = event.races.length;
  const gpxCount = event.races.filter((race) => hasText(race.gpx_storage_path)).length;
  const raceProgress = event.races.map((race) => {
    const isActiveRace = activeRace?.id === race.id;
    return {
      id: race.id,
      name: race.name,
      score: scoreModules(buildFormatProgressModules(eventDetails, race, isActiveRace ? aidStations : [], isActiveRace ? stationProducts : [])),
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
  const linkedStationProductCount = stationProducts.length;
  const eventMissingLabels = compactMissingLabels([
    ["Nom", hasText(event.name)],
    ["Lieu", hasText(event.location)],
    ["Date début", hasText(event.race_date)],
    ["Date fin", hasText(eventDetails.dateRange.endDate)],
  ]);
  const formatMissingLabels = activeRace
    ? compactMissingLabels([
        ["Nom", hasText(activeRace.name)],
        ["Distance", Number.isFinite(activeRace.distance_km) && activeRace.distance_km > 0],
        ["D+", Number.isFinite(activeRace.elevation_gain_m) && activeRace.elevation_gain_m >= 0],
      ])
    : [];
  const aidStationMissingLabels = activeRace
    ? compactMissingLabels([
        ["Heure départ", hasText(activeRace.organizerDetails?.schedule.startTime)],
        ["Barrière arrivée", hasText(activeRace.organizerDetails?.schedule.finishCutoffTime)],
        ["Ravitos", aidStations.length > 0],
      ])
    : [];
  const commonEquipmentMissingLabels = compactMissingLabels([["Matériel", commonEquipment.items.length > 0 || hasText(commonEquipment.note)]]);
  const formatEquipmentMissingLabels = compactMissingLabels([["Matériel", equipmentItems.length > 0 || hasText(runnerDetails.equipment.note)]]);
  const bibPickupMissingLabels = compactMissingLabels([
    ["Lieu retrait", hasText(commonBibPickup.location)],
    ["Horaires", hasText(commonBibPickup.schedule)],
  ]);
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

  const modules: OrganizerModuleSummary[] = [
    {
      id: "event",
      title: "Informations",
      description: "Nom, lieu, dates et statut public.",
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
      status: publishableRaceCount > 0 ? "complete" : formatCount > 0 ? "incomplete" : "empty",
      countLabel: `${formatCount} format${formatCount > 1 ? "s" : ""}, ${gpxCount} GPX`,
    },
    {
      id: "aidStations",
      title: "Ravitos & points de course",
      description: "Départ, arrivée, ravitos, barrières et produits officiels.",
      level: "recommended",
      status:
        activeRace &&
        (hasText(activeRace.organizerDetails?.schedule.startTime) ||
          hasText(activeRace.organizerDetails?.schedule.finishCutoffTime) ||
          aidStations.length > 0)
          ? "complete"
          : "empty",
      countLabel: `${aidStations.length} ravito${aidStations.length > 1 ? "s" : ""}${aidStations.length > 0 ? ` - ${linkedStationProductCount} produit${linkedStationProductCount > 1 ? "s" : ""}` : ""}`,
      missingLabels: aidStationMissingLabels,
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel visible sur la course sélectionnée.",
      level: "recommended",
      status: equipmentItems.length > 0 ? "complete" : hasText(runnerDetails.equipment.note) ? "incomplete" : "empty",
      countLabel: `${equipmentItems.length} item${equipmentItems.length > 1 ? "s" : ""}`,
      missingLabels: formatEquipmentMissingLabels,
    },
    {
      id: "bibPickup",
      title: "Dossard commun",
      description: "Retrait et documents communs à tout l'événement.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          commonBibPickup.location,
          commonBibPickup.schedule,
          commonBibPickup.requiredDocuments,
          commonBibPickup.thirdPartyPickupAllowed,
          commonBibPickup.equipmentCheck,
          commonBibPickup.note,
        ]),
        6,
        2
      ),
      countLabel: hasText(commonBibPickup.location) ? "Lieu renseigné" : "Non renseigné",
      missingLabels: bibPickupMissingLabels,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès, transport et consignes utiles aux coureurs.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          access.startAddress,
          access.finishAddress,
          access.enabledSections.officialParkings ? access.officialParkings : true,
          access.enabledSections.shuttles ? access.shuttles || access.shuttleSchedule : true,
          access.enabledSections.roadRestrictions ? access.roadRestrictions : true,
          access.enabledSections.mapUrl ? access.mapUrl : true,
          access.note,
        ]),
        7,
        2
      ),
      countLabel: hasText(access.officialParkings) || hasText(access.shuttles) ? "Infos transport" : "Non renseigné",
      missingLabels: formatAccessMissingLabels,
    },
    {
      id: "services",
      title: "Partenaires / services",
      description: "Accompagnants, hébergement, restauration, récup, partenaires.",
      level: "optional",
      status: statusFrom(
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
      countLabel: hasText(services?.partners) ? "Partenaires renseignés" : "Optionnel",
    },
    {
      id: "preview",
      title: "Prévisualisation coureur",
      description: "Version simple de ce que verra un coureur.",
      level: "optional",
      status: isEventReadyToPublish(event) ? "complete" : "incomplete",
      countLabel: isEventReadyToPublish(event) ? "Prêt" : "Essentiel manquant",
    },
  ];

  const eventModules: OrganizerModuleSummary[] = [
    {
      id: "event",
      title: "Informations",
      description: "Nom, lieu, dates et statut public.",
      level: "required",
      status: statusFrom(eventFilled, 4),
      countLabel: `${eventFilled}/4 champs`,
      missingLabels: eventMissingLabels,
    },
    {
      id: "equipment",
      title: "Matériel",
      description: "Matériel valable pour tous les formats.",
      level: "recommended",
      status: commonEquipment.items.length > 0 ? "complete" : hasText(commonEquipment.note) ? "incomplete" : "empty",
      countLabel: `${commonEquipment.items.length} item${commonEquipment.items.length > 1 ? "s" : ""}`,
      missingLabels: commonEquipmentMissingLabels,
    },
    {
      id: "bibPickup",
      title: "Dossard",
      description: "Retrait et documents communs à l'événement.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          commonBibPickup.location,
          commonBibPickup.schedule,
          commonBibPickup.requiredDocuments,
          commonBibPickup.thirdPartyPickupAllowed,
          commonBibPickup.equipmentCheck,
          commonBibPickup.note,
        ]),
        6,
        2
      ),
      countLabel: hasText(commonBibPickup.location) ? "Lieu commun" : "Non renseigné",
      missingLabels: bibPickupMissingLabels,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès, parking et navettes par défaut.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          commonAccess.startAddress,
          commonAccess.finishAddress,
          commonAccess.enabledSections.officialParkings ? commonAccess.officialParkings : true,
          commonAccess.enabledSections.shuttles ? commonAccess.shuttles || commonAccess.shuttleSchedule : true,
          commonAccess.enabledSections.roadRestrictions ? commonAccess.roadRestrictions : true,
          commonAccess.enabledSections.mapUrl ? commonAccess.mapUrl : true,
          commonAccess.note,
        ]),
        6,
        2
      ),
      countLabel: hasText(commonAccess.officialParkings) || hasText(commonAccess.shuttles) ? "Infos transport" : "Non renseigné",
      missingLabels: commonAccessMissingLabels,
    },
    {
      id: "services",
      title: "Services",
      description: "Accompagnants, hébergement, restauration, partenaires.",
      level: "optional",
      status: statusFrom(
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
      countLabel: hasText(services.partners) ? "Partenaires renseignés" : "Optionnel",
    },
  ];

  const formatModules: OrganizerModuleSummary[] = activeRace
    ? buildFormatProgressModules(eventDetails, activeRace, aidStations, stationProducts).map((module) => {
        if (module.id === "formats") return { ...module, missingLabels: formatMissingLabels };
        if (module.id === "equipment") return { ...module, missingLabels: formatEquipmentMissingLabels };
        if (module.id === "access") return { ...module, missingLabels: formatAccessMissingLabels };
        if (module.id === "aidStations") return { ...module, missingLabels: aidStationMissingLabels };
        return module;
      })
    : [];

  const score = scoreModules(modules);
  const eventScore = scoreModules(eventModules);
  const formatScore = scoreModules(formatModules);

  return {
    score,
    eventScore,
    formatScore,
    raceProgress,
    raceProgressScore,
    requiredComplete: isEventReadyToPublish(event),
    modules,
    eventModules,
    formatModules,
  };
}
