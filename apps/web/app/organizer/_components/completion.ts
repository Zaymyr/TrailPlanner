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
  | "schedule"
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

export type OrganizerCompletionSummary = {
  score: number;
  eventScore: number;
  formatScore: number;
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
  const runnerDetails = buildRunnerOrganizerDetails(eventDetails, activeRace?.organizerDetails);
  const schedule = runnerDetails.schedule;
  const equipmentItems = runnerDetails.equipment.items;
  const bibPickup = runnerDetails.bibPickup;
  const access = runnerDetails.access;
  const services = runnerDetails.services;
  const commonEquipment = eventDetails.mandatoryEquipment;
  const commonBibPickup = eventDetails.bibPickup;
  const commonAccess = eventDetails.access;
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
  const scheduleMissingLabels = compactMissingLabels([
    ["Heure départ", hasText(schedule?.startTime)],
    ["Barrière arrivée", hasText(schedule?.finishCutoffTime) || hasText(schedule?.cutoffNote)],
  ]);
  const commonEquipmentMissingLabels = compactMissingLabels([
    ["Matériel", commonEquipment.items.length > 0 || hasText(commonEquipment.note)],
  ]);
  const formatEquipmentMissingLabels = compactMissingLabels([
    ["Matériel", equipmentItems.length > 0 || hasText(runnerDetails.equipment.note)],
  ]);
  const commonBibPickupMissingLabels = compactMissingLabels([
    ["Lieu retrait", hasText(commonBibPickup.location)],
    ["Horaires", hasText(commonBibPickup.schedule)],
  ]);
  const formatBibPickupMissingLabels = compactMissingLabels([
    ["Lieu retrait", hasText(bibPickup?.location)],
    ["Horaires", hasText(bibPickup?.schedule)],
  ]);
  const commonAccessMissingLabels = compactMissingLabels([
    ["Départ", hasText(commonAccess.startAddress)],
    ["Parking/navettes", hasText(commonAccess.officialParkings) || hasText(commonAccess.shuttles)],
  ]);
  const formatAccessMissingLabels = compactMissingLabels([
    ["Départ", hasText(access?.startAddress)],
    ["Parking/navettes", hasText(access?.officialParkings) || hasText(access?.shuttles)],
  ]);
  const linkedStationProductCount = stationProducts.length;
  const stationsWithDetails = aidStations.filter((station) => {
    const details = station.organizerDetails;
    return Boolean(
      details &&
        (details.cumulativeElevationGainM !== null ||
          details.cumulativeElevationLossM !== null ||
          hasText(details.cutoffTime) ||
          details.dropBagAvailable ||
          hasText(details.organizerNote))
    );
  }).length;

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
      description: "Liste des ravitos, services, barrières et produits officiels.",
      level: "recommended",
      status: aidStations.length > 0 ? "complete" : "empty",
      countLabel: `${aidStations.length} ravito${aidStations.length > 1 ? "s" : ""}${aidStations.length > 0 ? ` - ${linkedStationProductCount} produit${linkedStationProductCount > 1 ? "s" : ""}` : ""}`,
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
      id: "schedule",
      title: "Horaires & barrières",
      description: "Départ, limite arrivée, navettes et synthèse barrières.",
      level: "recommended",
      status: statusFrom(filledCount([schedule?.startTime, schedule?.finishCutoffTime, schedule?.cutoffNote]), 3, 1),
      countLabel: activeRace ? `${stationsWithDetails} point${stationsWithDetails > 1 ? "s" : ""} détaillé${stationsWithDetails > 1 ? "s" : ""}` : "Aucun format",
      missingLabels: scheduleMissingLabels,
    },
    {
      id: "bibPickup",
      title: "Dossard",
      description: "Commun événement avec surcharge possible par format.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          bibPickup?.location,
          bibPickup?.schedule,
          bibPickup?.requiredDocuments,
          bibPickup?.thirdPartyPickupAllowed,
          bibPickup?.equipmentCheck,
          bibPickup?.note,
        ]),
        6,
        2
      ),
      countLabel: hasText(bibPickup?.location) ? "Lieu renseigné" : "Non renseigné",
      missingLabels: formatBibPickupMissingLabels,
    },
    {
      id: "access",
      title: "Accès",
      description: "Accès commun avec surcharge possible par format.",
      level: "recommended",
      status: statusFrom(
        filledCount([
          access?.startAddress,
          access?.finishAddress,
          access?.officialParkings,
          access?.shuttles,
          access?.shuttleSchedule,
          access?.roadRestrictions,
          access?.mapUrl,
          access?.note,
        ]),
        8,
        2
      ),
      countLabel: hasText(access?.officialParkings) || hasText(access?.shuttles) ? "Infos transport" : "Non renseigné",
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
      description: "Retrait et documents par défaut.",
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
      missingLabels: commonBibPickupMissingLabels,
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
          commonAccess.officialParkings,
          commonAccess.shuttles,
          commonAccess.shuttleSchedule,
          commonAccess.roadRestrictions,
          commonAccess.mapUrl,
          commonAccess.note,
        ]),
        8,
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
    ? [
        {
          id: "formats",
          title: "Identité",
          description: "Nom, distance, dénivelé, statut et GPX.",
          level: "required",
          status: isPublishableRace(activeRace) ? "complete" : hasText(activeRace.name) ? "incomplete" : "empty",
          countLabel: `${activeRace.is_live ? "Live" : "Brouillon"} / ${activeRace.gpx_storage_path ? "GPX" : "Sans GPX"}`,
          missingLabels: formatMissingLabels,
        },
        {
          id: "schedule",
          title: "Horaires & barrières",
          description: "Départ, limite arrivée, navettes et barrières.",
          level: "recommended",
          status: statusFrom(filledCount([schedule?.startTime, schedule?.finishCutoffTime, schedule?.cutoffNote]), 3, 1),
          countLabel: `${stationsWithDetails} point${stationsWithDetails > 1 ? "s" : ""} détaillé${stationsWithDetails > 1 ? "s" : ""}`,
          missingLabels: scheduleMissingLabels,
        },
        {
          id: "equipment",
          title: "Matériel",
          description: "Matériel visible sur cette course.",
          level: "recommended",
          status: equipmentItems.length > 0 ? "complete" : hasText(runnerDetails.equipment.note) ? "incomplete" : "empty",
          countLabel: `${equipmentItems.length} item${equipmentItems.length > 1 ? "s" : ""}`,
          missingLabels: formatEquipmentMissingLabels,
        },
        {
          id: "bibPickup",
          title: "Dossard",
          description: "Commun hérité ou retrait spécifique.",
          level: "recommended",
          status: statusFrom(
            filledCount([
              bibPickup?.location,
              bibPickup?.schedule,
              bibPickup?.requiredDocuments,
              bibPickup?.thirdPartyPickupAllowed,
              bibPickup?.equipmentCheck,
              bibPickup?.note,
            ]),
            6,
            2
          ),
          countLabel: hasText(activeRace.organizerDetails?.bibPickup.location) ? "Spécifique" : hasText(bibPickup?.location) ? "Hérité" : "Non renseigné",
          missingLabels: formatBibPickupMissingLabels,
        },
        {
          id: "access",
          title: "Accès",
          description: "Commun hérité ou accès spécifique.",
          level: "recommended",
          status: statusFrom(
            filledCount([
              access?.startAddress,
              access?.finishAddress,
              access?.officialParkings,
              access?.shuttles,
              access?.shuttleSchedule,
              access?.roadRestrictions,
              access?.mapUrl,
              access?.note,
              activeRace.organizerDetails?.runnerInfo.startArea,
              activeRace.organizerDetails?.runnerInfo.briefing,
              activeRace.organizerDetails?.runnerInfo.rules,
              activeRace.organizerDetails?.runnerInfo.note,
            ]),
            12,
            2
          ),
          countLabel: hasText(activeRace.organizerDetails?.access.startAddress) ? "Spécifique" : hasText(access?.startAddress) ? "Hérité" : "Non renseigné",
          missingLabels: formatAccessMissingLabels,
        },
        {
          id: "aidStations",
          title: "Ravitos",
          description: "Points de course, services, barrières et produits du format.",
          level: "recommended",
          status: aidStations.length > 0 ? "complete" : "empty",
          countLabel: `${aidStations.length} ravito${aidStations.length > 1 ? "s" : ""}${aidStations.length > 0 ? ` - ${linkedStationProductCount} produit${linkedStationProductCount > 1 ? "s" : ""}` : ""}`,
          missingLabels: aidStations.length > 0 ? [] : ["Ravitos"],
        },
      ]
    : [];

  const score = scoreModules(modules);
  const eventScore = scoreModules(eventModules);
  const formatScore = scoreModules(formatModules);

  return {
    score,
    eventScore,
    formatScore,
    requiredComplete: isEventReadyToPublish(event),
    modules,
    eventModules,
    formatModules,
  };
}
