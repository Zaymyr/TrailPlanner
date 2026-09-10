import { z } from "zod";

import { loadOrganizerModuleSettings } from "./organizer-module-settings";
import { getMinimumOrganizerPublicationTier, type OrganizerAdvancedGroupKey, type OrganizerModuleKey } from "./organizer-modules";
import type { SupabaseServiceConfig } from "./supabase";

const headers = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

async function hasRows(config: SupabaseServiceConfig, path: string) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { headers: headers(config), cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to inspect organizer publication content (${response.status})`);
  return z.array(z.unknown()).parse(await response.json()).length > 0;
}

export async function loadOrganizerPublicationRequirement(config: SupabaseServiceConfig, editionId: string) {
  const [racesResponse, editionResponse] = await Promise.all([
    fetch(`${config.supabaseUrl}/rest/v1/races?edition_id=eq.${encodeURIComponent(editionId)}&select=id,organizer_details`, { headers: headers(config), cache: "no-store" }),
    fetch(`${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${encodeURIComponent(editionId)}&select=event_id&limit=1`, { headers: headers(config), cache: "no-store" }),
  ]);
  if (!racesResponse.ok || !editionResponse.ok) throw new Error("Unable to inspect organizer publication scope");
  const races = z.array(z.object({ id: z.string().uuid(), organizer_details: z.unknown().nullable().optional() })).parse(await racesResponse.json());
  const raceIds = races.map((race) => race.id);
  const eventId = z.array(z.object({ event_id: z.string().uuid() })).parse(await editionResponse.json())[0]?.event_id ?? null;
  const eventResponse = eventId
    ? await fetch(`${config.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=organizer_details&limit=1`, { headers: headers(config), cache: "no-store" })
    : null;
  if (eventResponse && !eventResponse.ok) throw new Error("Unable to inspect organizer event content");
  const eventDetails = eventResponse
    ? z.array(z.object({ organizer_details: z.unknown().nullable().optional() })).parse(await eventResponse.json())[0]?.organizer_details
    : null;
  const settings = await loadOrganizerModuleSettings(config, editionId, raceIds);
  const used = new Set<OrganizerModuleKey>();
  const usedAdvancedGroups = new Set<OrganizerAdvancedGroupKey>();

  // Essentiel is the publication baseline. Only populated advanced sections can raise the recommendation.
  for (const key of ["equipment", "bib_pickup", "access", "aid_stations"] as const) {
    const selected = key === "aid_stations"
      ? raceIds.some((raceId) => settings.races[raceId]?.aid_stations)
      : settings.edition[key];
    if (selected) used.add(key);
  }

  const raceFilter = raceIds.length > 0 ? `in.(${raceIds.join(",")})` : null;
  const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  for (const race of races) {
    const details = asRecord(race.organizer_details);
    const equipment = asRecord(details.mandatoryEquipment);
    const bib = asRecord(details.bibPickup);
    const access = asRecord(details.access);
    if (equipment.overrideEnabled === true && (Array.isArray(equipment.items) && equipment.items.length > 0 || hasText(equipment.note))) usedAdvancedGroups.add("format_equipment");
    if (bib.overrideEnabled === true && ([bib.location, bib.schedule, bib.requiredDocuments, bib.note].some(hasText) || Array.isArray(bib.locations) && bib.locations.length > 0)) usedAdvancedGroups.add("format_bib_pickup");
    if (access.overrideEnabled === true && Object.entries(access).some(([key, value]) => key !== "overrideEnabled" && hasText(value))) usedAdvancedGroups.add("format_access");
  }
  const legacyServices = asRecord(asRecord(eventDetails).services);
  const hasLegacyServices = Object.entries(legacyServices).some(([key, value]) => key !== "lastMinuteMessage" && hasText(value));
  const checks: Array<Promise<[OrganizerModuleKey, boolean]>> = [
    hasRows(config, `race_edition_services?edition_id=eq.${encodeURIComponent(editionId)}&select=id&limit=1`)
      .then((present) => ["services", Boolean(settings.edition.services && (present || hasLegacyServices))]),
    hasRows(config, `race_event_edition_branding?edition_id=eq.${encodeURIComponent(editionId)}&select=edition_id&limit=1`)
      .then((present) => ["branding", Boolean(settings.edition.branding && present)]),
    hasRows(config, `race_event_edition_sponsors?edition_id=eq.${encodeURIComponent(editionId)}&select=id&limit=1`)
      .then((present) => ["sponsors", Boolean(settings.edition.sponsors && present)]),
  ];

  if (raceFilter) {
    checks.push(
      hasRows(config, `race_start_waves?race_id=${raceFilter}&select=id&limit=1`)
        .then((present) => ["start_waves", present && raceIds.some((raceId) => settings.races[raceId]?.start_waves)]),
      hasRows(config, `race_awards?race_id=${raceFilter}&select=id&limit=1`)
        .then((present) => ["awards", present && raceIds.some((raceId) => settings.races[raceId]?.awards)]),
      hasRows(config, `race_relay_points?race_id=${raceFilter}&select=id&limit=1`)
        .then((present) => ["relay", present && raceIds.some((raceId) => settings.races[raceId]?.relay)]),
      hasRows(config, `race_aid_station_products?select=id,race_aid_stations!inner(race_id)&race_aid_stations.race_id=${raceFilter}&limit=1`)
        .then((present) => ["official_products", present && raceIds.some((raceId) => settings.races[raceId]?.official_products)]),
    );
  }

  for (const [key, present] of await Promise.all(checks)) if (present) used.add(key);
  return {
    tier: getMinimumOrganizerPublicationTier(used, usedAdvancedGroups),
    usedModules: [...used],
    usedAdvancedGroups: [...usedAdvancedGroups],
  };
}
