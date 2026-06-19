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
};

export type OrganizerCompletionSummary = {
  score: number;
  requiredComplete: boolean;
  modules: OrganizerModuleSummary[];
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
  hasText(event.name) && hasText(event.location) && hasText(event.race_date) && event.races.some(isPublishableRace);

const statusFrom = (filled: number, total: number, requiredFilled = total): OrganizerModuleStatus => {
  if (filled <= 0) return "empty";
  if (filled >= requiredFilled) return "complete";
  return "incomplete";
};

export function buildOrganizerCompletion(
  event: CompletionEvent,
  activeRace: CompletionRace | null,
  aidStations: CompletionAidStation[],
  stationProducts: CompletionStationProduct[]
): OrganizerCompletionSummary {
  const eventFilled = filledCount([event.name, event.location, event.race_date]);
  const publishableRaceCount = event.races.filter(isPublishableRace).length;
  const formatCount = event.races.length;
  const gpxCount = event.races.filter((race) => hasText(race.gpx_storage_path)).length;
  const eventDetails = event.organizerDetails ?? defaultOrganizerEventDetails;
  const runnerDetails = buildRunnerOrganizerDetails(eventDetails, activeRace?.organizerDetails);
  const schedule = runnerDetails.schedule;
  const equipmentItems = runnerDetails.equipment.items;
  const commonEquipmentCount = runnerDetails.commonEquipment.items.length;
  const raceEquipmentCount = runnerDetails.raceEquipment.items.length;
  const bibPickup = runnerDetails.bibPickup;
  const access = runnerDetails.access;
  const services = runnerDetails.services;
  const linkedStationProductCount = stationProducts.length;
  const stationsWithDetails = aidStations.filter((station) => {
    const details = station.organizerDetails;
    return Boolean(
      details &&
        (details.stationType !== "water" ||
          details.cumulativeElevationGainM !== null ||
          details.cumulativeElevationLossM !== null ||
          details.altitudeM !== null ||
          hasText(details.cutoffTime) ||
          details.dropBagAvailable ||
          hasText(details.organizerNote))
    );
  }).length;

  const modules: OrganizerModuleSummary[] = [
    {
      id: "event",
      title: "Informations evenement",
      description: "Nom, date, lieu et statut public.",
      level: "required",
      status: statusFrom(eventFilled, 3),
      countLabel: `${eventFilled}/3 champs`,
    },
    {
      id: "formats",
      title: "Formats & GPX",
      description: "Formats de course, distances, deniveles et traces GPX.",
      level: "required",
      status: publishableRaceCount > 0 ? "complete" : formatCount > 0 ? "incomplete" : "empty",
      countLabel: `${formatCount} format${formatCount > 1 ? "s" : ""}, ${gpxCount} GPX`,
    },
    {
      id: "aidStations",
      title: "Ravitos & points de course",
      description: "Liste rapide des ravitos et services disponibles.",
      level: "recommended",
      status: aidStations.length > 0 ? "complete" : "empty",
      countLabel: `${aidStations.length} ravito${aidStations.length > 1 ? "s" : ""}`,
    },
    {
      id: "equipment",
      title: "Materiel commun / format",
      description: "Materiel commun evenement et specifique au format actif.",
      level: "recommended",
      status: equipmentItems.length > 0 ? "complete" : hasText(runnerDetails.equipment.note) ? "incomplete" : "empty",
      countLabel: `${commonEquipmentCount} commun / ${raceEquipmentCount} format`,
    },
    {
      id: "schedule",
      title: "Horaires & barrieres",
      description: "Depart, limite arrivee, navettes et synthese barrieres.",
      level: "recommended",
      status: statusFrom(filledCount([schedule?.startTime, schedule?.finishCutoffTime, schedule?.cutoffNote]), 3, 1),
      countLabel: activeRace ? `${stationsWithDetails} point${stationsWithDetails > 1 ? "s" : ""} detaille${stationsWithDetails > 1 ? "s" : ""}` : "Aucun format",
    },
    {
      id: "bibPickup",
      title: "Dossard commun / format",
      description: "Commun evenement avec surcharge possible par format.",
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
      countLabel: hasText(bibPickup?.location) ? "Lieu renseigne" : "Non renseigne",
    },
    {
      id: "access",
      title: "Acces & infos format",
      description: "Acces commun avec surcharge possible par format.",
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
      countLabel: hasText(access?.officialParkings) || hasText(access?.shuttles) ? "Infos transport" : "Non renseigne",
    },
    {
      id: "products",
      title: "Produits aux ravitos",
      description: "Produits officiels disponibles sur les points de course.",
      level: "optional",
      status: linkedStationProductCount > 0 ? "complete" : "empty",
      countLabel: `${linkedStationProductCount} produit${linkedStationProductCount > 1 ? "s" : ""}`,
    },
    {
      id: "services",
      title: "Partenaires / services",
      description: "Accompagnants, hebergement, restauration, recup, partenaires.",
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
      countLabel: hasText(services?.partners) ? "Partenaires renseignes" : "Optionnel",
    },
    {
      id: "preview",
      title: "Previsualisation coureur",
      description: "Version simple de ce que verra un coureur.",
      level: "optional",
      status: isEventReadyToPublish(event) ? "complete" : "incomplete",
      countLabel: isEventReadyToPublish(event) ? "Pret" : "Essentiel manquant",
    },
  ];

  const score = Math.round((modules.filter((module) => module.status === "complete").length / modules.length) * 100);

  return {
    score,
    requiredComplete: isEventReadyToPublish(event),
    modules,
  };
}
