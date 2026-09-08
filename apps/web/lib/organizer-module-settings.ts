import { z } from "zod";

import { hasOrganizerCapability, loadOrganizerEditionEntitlement, type OrganizerEditionEntitlement, type OrganizerTier } from "./organizer-entitlements";
import {
  ORGANIZER_MODULES,
  defaultEditionModuleSettings,
  defaultRaceModuleSettings,
  getOrganizerModule,
  isOrganizerModuleAvailable,
  type OrganizerEditionModuleKey,
  type OrganizerModuleKey,
  type OrganizerRaceModuleKey,
} from "./organizer-modules";
import type { SupabaseServiceConfig } from "./supabase";

const rowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  race_id: z.string().uuid().nullable(),
  module_key: z.string(),
  is_enabled: z.boolean(),
});

export type OrganizerModuleSettings = {
  edition: Record<OrganizerEditionModuleKey, boolean>;
  races: Record<string, Record<OrganizerRaceModuleKey, boolean>>;
};

const headers = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

export async function loadOrganizerModuleSettings(
  config: SupabaseServiceConfig,
  editionId: string,
  raceIds: string[],
): Promise<OrganizerModuleSettings> {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_racebook_module_settings?edition_id=eq.${encodeURIComponent(editionId)}&select=id,edition_id,race_id,module_key,is_enabled`,
    { headers: headers(config), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to load organizer module settings: ${await response.text()}`);
  const rows = z.array(rowSchema).parse(await response.json());
  const edition = { ...defaultEditionModuleSettings };
  const races = Object.fromEntries(raceIds.map((raceId) => [raceId, { ...defaultRaceModuleSettings }]));

  for (const row of rows) {
    if (row.race_id) {
      if (!races[row.race_id] || !(row.module_key in defaultRaceModuleSettings)) continue;
      races[row.race_id]![row.module_key as OrganizerRaceModuleKey] = row.is_enabled;
    } else if (row.module_key in defaultEditionModuleSettings) {
      edition[row.module_key as OrganizerEditionModuleKey] = row.is_enabled;
    }
  }
  return { edition, races };
}

export const effectiveOrganizerModules = (
  tier: OrganizerTier,
  settings: OrganizerModuleSettings,
  raceId: string,
): Record<OrganizerModuleKey, boolean> => Object.fromEntries(
  ORGANIZER_MODULES.map((module) => [
    module.key,
    isOrganizerModuleAvailable(tier, module.key) && (
      module.scope === "edition"
        ? settings.edition[module.key as OrganizerEditionModuleKey]
        : settings.races[raceId]?.[module.key as OrganizerRaceModuleKey] ?? module.defaultEnabled
    ),
  ]),
) as Record<OrganizerModuleKey, boolean>;

export const canEnableOrganizerModule = (
  entitlement: Pick<OrganizerEditionEntitlement, "tier" | "status"> | null | undefined,
  moduleKey: OrganizerModuleKey,
) => hasOrganizerCapability(entitlement, getOrganizerModule(moduleKey).capability);

export async function isOrganizerEditionModuleEnabled(
  config: SupabaseServiceConfig,
  editionId: string,
  moduleKey: OrganizerEditionModuleKey,
) {
  const [settings, entitlement] = await Promise.all([
    loadOrganizerModuleSettings(config, editionId, []),
    loadOrganizerEditionEntitlement(config, editionId),
  ]);
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  return canEnableOrganizerModule(entitlement, moduleKey) && isOrganizerModuleAvailable(tier, moduleKey) && settings.edition[moduleKey];
}

export async function isOrganizerRaceModuleEnabled(
  config: SupabaseServiceConfig,
  editionId: string,
  raceId: string,
  moduleKey: OrganizerRaceModuleKey,
) {
  const [settings, entitlement] = await Promise.all([
    loadOrganizerModuleSettings(config, editionId, [raceId]),
    loadOrganizerEditionEntitlement(config, editionId),
  ]);
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  return canEnableOrganizerModule(entitlement, moduleKey) && isOrganizerModuleAvailable(tier, moduleKey) && settings.races[raceId]![moduleKey];
}
