import type { FuelType } from '../../../../lib/fuel-types';
import type { AidStationType } from '../../../../lib/organizer-dashboard-details';
import type { OrganizerModuleId } from '../completion';
import type { ProductFormValues } from './types';

export const equipmentSuggestions = [
  "Couverture de survie",
  "Téléphone chargé",
  "Réserve d'eau",
  "Réserve alimentaire",
  "Veste imperméable",
  "Gobelet personnel",
  "Lampe frontale",
  "Sifflet",
  "Pièce d'identité",
];

export const aidStationTypeLabels: Record<AidStationType, string> = {
  water: "Eau",
  solid: "Solide",
  assistance: "Assistance",
  life_base: "Base vie",
  other: "Autre",
};

export const fuelTypeLabels: Record<FuelType, string> = {
  gel: "Gel",
  drink_mix: "Boisson",
  electrolyte: "Électrolytes",
  capsule: "Capsule",
  bar: "Barre",
  real_food: "Aliment",
  other: "Autre",
};

export const productPickerQuickFilters: Array<{
  id: "all" | "gel" | "bar" | "liquid" | "capsule" | "real_food" | "other";
  label: string;
  fuelTypes?: FuelType[];
}> = [
  { id: "all", label: "Tous" },
  { id: "gel", label: "Gels", fuelTypes: ["gel"] },
  { id: "bar", label: "Barres", fuelTypes: ["bar"] },
  { id: "liquid", label: "Liquides", fuelTypes: ["drink_mix", "electrolyte"] },
  { id: "capsule", label: "Capsules", fuelTypes: ["capsule"] },
  { id: "real_food", label: "Aliments", fuelTypes: ["real_food"] },
  { id: "other", label: "Autres", fuelTypes: ["other"] },
];

export const emptyProductForm: ProductFormValues = {
  name: "",
  brand: "",
  sku: "",
  fuelType: "other",
  productUrl: "",
  caloriesKcal: 0,
  carbsGrams: 0,
  sodiumMg: 0,
  proteinGrams: 0,
  fatGrams: 0,
  notes: "",
};

export const EVENT_TAB_ID = "__event";
export const ADD_FORMAT_TAB_ID = "__add";
export const MAX_EVENT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const EVENT_MODULE_IDS: OrganizerModuleId[] = ["event", "equipment", "bibPickup", "access", "services"];
export const FORMAT_MODULE_IDS: OrganizerModuleId[] = ["formats", "schedule", "equipment", "bibPickup", "access", "aidStations", "products"];
