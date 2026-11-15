import type { SupporterGuideLocation, SupporterGuidePayload, SupporterGuideService } from "@trailplanner/shared";
import { z } from "zod";

import { serviceHeaders } from "./organizer";
import { partnerLinkSettingSchema, resolvePublicPartnerLink } from "./partner-links";
import { loadPublishedRacebookData } from "./racebook-public-data";
import type { SupabaseServiceConfig } from "./supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  name: z.string(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
});

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  race_events: z.union([z.object({
    name: z.string(), location: z.string().nullable(), thumbnail_url: z.string().nullable(),
  }), z.array(z.object({ name: z.string(), location: z.string().nullable(), thumbnail_url: z.string().nullable() }))]),
});

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const firstRecord = (value: unknown) => record(Array.isArray(value) ? value[0] : value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const bool = (value: unknown) => typeof value === "boolean" ? value : null;
const clock = (value: unknown) => text(value)?.slice(0, 5) ?? null;
const stringArray = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => text(item) ? [text(item)!] : []) : [];

function location(value: unknown, fallbackAddress: unknown = null): SupporterGuideLocation {
  const source = record(value);
  return {
    label: text(source.label),
    address: text(fallbackAddress) ?? text(source.label),
    latitude: number(source.lat ?? source.latitude),
    longitude: number(source.lng ?? source.longitude),
    mapsUrl: text(source.googleMapsUrl ?? source.google_maps_url),
  };
}

function normalizeService(rowValue: unknown): SupporterGuideService | null {
  const row = record(rowValue);
  const type = text(row.service_type);
  const name = text(row.name);
  if (!name || !type || !["restaurant", "accommodation", "recovery", "other"].includes(type)) return null;
  return {
    id: String(row.id),
    type: type as SupporterGuideService["type"],
    name,
    description: text(row.description),
    location: {
      label: text(row.address), address: text(row.address), latitude: number(row.latitude), longitude: number(row.longitude), mapsUrl: text(row.google_maps_url),
    },
    websiteUrl: text(row.website_url),
    phone: text(row.phone),
  };
}

export async function loadSupporterGuide(
  config: SupabaseServiceConfig,
  editionId: string,
  organizerPreview: boolean,
  publicBaseUrl = "https://pace-yourself.com",
): Promise<SupporterGuidePayload | null> {
  const headers = serviceHeaders(config, "");
  const [editionResponse, racesResponse] = await Promise.all([
    fetch(`${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${encodeURIComponent(editionId)}&select=id,event_id,start_date,end_date,race_events(name,location,thumbnail_url)&limit=1`, { headers, cache: "no-store" }),
    fetch(`${config.supabaseUrl}/rest/v1/races?edition_id=eq.${encodeURIComponent(editionId)}&select=id,event_id,edition_id,name,is_live,racebook_is_live,racebook_preview_is_visible&order=race_date.asc,name.asc`, { headers, cache: "no-store" }),
  ]);
  if (!editionResponse.ok || !racesResponse.ok) throw new Error("Unable to load Supporter Guide edition.");
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0] ?? null;
  const candidates = z.array(raceSchema).parse(await racesResponse.json()).filter((race) =>
    race.racebook_preview_is_visible && (organizerPreview || (race.is_live && race.racebook_is_live)),
  );
  if (!edition || candidates.length === 0) return null;

  const loaded = (await Promise.all(candidates.map(async (race) => ({ race, snapshot: await loadPublishedRacebookData(config, race) }))))
    .filter((item): item is { race: z.infer<typeof raceSchema>; snapshot: NonNullable<Awaited<ReturnType<typeof loadPublishedRacebookData>>> } =>
      Boolean(item.snapshot?.modules.supporter_guide),
    );
  if (loaded.length === 0) return null;

  const formats = loaded.map(({ race, snapshot }) => {
    const raceRow = record(snapshot.raceRow);
    const raceDetails = record(raceRow.organizer_details);
    const schedule = record(raceDetails.schedule);
    return {
      raceId: race.id,
      name: text(raceRow.name) ?? race.name,
      date: text(raceRow.race_date),
      distanceKm: number(raceRow.distance_km) ?? 0,
      startTime: clock(schedule.startTime),
      finishCutoffTime: clock(schedule.finishCutoffTime),
      startWaves: snapshot.startWaveRows.flatMap((value) => {
        const row = record(value); const name = text(row.name); const time = clock(row.start_time);
        return name && time ? [{ id: String(row.id), name, time }] : [];
      }),
      awards: snapshot.awardRows.flatMap((value) => {
        const row = record(value); const label = text(row.category_label); const time = clock(row.podium_time);
        return label && time ? [{ id: String(row.id), label, time, location: text(row.podium_location) }] : [];
      }),
      supporterPoints: snapshot.supporterPointRows.flatMap((value) => {
        const row = record(value); const name = text(row.name); const km = number(row.km);
        return name && km !== null && (row.encouragement_allowed === true || row.assistance_allowed === true) ? [{
          id: String(row.id), name, km, encouragementAllowed: row.encouragement_allowed === true, assistanceAllowed: row.assistance_allowed === true,
          accessLabel: text(row.access_label), accessNote: text(row.access_note), latitude: number(row.latitude), longitude: number(row.longitude), mapsUrl: text(row.google_maps_url), planUrl: text(row.plan_url),
        }] : [];
      }),
      aidStations: snapshot.stationRows.flatMap((value) => {
        const row = record(value); const details = record(row.organizer_details); const name = text(row.name); const km = number(row.km);
        const supportersAccessValue = text(details.supportersAccess);
        const supportersAccess: "allowed" | "restricted" | "forbidden" | null =
          supportersAccessValue === "allowed" || supportersAccessValue === "restricted" || supportersAccessValue === "forbidden"
            ? supportersAccessValue
            : null;
        return name && km !== null ? [{
          id: String(row.id), name, km, assistanceAllowed: row.assistance_allowed !== false,
          supportersAccess,
          maxStopMinutes: number(details.maxStopMinutes), amenities: stringArray(details.amenities), cutoffTime: clock(details.cutoffTime),
        }] : [];
      }),
    };
  });

  const representative = loaded[0]!.snapshot;
  const eventRow = firstRecord(record(representative.raceRow).race_events);
  const eventDetails = record(eventRow.organizer_details);
  const eventAccess = record(eventDetails.access);
  const eventBib = record(eventDetails.bibPickup);
  const servicesById = new Map<string, SupporterGuideService>();
  for (const { snapshot } of loaded) for (const value of snapshot.editionServiceRows) {
    const service = normalizeService(value); if (service) servicesById.set(service.id, service);
  }
  const services = [...servicesById.values()];
  const access = loaded.flatMap(({ race, snapshot }) => {
    if (!snapshot.modules.access) return [];
    const raceDetails = record(record(snapshot.raceRow).organizer_details);
    const raceAccess = record(raceDetails.access);
    const override = raceAccess.overrideEnabled === true;
    const source = override ? raceAccess : eventAccess;
    return [{
      raceId: race.id, raceName: race.name,
      start: location(source.startLocation, source.startAddress), finish: location(source.finishLocation, source.finishAddress),
      parking: text(source.officialParkings), shuttles: text(source.shuttles), shuttleSchedule: text(source.shuttleSchedule),
      roadRestrictions: text(source.roadRestrictions), mapUrl: text(source.mapUrl),
    }];
  });
  const thirdPartyBibPickup = loaded.flatMap(({ race, snapshot }) => {
    if (!snapshot.modules.bib_pickup) return [];
    const raceBib = record(record(record(snapshot.raceRow).organizer_details).bibPickup);
    const source = raceBib.overrideEnabled === true ? raceBib : eventBib;
    return bool(source.thirdPartyPickupAllowed) === true ? [{ raceId: race.id, raceName: race.name, allowed: true, conditions: text(source.thirdPartyPickupConditions) }] : [];
  });
  const linkCandidates: Array<{ kind: SupporterGuidePayload["practical"]["links"][number]["kind"]; url: string | null }> = [
    { kind: "official", url: text(eventDetails.officialWebsiteUrl) },
    { kind: "instagram", url: text(eventDetails.instagramUrl) },
    { kind: "facebook", url: text(eventDetails.facebookUrl) },
  ];
  const links = linkCandidates.flatMap((link) => link.url ? [{ kind: link.kind, url: link.url }] : []);
  const lodgingSlot = representative.partnerSlots?.find((slot) => slot.slot === "lodging");
  let lodgingPartner: SupporterGuidePayload["lodgingPartner"] = null;
  if (lodgingSlot?.mode === "partner" && lodgingSlot.partner) {
    lodgingPartner = {
      mode: "partner", name: lodgingSlot.partner.name, logoUrl: lodgingSlot.partner.logoUrl, headline: lodgingSlot.partner.headline,
      clickUrl: new URL(`/api/racebook-partner-slots/lodging/click?raceId=${loaded[0]!.race.id}`, publicBaseUrl).toString(),
    };
  } else if (lodgingSlot?.mode !== "hidden") {
    const linkResponse = await fetch(`${config.supabaseUrl}/rest/v1/partner_link_settings?partner_key=eq.booking&is_enabled=eq.true&select=partner_key,standard_url,affiliate_url,affiliate_enabled,is_enabled,updated_at&limit=1`, { headers, cache: "no-store" });
    if (linkResponse.ok) {
      const row = (await linkResponse.json() as unknown[])[0] as Record<string, unknown> | undefined;
      if (row) {
        const setting = partnerLinkSettingSchema.safeParse({ partnerKey: row.partner_key, standardUrl: row.standard_url, affiliateUrl: row.affiliate_url, affiliateEnabled: row.affiliate_enabled, isEnabled: row.is_enabled, updatedAt: row.updated_at });
        const resolved = setting.success ? resolvePublicPartnerLink(setting.data) : null;
        if (resolved) lodgingPartner = { mode: "affiliate", name: "Booking.com", logoUrl: null, headline: null, clickUrl: resolved.url };
      }
    }
  }
  const event = Array.isArray(edition.race_events) ? edition.race_events[0] : edition.race_events;
  const publishedDates = loaded.map(({ snapshot }) => snapshot.publishedAt).filter(Boolean).sort();
  return {
    schemaVersion: 1,
    edition: { id: edition.id, eventId: edition.event_id, name: event.name, location: event.location, startDate: edition.start_date, endDate: edition.end_date, imageUrl: event.thumbnail_url },
    formats,
    onSiteServices: services.filter((service) => service.type === "recovery" || service.type === "other"),
    stayServices: services.filter((service) => service.type === "restaurant" || service.type === "accommodation"),
    lodgingPartner,
    practical: { access, thirdPartyBibPickup, emergencyPhone: text(record(eventDetails.emergencyContact).phone), links },
    publicationIds: loaded.map(({ snapshot }) => snapshot.publicationId),
    publishedAt: publishedDates.at(-1) ?? new Date(0).toISOString(),
    organizerPreview,
  };
}
