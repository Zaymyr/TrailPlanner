import { loadOrganizerEditionEntitlement } from "./organizer-entitlements";
import { isOrganizerModuleAvailable } from "./organizer-modules";
import type { RacebookPartnerSlotKey } from "./racebook-partner-slots";
import { loadCurrentRacebookPublication } from "./racebook-publications";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Resolves the published organizer partner of one slot for a race, only while
 * the edition keeps the Signature sponsors module. Returns null otherwise.
 */
export async function loadPublishedPartnerSlotTarget(
  config: SupabaseServiceConfig,
  raceId: string,
  slot: RacebookPartnerSlotKey,
) {
  const { publication } = await loadCurrentRacebookPublication(config, raceId);
  if (!publication?.content.modules.sponsors) return null;
  const entitlement = await loadOrganizerEditionEntitlement(config, publication.edition_id);
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  if (!isOrganizerModuleAvailable(tier, "sponsors")) return null;
  const target = (publication.content.partnerSlots ?? []).find((candidate) => candidate.slot === slot);
  return target?.mode === "partner" && target.partner ? target.partner : null;
}
