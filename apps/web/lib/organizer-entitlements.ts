import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

export const organizerTierSchema = z.enum(["visibility", "essential", "complete", "signature"]);
export type OrganizerTier = z.infer<typeof organizerTierSchema>;

export const organizerCapabilitySchema = z.enum([
  "catalog.manage",
  "racebook.publish",
  "racebook_content.basic.manage",
  "racebook_content.advanced.manage",
  "followers.notify",
  "edition.duplicate",
  "relay.manage",
  "aid_station_products.manage",
  "sponsors.manage",
  "branding.manage",
  "assisted_import.request",
  "racebook_analytics.view",
]);
export type OrganizerCapability = z.infer<typeof organizerCapabilitySchema>;

export const ORGANIZER_TIER_CAPABILITIES: Record<OrganizerTier, readonly OrganizerCapability[]> = {
  visibility: ["catalog.manage"],
  essential: ["catalog.manage", "racebook.publish", "racebook_content.basic.manage"],
  complete: [
    "catalog.manage",
    "racebook.publish",
    "racebook_content.basic.manage",
    "racebook_content.advanced.manage",
    "followers.notify",
    "edition.duplicate",
  ],
  signature: [
    "catalog.manage",
    "racebook.publish",
    "racebook_content.basic.manage",
    "racebook_content.advanced.manage",
    "followers.notify",
    "edition.duplicate",
    "relay.manage",
    "aid_station_products.manage",
    "sponsors.manage",
    "branding.manage",
    "assisted_import.request",
    "racebook_analytics.view",
  ],
};

export const complimentaryOrganizerCapabilitySchema = z.enum(["racebook_analytics.view"]);
export type ComplimentaryOrganizerCapability = z.infer<typeof complimentaryOrganizerCapabilitySchema>;

export type OrganizerEditionEntitlement = {
  id: string;
  editionId: string;
  tier: OrganizerTier;
  source: "system" | "stripe" | "manual_payment" | "admin" | "complimentary" | "legacy_admin";
  status: "active" | "revoked";
  activatedAt: string | null;
  revokedAt: string | null;
};

export type OrganizerEditionCapabilityGrant = {
  id: string;
  editionId: string;
  capabilityKey: ComplimentaryOrganizerCapability;
  status: "active" | "revoked";
  grantedBy: string | null;
  grantedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
};

export type OrganizerCapabilityAccess = {
  allowed: boolean;
  source: "tier" | "complimentary" | null;
};

const entitlementRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  tier: organizerTierSchema,
  source: z.enum(["system", "stripe", "manual_payment", "admin", "complimentary", "legacy_admin"]),
  status: z.enum(["active", "revoked"]),
  activated_at: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
});

const capabilityGrantRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  capability_key: complimentaryOrganizerCapabilitySchema,
  status: z.enum(["active", "revoked"]),
  granted_by: z.string().uuid().nullable().optional(),
  granted_at: z.string().nullable().optional(),
  revoked_by: z.string().uuid().nullable().optional(),
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

const mapCapabilityGrant = (
  row: z.infer<typeof capabilityGrantRowSchema>
): OrganizerEditionCapabilityGrant => ({
  id: row.id,
  editionId: row.edition_id,
  capabilityKey: row.capability_key,
  status: row.status,
  grantedBy: row.granted_by ?? null,
  grantedAt: row.granted_at ?? null,
  revokedBy: row.revoked_by ?? null,
  revokedAt: row.revoked_at ?? null,
});

export const hasOrganizerCapability = (
  entitlement: Pick<OrganizerEditionEntitlement, "tier" | "status"> | null | undefined,
  capability: OrganizerCapability
) =>
  entitlement?.status === "active" && ORGANIZER_TIER_CAPABILITIES[entitlement.tier].includes(capability);

export const resolveOrganizerCapabilityAccess = (
  entitlement: Pick<OrganizerEditionEntitlement, "tier" | "status"> | null | undefined,
  grants: readonly Pick<OrganizerEditionCapabilityGrant, "capabilityKey" | "status">[] | null | undefined,
  capability: OrganizerCapability
): OrganizerCapabilityAccess => {
  if (hasOrganizerCapability(entitlement, capability)) return { allowed: true, source: "tier" };

  const complimentaryCapability = complimentaryOrganizerCapabilitySchema.safeParse(capability);
  if (
    complimentaryCapability.success &&
    grants?.some(
      (grant) => grant.capabilityKey === complimentaryCapability.data && grant.status === "active"
    )
  ) {
    return { allowed: true, source: "complimentary" };
  }

  return { allowed: false, source: null };
};

export const hasEffectiveOrganizerCapability = (
  entitlement: Pick<OrganizerEditionEntitlement, "tier" | "status"> | null | undefined,
  grants: readonly Pick<OrganizerEditionCapabilityGrant, "capabilityKey" | "status">[] | null | undefined,
  capability: OrganizerCapability
) => resolveOrganizerCapabilityAccess(entitlement, grants, capability).allowed;

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

export async function loadOrganizerEditionCapabilityGrant(
  config: SupabaseServiceConfig,
  editionId: string,
  capability: ComplimentaryOrganizerCapability
): Promise<OrganizerEditionCapabilityGrant | null> {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_edition_capability_grants?edition_id=eq.${encodeURIComponent(
      editionId
    )}&capability_key=eq.${encodeURIComponent(
      capability
    )}&select=id,edition_id,capability_key,status,granted_by,granted_at,revoked_by,revoked_at&limit=1`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );

  if (!response.ok) throw new Error(`Unable to load organizer edition capability grant: ${await response.text()}`);
  const row = z.array(capabilityGrantRowSchema).parse(await response.json())[0] ?? null;
  return row ? mapCapabilityGrant(row) : null;
}

export async function loadOrganizerEditionCapabilityGrants(
  config: SupabaseServiceConfig,
  editionIds: string[]
): Promise<Record<string, OrganizerEditionCapabilityGrant[]>> {
  const uniqueIds = Array.from(new Set(editionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_edition_capability_grants?edition_id=in.(${uniqueIds.join(
      ","
    )})&select=id,edition_id,capability_key,status,granted_by,granted_at,revoked_by,revoked_at`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`Unable to load organizer edition capability grants: ${await response.text()}`);
  }

  return z
    .array(capabilityGrantRowSchema)
    .parse(await response.json())
    .reduce<Record<string, OrganizerEditionCapabilityGrant[]>>((result, row) => {
      (result[row.edition_id] ??= []).push(mapCapabilityGrant(row));
      return result;
    }, {});
}

export async function requireOrganizerEditionCapability(
  config: SupabaseServiceConfig,
  editionId: string | null | undefined,
  capability: OrganizerCapability
): Promise<boolean> {
  if (!editionId) return false;
  const entitlement = await loadOrganizerEditionEntitlement(config, editionId);
  if (hasOrganizerCapability(entitlement, capability)) return true;

  const complimentaryCapability = complimentaryOrganizerCapabilitySchema.safeParse(capability);
  if (!complimentaryCapability.success) return false;

  const grant = await loadOrganizerEditionCapabilityGrant(config, editionId, complimentaryCapability.data);
  return hasEffectiveOrganizerCapability(entitlement, grant ? [grant] : [], capability);
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
