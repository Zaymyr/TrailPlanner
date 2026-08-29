import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

export const organizerTierSchema = z.enum(["visibility", "racebook", "pro"]);
export type OrganizerTier = z.infer<typeof organizerTierSchema>;

export const organizerCapabilitySchema = z.enum([
  "catalog.manage",
  "racebook.publish",
  "followers.notify",
  "edition.duplicate",
  "relay.manage",
  "aid_station_products.manage",
  "assisted_import.request",
]);
export type OrganizerCapability = z.infer<typeof organizerCapabilitySchema>;

export const ORGANIZER_TIER_CAPABILITIES: Record<OrganizerTier, readonly OrganizerCapability[]> = {
  visibility: ["catalog.manage"],
  racebook: ["catalog.manage", "racebook.publish"],
  pro: [
    "catalog.manage",
    "racebook.publish",
    "followers.notify",
    "edition.duplicate",
    "relay.manage",
    "aid_station_products.manage",
    "assisted_import.request",
  ],
};

export type OrganizerEditionEntitlement = {
  id: string;
  editionId: string;
  tier: OrganizerTier;
  source: "system" | "stripe" | "admin" | "legacy_admin";
  status: "active" | "revoked";
  activatedAt: string | null;
  revokedAt: string | null;
};

const entitlementRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  tier: organizerTierSchema,
  source: z.enum(["system", "stripe", "admin", "legacy_admin"]),
  status: z.enum(["active", "revoked"]),
  activated_at: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
});

const serviceHeaders = (config: SupabaseServiceConfig, contentType = "") => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const mapEntitlement = (row: z.infer<typeof entitlementRowSchema>): OrganizerEditionEntitlement => ({
  id: row.id,
  editionId: row.edition_id,
  tier: row.status === "active" ? row.tier : "visibility",
  source: row.source,
  status: row.status,
  activatedAt: row.activated_at ?? null,
  revokedAt: row.revoked_at ?? null,
});

export const hasOrganizerCapability = (
  entitlement: Pick<OrganizerEditionEntitlement, "tier" | "status"> | null | undefined,
  capability: OrganizerCapability
) =>
  entitlement?.status === "active" && ORGANIZER_TIER_CAPABILITIES[entitlement.tier].includes(capability);

export async function loadOrganizerEditionEntitlement(
  config: SupabaseServiceConfig,
  editionId: string
): Promise<OrganizerEditionEntitlement | null> {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_edition_entitlements?edition_id=eq.${encodeURIComponent(
      editionId
    )}&select=id,edition_id,tier,source,status,activated_at,revoked_at&limit=1`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );

  if (!response.ok) throw new Error(`Unable to load organizer edition entitlement: ${await response.text()}`);
  const row = z.array(entitlementRowSchema).parse(await response.json())[0] ?? null;
  return row ? mapEntitlement(row) : null;
}

export async function loadOrganizerEditionEntitlements(
  config: SupabaseServiceConfig,
  editionIds: string[]
): Promise<Record<string, OrganizerEditionEntitlement>> {
  const uniqueIds = Array.from(new Set(editionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_edition_entitlements?edition_id=in.(${uniqueIds.join(
      ","
    )})&select=id,edition_id,tier,source,status,activated_at,revoked_at`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );
  if (!response.ok) throw new Error(`Unable to load organizer edition entitlements: ${await response.text()}`);

  return z.array(entitlementRowSchema).parse(await response.json()).reduce<Record<string, OrganizerEditionEntitlement>>(
    (result, row) => {
      result[row.edition_id] = mapEntitlement(row);
      return result;
    },
    {}
  );
}

export async function requireOrganizerEditionCapability(
  config: SupabaseServiceConfig,
  editionId: string | null | undefined,
  capability: OrganizerCapability
): Promise<boolean> {
  if (!editionId) return false;
  return hasOrganizerCapability(await loadOrganizerEditionEntitlement(config, editionId), capability);
}

export async function requireOrganizerRaceCapability(
  config: SupabaseServiceConfig,
  raceId: string,
  capability: OrganizerCapability
): Promise<boolean> {
  const raceResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${encodeURIComponent(raceId)}&select=edition_id&limit=1`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );
  if (!raceResponse.ok) throw new Error(`Unable to load organizer race edition: ${await raceResponse.text()}`);
  const race = z.array(z.object({ edition_id: z.string().uuid().nullable().optional() })).parse(await raceResponse.json())[0];
  return requireOrganizerEditionCapability(config, race?.edition_id, capability);
}
