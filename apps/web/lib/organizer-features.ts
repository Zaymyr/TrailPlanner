import { z } from "zod";

import type { OrganizerTier } from "./organizer-entitlements";

export const organizerFeatureKeySchema = z.enum([
  "module.services",
  "module.start_waves",
  "module.awards",
  "advanced.format_equipment",
  "advanced.format_bib_pickup",
  "advanced.format_access",
  "capability.followers_notify",
  "capability.edition_duplicate",
  "module.branding",
  "module.sponsors",
  "module.relay",
  "module.official_products",
  "capability.assisted_import",
  "capability.racebook_analytics",
]);

export type OrganizerFeatureKey = z.infer<typeof organizerFeatureKeySchema>;

export type OrganizerFeatureDefinition = {
  key: OrganizerFeatureKey;
  label: string;
  minimumTier: "complete" | "signature";
};

export const ORGANIZER_FEATURES: readonly OrganizerFeatureDefinition[] = [
  { key: "module.services", label: "Services & alentours", minimumTier: "complete" },
  { key: "module.start_waves", label: "SAS", minimumTier: "complete" },
  { key: "module.awards", label: "Podiums & récompenses", minimumTier: "complete" },
  { key: "advanced.format_equipment", label: "Matériel par format", minimumTier: "complete" },
  { key: "advanced.format_bib_pickup", label: "Dossard par format", minimumTier: "complete" },
  { key: "advanced.format_access", label: "Accès par format", minimumTier: "complete" },
  { key: "capability.followers_notify", label: "Notifications aux abonnés", minimumTier: "complete" },
  { key: "capability.edition_duplicate", label: "Duplication annuelle", minimumTier: "complete" },
  { key: "module.branding", label: "Identité visuelle", minimumTier: "signature" },
  { key: "module.sponsors", label: "Sponsors", minimumTier: "signature" },
  { key: "module.relay", label: "Relais", minimumTier: "signature" },
  { key: "module.official_products", label: "Produits officiels", minimumTier: "signature" },
  { key: "capability.assisted_import", label: "Import assisté", minimumTier: "signature" },
  { key: "capability.racebook_analytics", label: "Statistiques Livret coureur", minimumTier: "signature" },
] as const;

const tierRank: Record<OrganizerTier, number> = { visibility: 0, essential: 1, complete: 2, signature: 3 };

export const giftableOrganizerFeatures = (tier: OrganizerTier, features = ORGANIZER_FEATURES) =>
  features.filter((feature) => tierRank[feature.minimumTier] > tierRank[tier]);

export const organizerFeatureForModule = (moduleKey: string): OrganizerFeatureKey | null => {
  const key = `module.${moduleKey}`;
  return organizerFeatureKeySchema.safeParse(key).success ? key as OrganizerFeatureKey : null;
};

export const organizerFeatureForCapability = (capability: string): OrganizerFeatureKey | null => ({
  "followers.notify": "capability.followers_notify",
  "edition.duplicate": "capability.edition_duplicate",
  "assisted_import.request": "capability.assisted_import",
  "racebook_analytics.view": "capability.racebook_analytics",
} as Record<string, OrganizerFeatureKey | undefined>)[capability] ?? null;

export function calculateOrganizerInvoiceAmounts(input: {
  packCatalogCents: number;
  packNetCents: number;
}) {
  if (!Number.isInteger(input.packCatalogCents) || !Number.isInteger(input.packNetCents)
    || input.packNetCents < 0 || input.packNetCents > input.packCatalogCents) {
    throw new Error("Invalid organizer invoice amounts.");
  }
  return {
    originalSubtotal: input.packCatalogCents,
    discountTotal: input.packCatalogCents - input.packNetCents,
    netTotal: input.packNetCents,
  };
}
