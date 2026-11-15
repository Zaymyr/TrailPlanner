import { loadOrganizerEditionCapabilityGrants, loadOrganizerEditionEntitlement } from "./organizer-entitlements";
import { isOrganizerModuleAvailable, ORGANIZER_MODULES } from "./organizer-modules";
import { loadCurrentRacebookPublication, moduleMask, publicSnapshot } from "./racebook-publications";
import type { SupabaseServiceConfig } from "./supabase";

export async function loadPublishedRacebookData(
  config: SupabaseServiceConfig,
  race: { id: string; edition_id: string },
) {
  const [{ publication }, entitlement, grantMap] = await Promise.all([
    loadCurrentRacebookPublication(config, race.id),
    loadOrganizerEditionEntitlement(config, race.edition_id),
    loadOrganizerEditionCapabilityGrants(config, [race.edition_id]),
  ]);
  if (!publication) return null;

  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  const grantedFeatures = (grantMap[race.edition_id] ?? [])
    .filter((grant) => grant.status === "active")
    .map((grant) => grant.capabilityKey);
  const allowed = Object.fromEntries(
    ORGANIZER_MODULES.map((module) => [module.key, isOrganizerModuleAvailable(tier, module.key, grantedFeatures)]),
  ) as Record<(typeof ORGANIZER_MODULES)[number]["key"], boolean>;
  const modules = moduleMask(publication.content.modules, allowed);
  const snapshot = publicSnapshot(publication);

  return {
    ...snapshot,
    stationRows: modules.aid_stations ? snapshot.stationRows : [],
    supporterPointRows: modules.supporter_points ? snapshot.supporterPointRows : [],
    relayPointRows: modules.relay ? snapshot.relayPointRows : [],
    startWaveRows: modules.start_waves ? snapshot.startWaveRows : [],
    awardRows: modules.awards ? snapshot.awardRows : [],
    editionServiceRows: modules.services ? snapshot.editionServiceRows : [],
    sponsors: modules.sponsors ? snapshot.sponsors : [],
    branding: modules.branding
      ? snapshot.branding
      : { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
    modules,
  };
}
