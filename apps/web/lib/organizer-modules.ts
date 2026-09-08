import { z } from "zod";

import type { OrganizerCapability, OrganizerTier } from "./organizer-entitlements";

export const organizerEditionModuleKeySchema = z.enum([
  "equipment",
  "bib_pickup",
  "access",
  "services",
  "branding",
  "sponsors",
]);
export const organizerRaceModuleKeySchema = z.enum([
  "aid_stations",
  "start_waves",
  "awards",
  "relay",
  "official_products",
]);
export const organizerModuleKeySchema = z.union([organizerEditionModuleKeySchema, organizerRaceModuleKeySchema]);

export type OrganizerEditionModuleKey = z.infer<typeof organizerEditionModuleKeySchema>;
export type OrganizerRaceModuleKey = z.infer<typeof organizerRaceModuleKeySchema>;
export type OrganizerModuleKey = z.infer<typeof organizerModuleKeySchema>;
export type OrganizerModuleState = "active" | "inactive" | "locked";

export type OrganizerModuleDefinition = {
  key: OrganizerModuleKey;
  label: string;
  description: string;
  scope: "edition" | "race";
  minimumTier: Exclude<OrganizerTier, "visibility">;
  capability: OrganizerCapability;
  defaultEnabled: boolean;
};

export const ORGANIZER_TIER_RANK: Record<OrganizerTier, number> = {
  visibility: 0,
  essential: 1,
  complete: 2,
  signature: 3,
};

export const ORGANIZER_TIER_LABEL: Record<OrganizerTier, string> = {
  visibility: "Visibilité",
  essential: "Essentiel",
  complete: "Complet",
  signature: "Signature",
};

export const ORGANIZER_TIER_PRICE_EUR: Record<Exclude<OrganizerTier, "visibility">, number> = {
  essential: 99,
  complete: 199,
  signature: 349,
};

export const ORGANIZER_MODULES: readonly OrganizerModuleDefinition[] = [
  { key: "equipment", label: "Matériel", description: "Matériel obligatoire et conseillé.", scope: "edition", minimumTier: "essential", capability: "racebook_content.basic.manage", defaultEnabled: true },
  { key: "bib_pickup", label: "Dossard", description: "Lieux, créneaux et documents de retrait.", scope: "edition", minimumTier: "essential", capability: "racebook_content.basic.manage", defaultEnabled: true },
  { key: "access", label: "Accès", description: "Départ, arrivée, parkings et informations pratiques.", scope: "edition", minimumTier: "essential", capability: "racebook_content.basic.manage", defaultEnabled: true },
  { key: "services", label: "Services & alentours", description: "Hébergement, restauration et récupération.", scope: "edition", minimumTier: "complete", capability: "racebook_content.advanced.manage", defaultEnabled: false },
  { key: "branding", label: "Identité visuelle", description: "Logo et couleurs du RaceBook.", scope: "edition", minimumTier: "signature", capability: "branding.manage", defaultEnabled: false },
  { key: "sponsors", label: "Sponsors", description: "Placements partenaires et clics agrégés.", scope: "edition", minimumTier: "signature", capability: "sponsors.manage", defaultEnabled: false },
  { key: "aid_stations", label: "Ravitos", description: "Ravitaillements et services disponibles.", scope: "race", minimumTier: "essential", capability: "racebook_content.basic.manage", defaultEnabled: true },
  { key: "start_waves", label: "SAS", description: "Vagues, horaires et critères de départ.", scope: "race", minimumTier: "complete", capability: "racebook_content.advanced.manage", defaultEnabled: false },
  { key: "awards", label: "Podiums & récompenses", description: "Catégories, horaires et récompenses.", scope: "race", minimumTier: "complete", capability: "racebook_content.advanced.manage", defaultEnabled: false },
  { key: "relay", label: "Relais", description: "Passages de témoin et segments relais.", scope: "race", minimumTier: "signature", capability: "relay.manage", defaultEnabled: false },
  { key: "official_products", label: "Produits officiels", description: "Produits proposés à chaque ravitaillement.", scope: "race", minimumTier: "signature", capability: "aid_station_products.manage", defaultEnabled: false },
] as const;

const byKey = new Map(ORGANIZER_MODULES.map((module) => [module.key, module]));

export const getOrganizerModule = (key: OrganizerModuleKey) => byKey.get(key)!;
export const isOrganizerModuleAvailable = (tier: OrganizerTier, key: OrganizerModuleKey) =>
  ORGANIZER_TIER_RANK[tier] >= ORGANIZER_TIER_RANK[getOrganizerModule(key).minimumTier];
export const getOrganizerModuleState = (tier: OrganizerTier, key: OrganizerModuleKey, enabled: boolean): OrganizerModuleState =>
  !isOrganizerModuleAvailable(tier, key) ? "locked" : enabled ? "active" : "inactive";

export const defaultEditionModuleSettings = Object.fromEntries(
  ORGANIZER_MODULES.filter((module) => module.scope === "edition").map((module) => [module.key, module.defaultEnabled]),
) as Record<OrganizerEditionModuleKey, boolean>;

export const defaultRaceModuleSettings = Object.fromEntries(
  ORGANIZER_MODULES.filter((module) => module.scope === "race").map((module) => [module.key, module.defaultEnabled]),
) as Record<OrganizerRaceModuleKey, boolean>;

export const organizerModuleUpdateSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("edition"), moduleKey: organizerEditionModuleKeySchema, enabled: z.boolean() }),
  z.object({ scope: z.literal("race"), raceId: z.string().uuid(), moduleKey: organizerRaceModuleKeySchema, enabled: z.boolean() }),
]);

export const organizerModuleSettingsPatchSchema = z.object({
  updates: z.array(organizerModuleUpdateSchema).max(50).default([]),
  setupCompleted: z.boolean().optional(),
});
