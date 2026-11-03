import { createHash } from "crypto";
import { z } from "zod";

import { loadOrganizerEditionEntitlement } from "./organizer-entitlements";
import { effectiveOrganizerModules, loadOrganizerModuleSettings } from "./organizer-module-settings";
import { ORGANIZER_MODULES, organizerModuleKeySchema, type OrganizerModuleKey } from "./organizer-modules";
import { serviceHeaders } from "./organizer";
import { racebookBrandingRowSchema, toDraftBranding } from "./racebook-branding";
import { racebookSponsorRowSchema } from "./racebook-sponsors";
import type { SupabaseServiceConfig } from "./supabase";

const jsonObjectSchema = z.record(z.unknown());
const rowArraySchema = z.array(jsonObjectSchema);

export const racebookPublishedSponsorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().url(),
  destinationUrl: z.string().url().nullable(),
  tier: z.enum(["principal", "official", "service"]),
  category: z.string().nullable(),
  contextualPlacement: z.enum(["none", "aid_stations", "equipment", "access", "services"]),
  showOnLoading: z.boolean(),
  showInBanner: z.boolean(),
  position: z.number().int().nonnegative(),
});

export const racebookPublishedSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  raceRow: jsonObjectSchema.and(z.object({
    id: z.string().uuid(),
    event_id: z.string().uuid(),
    edition_id: z.string().uuid(),
    name: z.string(),
    distance_km: z.coerce.number(),
    race_events: z.unknown(),
  })),
  stationRows: rowArraySchema,
  relayPointRows: rowArraySchema,
  startWaveRows: rowArraySchema,
  awardRows: rowArraySchema,
  editionServiceRows: rowArraySchema,
  supporterPointRows: rowArraySchema,
  sponsors: z.array(racebookPublishedSponsorSchema),
  branding: z.object({
    logoUrl: z.string().url().nullable(),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9A-F]{6}$/),
  }),
  modules: z.record(organizerModuleKeySchema, z.boolean()),
  assets: z.object({
    gpxStoragePath: z.string().min(1).nullable(),
    imageUrls: z.array(z.string().url()),
  }),
});

export type RacebookPublishedSnapshotV1 = z.infer<typeof racebookPublishedSnapshotV1Schema>;

export const racebookPublicationStateRowSchema = z.object({
  race_id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  draft_revision: z.coerce.number().int().nonnegative(),
  current_publication_id: z.string().uuid().nullable(),
  published_source_revision: z.coerce.number().int().nonnegative().nullable(),
  last_published_at: z.string().nullable().optional(),
  last_published_by: z.string().uuid().nullable().optional(),
});

export const racebookPublicationRowSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
  schema_version: z.literal(1),
  content: racebookPublishedSnapshotV1Schema,
  content_hash: z.string().min(16),
  source_draft_revision: z.coerce.number().int().nonnegative(),
  published_by: z.string().uuid().nullable(),
  published_at: z.string(),
  restored_from_publication_id: z.string().uuid().nullable().optional(),
});

export type RacebookPublicationStateRow = z.infer<typeof racebookPublicationStateRowSchema>;
export type RacebookPublicationRow = z.infer<typeof racebookPublicationRowSchema>;

export const racebookPublicationResultSchema = z.object({
  publicationId: z.string().uuid(),
  version: z.coerce.number().int().positive(),
  sourceDraftRevision: z.coerce.number().int().nonnegative(),
  publishedAt: z.string(),
  raceId: z.string().uuid().optional(),
});

const raceSourceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  name: z.string(),
  distance_km: z.coerce.number(),
  elevation_gain_m: z.coerce.number().nullable().optional(),
  elevation_loss_m: z.coerce.number().nullable().optional(),
  plan_source_updated_at: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
  thumbnail_url: z.string().url().nullable().optional(),
  location_text: z.string().nullable().optional(),
  participation_mode: z.string().nullable().optional(),
  start_lat: z.coerce.number().nullable().optional(),
  start_lng: z.coerce.number().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  race_events: z.union([jsonObjectSchema, z.array(jsonObjectSchema)]),
});

const raceSelect = [
  "id", "event_id", "edition_id", "name", "distance_km", "elevation_gain_m", "elevation_loss_m",
  "race_date", "plan_source_updated_at", "is_live", "racebook_is_live", "racebook_preview_is_visible", "thumbnail_url",
  "location_text", "participation_mode", "start_lat", "start_lng", "organizer_details", "gpx_storage_path",
  "race_events(id,name,location,race_date,thumbnail_url,is_live,organizer_details)",
].join(",");

const collectionQueries = {
  stationRows: "race_aid_stations?race_id=eq.{raceId}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details,race_aid_station_products(id,notes,order_index,products(id,name,brand,image_url))&order=order_index.asc",
  relayPointRows: "race_relay_points?race_id=eq.{raceId}&select=id,race_aid_station_id,name,km,handover_time,cutoff_time,notes,order_index&order=order_index.asc",
  startWaveRows: "race_start_waves?race_id=eq.{raceId}&select=id,name,start_time,eligibility_type,bib_number_min,bib_number_max,finish_minutes_min,finish_minutes_max,pace_seconds_min,pace_seconds_max,eligibility_note,order_index&order=order_index.asc",
  awardRows: "race_awards?race_id=eq.{raceId}&select=id,category_key,category_label,audience,place_from,place_to,podium_time,podium_location,reward_note,order_index&order=podium_time.asc,order_index.asc",
  editionServiceRows: "race_edition_services?edition_id=eq.{editionId}&select=id,service_type,name,description,address,latitude,longitude,google_maps_url,website_url,phone,order_index&order=service_type.asc,order_index.asc",
  supporterPointRows: "race_supporter_points?race_id=eq.{raceId}&select=id,name,km,order_index,encouragement_allowed,assistance_allowed,access_label,latitude,longitude,google_maps_url,access_note,plan_url&order=order_index.asc",
} as const;

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

const valuesDiffer = (left: unknown, right: unknown) => canonicalize(left) !== canonicalize(right);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const firstRecord = (value: unknown): Record<string, unknown> => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return asRecord(candidate);
};

const changedObjectKeys = (draft: unknown, published: unknown, labels: Record<string, string>) => {
  const draftRecord = asRecord(draft);
  const publishedRecord = asRecord(published);
  return Object.entries(labels)
    .filter(([key]) => valuesDiffer(draftRecord[key], publishedRecord[key]))
    .map(([, label]) => label);
};

export function describeRacebookSnapshotChanges(
  draft: RacebookPublishedSnapshotV1,
  published: RacebookPublishedSnapshotV1 | null,
) {
  if (!published) return ["Première publication du Livret coureur"];

  const changes = new Set<string>();
  const draftRace = asRecord(draft.raceRow);
  const publishedRace = asRecord(published.raceRow);
  const draftEvent = firstRecord(draftRace.race_events);
  const publishedEvent = firstRecord(publishedRace.race_events);

  const raceIdentityKeys = [
    "name", "distance_km", "elevation_gain_m", "elevation_loss_m", "race_date", "location_text",
    "participation_mode", "start_lat", "start_lng", "thumbnail_url",
  ];
  if (raceIdentityKeys.some((key) => valuesDiffer(draftRace[key], publishedRace[key]))) {
    changes.add("Informations générales du format");
  }

  const eventIdentityKeys = ["name", "location", "race_date", "thumbnail_url"];
  if (eventIdentityKeys.some((key) => valuesDiffer(draftEvent[key], publishedEvent[key]))) {
    changes.add("Informations générales de l’événement");
  }

  changedObjectKeys(draftRace.organizer_details, publishedRace.organizer_details, {
    raceLocation: "Lieu du format",
    gpxDisplay: "Affichage du parcours GPX",
    schedule: "Horaires et barrières horaires",
    mandatoryEquipment: "Matériel obligatoire",
    bibPickup: "Retrait des dossards",
    access: "Accès au départ et à l’arrivée",
    runnerInfo: "Informations coureur",
  }).forEach((label) => changes.add(label));

  changedObjectKeys(draftEvent.organizer_details, publishedEvent.organizer_details, {
    officialWebsiteUrl: "Site officiel",
    instagramUrl: "Lien Instagram",
    facebookUrl: "Lien Facebook",
    emergencyContact: "Contact d’urgence",
    eventLocation: "Lieu de l’événement",
    dateRange: "Dates de l’événement",
    mandatoryEquipment: "Matériel commun",
    bibPickup: "Dossards communs",
    access: "Accès communs",
    services: "Services communs",
  }).forEach((label) => changes.add(label));

  const collectionLabels: Array<[keyof RacebookPublishedSnapshotV1, string]> = [
    ["stationRows", "Ravitaillements et produits"],
    ["supporterPointRows", "Points de suivi coureur"],
    ["relayPointRows", "Relais"],
    ["startWaveRows", "SAS de départ"],
    ["awardRows", "Podiums et récompenses"],
    ["editionServiceRows", "Services et alentours"],
    ["sponsors", "Sponsors"],
    ["branding", "Identité visuelle"],
    ["modules", "Sections affichées"],
  ];
  for (const [key, label] of collectionLabels) {
    if (valuesDiffer(draft[key], published[key])) changes.add(label);
  }
  if (valuesDiffer(draft.assets.gpxStoragePath, published.assets.gpxStoragePath)) changes.add("Fichier GPX");
  if (valuesDiffer(draft.assets.imageUrls, published.assets.imageUrls)) changes.add("Images et logos");

  return changes.size > 0 ? [...changes] : ["Mise à jour technique du Livret coureur"];
}

export const hashRacebookSnapshot = (snapshot: RacebookPublishedSnapshotV1) =>
  createHash("sha256").update(canonicalize(snapshot)).digest("hex");

export const toRacebookPublicationAssets = (
  config: Pick<SupabaseServiceConfig, "supabaseUrl">,
  snapshot: RacebookPublishedSnapshotV1,
) => {
  const raceImagePrefix = `${config.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/race-images/`;
  return [
    ...(snapshot.assets.gpxStoragePath
      ? [{ asset_type: "gpx", storage_bucket: "race-gpx", storage_path: snapshot.assets.gpxStoragePath }]
      : []),
    ...snapshot.assets.imageUrls.map((url) => {
      if (!url.startsWith(raceImagePrefix)) return { asset_type: "image", public_url: url };
      try {
        const storagePath = decodeURIComponent(url.slice(raceImagePrefix.length));
        return storagePath
          ? { asset_type: "image", storage_bucket: "race-images", storage_path: storagePath, public_url: url }
          : { asset_type: "image", public_url: url };
      } catch {
        return { asset_type: "image", public_url: url };
      }
    }),
  ];
};

async function readRequiredRows(response: Response, label: string) {
  if (!response.ok) throw new Error(`Unable to load ${label}: ${await response.text()}`);
  return rowArraySchema.parse(await response.json());
}

export async function loadRacebookPublicationState(config: SupabaseServiceConfig, raceId: string) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/racebook_publication_states?race_id=eq.${encodeURIComponent(raceId)}&select=*&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to load RaceBook publication state: ${await response.text()}`);
  return z.array(racebookPublicationStateRowSchema).parse(await response.json())[0] ?? null;
}

export async function loadCurrentRacebookPublication(config: SupabaseServiceConfig, raceId: string) {
  const state = await loadRacebookPublicationState(config, raceId);
  if (!state?.current_publication_id) return { state, publication: null };
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/racebook_publications?id=eq.${state.current_publication_id}&race_id=eq.${encodeURIComponent(raceId)}&select=*&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to load current RaceBook publication: ${await response.text()}`);
  const publication = z.array(racebookPublicationRowSchema).parse(await response.json())[0] ?? null;
  return { state, publication };
}

export async function loadRacebookPublication(config: SupabaseServiceConfig, raceId: string, publicationId: string) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/racebook_publications?id=eq.${encodeURIComponent(publicationId)}&race_id=eq.${encodeURIComponent(raceId)}&select=*&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to load RaceBook publication: ${await response.text()}`);
  return z.array(racebookPublicationRowSchema).parse(await response.json())[0] ?? null;
}

export async function buildRacebookPublishedSnapshot(
  config: SupabaseServiceConfig,
  raceId: string,
): Promise<{ snapshot: RacebookPublishedSnapshotV1; draftRevision: number; hash: string }> {
  const initialState = await loadRacebookPublicationState(config, raceId);
  if (!initialState) throw new Error("RaceBook publication state is missing.");

  const raceResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${encodeURIComponent(raceId)}&select=${raceSelect}&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!raceResponse.ok) throw new Error(`Unable to load RaceBook source: ${await raceResponse.text()}`);
  const race = z.array(raceSourceSchema).parse(await raceResponse.json())[0] ?? null;
  if (!race) throw new Error("Race format not found.");

  const [settings, entitlement] = await Promise.all([
    loadOrganizerModuleSettings(config, race.edition_id, [race.id]),
    loadOrganizerEditionEntitlement(config, race.edition_id),
  ]);
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  const modules = effectiveOrganizerModules(tier, settings, race.id);
  const headers = serviceHeaders(config, "");

  const entries = await Promise.all(Object.entries(collectionQueries).map(async ([key, query]) => {
    const enabled = key === "stationRows" ? modules.aid_stations
      : key === "relayPointRows" ? modules.relay
        : key === "startWaveRows" ? modules.start_waves
          : key === "awardRows" ? modules.awards
            : key === "editionServiceRows" ? modules.services
              : modules.supporter_points;
    if (!enabled) return [key, []] as const;
    const path = query.replaceAll("{raceId}", encodeURIComponent(race.id)).replaceAll("{editionId}", encodeURIComponent(race.edition_id));
    const rows = await readRequiredRows(await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { headers, cache: "no-store" }), key);
    return [key, rows] as const;
  }));
  const collections = Object.fromEntries(entries) as Record<keyof typeof collectionQueries, Array<Record<string, unknown>>>;
  if (!modules.official_products) {
    collections.stationRows = collections.stationRows.map((station) => ({
      ...station,
      race_aid_station_products: [],
    }));
  }

  const [sponsorsResponse, brandingResponse] = await Promise.all([
    modules.sponsors
      ? fetch(`${config.supabaseUrl}/rest/v1/race_event_edition_sponsors?edition_id=eq.${race.edition_id}&is_active=eq.true&select=*&order=position.asc,created_at.asc`, { headers, cache: "no-store" })
      : Promise.resolve(null),
    modules.branding
      ? fetch(`${config.supabaseUrl}/rest/v1/race_event_edition_branding?edition_id=eq.${race.edition_id}&select=*&limit=1`, { headers, cache: "no-store" })
      : Promise.resolve(null),
  ]);
  if (sponsorsResponse && !sponsorsResponse.ok) throw new Error(`Unable to load RaceBook sponsors: ${await sponsorsResponse.text()}`);
  if (brandingResponse && !brandingResponse.ok) throw new Error(`Unable to load RaceBook branding: ${await brandingResponse.text()}`);
  const sponsorRows = sponsorsResponse ? z.array(racebookSponsorRowSchema).parse(await sponsorsResponse.json()) : [];
  const brandingRows = brandingResponse ? z.array(racebookBrandingRowSchema).parse(await brandingResponse.json()) : [];
  const branding = toDraftBranding(brandingRows[0] ?? null);

  const { gpx_storage_path: gpxStoragePath, ...publicRace } = race;
  const imageUrls = new Set<string>();
  if (publicRace.thumbnail_url) imageUrls.add(publicRace.thumbnail_url);
  for (const sponsor of sponsorRows) imageUrls.add(sponsor.logo_url);
  if (branding.logoUrl) imageUrls.add(branding.logoUrl);
  for (const station of collections.stationRows) {
    const stationProducts = Array.isArray(station.race_aid_station_products) ? station.race_aid_station_products : [];
    for (const stationProduct of stationProducts) {
      if (!stationProduct || typeof stationProduct !== "object") continue;
      const product = (stationProduct as Record<string, unknown>).products;
      const productRow = Array.isArray(product) ? product[0] : product;
      if (!productRow || typeof productRow !== "object") continue;
      const imageUrl = (productRow as Record<string, unknown>).image_url;
      if (typeof imageUrl === "string" && z.string().url().safeParse(imageUrl).success) imageUrls.add(imageUrl);
    }
  }

  const snapshot = racebookPublishedSnapshotV1Schema.parse({
    schemaVersion: 1,
    raceRow: publicRace,
    ...collections,
    sponsors: sponsorRows.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      logoUrl: sponsor.logo_url,
      destinationUrl: sponsor.website_url,
      tier: sponsor.partnership_level,
      category: sponsor.category,
      contextualPlacement: sponsor.contextual_placement,
      showOnLoading: sponsor.show_on_loading,
      showInBanner: sponsor.show_in_banner,
      position: sponsor.position,
    })),
    branding,
    modules,
    assets: { gpxStoragePath: gpxStoragePath ?? null, imageUrls: [...imageUrls] },
  });
  return { snapshot, draftRevision: initialState.draft_revision, hash: hashRacebookSnapshot(snapshot) };
}

export const serializePublicationState = (
  state: RacebookPublicationStateRow,
  currentPublication: RacebookPublicationRow | null,
) => ({
  draftRevision: state.draft_revision,
  publishedSourceRevision: state.published_source_revision,
  currentPublicationId: state.current_publication_id,
  currentVersion: currentPublication?.version ?? null,
  publishedAt: currentPublication?.published_at ?? state.last_published_at ?? null,
  hasUnpublishedChanges: state.published_source_revision === null || state.draft_revision !== state.published_source_revision,
});

export const publicSnapshot = (publication: RacebookPublicationRow) => {
  const { assets: _assets, sponsors, ...content } = publication.content;
  return {
    ...content,
    sponsors: sponsors.map(({ destinationUrl: _destinationUrl, ...sponsor }) => sponsor),
    publicationId: publication.id,
    publicationRevision: publication.source_draft_revision,
    publishedAt: publication.published_at,
  };
};

export const moduleMask = (modules: Partial<Record<OrganizerModuleKey, boolean>>, allowed: Partial<Record<OrganizerModuleKey, boolean>>) =>
  Object.fromEntries(ORGANIZER_MODULES.map((module) => [module.key, modules[module.key] === true && allowed[module.key] === true])) as Record<OrganizerModuleKey, boolean>;

export async function publishRacebookSnapshot(
  config: SupabaseServiceConfig,
  raceId: string,
  actorId: string,
  makePublic = false,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const built = await buildRacebookPublishedSnapshot(config, raceId);
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/publish_racebook_snapshot`, {
      method: "POST",
      headers: serviceHeaders(config),
      body: JSON.stringify({
        p_race_id: raceId,
        p_expected_draft_revision: built.draftRevision,
        p_schema_version: 1,
        p_content: built.snapshot,
        p_content_hash: built.hash,
        p_actor_id: actorId,
        p_make_public: makePublic,
        p_assets: toRacebookPublicationAssets(config, built.snapshot),
      }),
      cache: "no-store",
    });
    if (response.status === 409 && attempt === 0) continue;
    if (!response.ok) {
      const error = new Error(await response.text() || "Unable to publish RaceBook snapshot.");
      Object.assign(error, { status: response.status === 409 ? 409 : 502 });
      throw error;
    }
    const result = racebookPublicationResultSchema.parse(await response.json());
    const publication = await loadRacebookPublication(config, raceId, result.publicationId);
    if (!publication) throw new Error("Published RaceBook snapshot could not be reloaded.");
    const state = await loadRacebookPublicationState(config, raceId);
    if (!state) throw new Error("RaceBook publication state disappeared after publication.");
    return { publication, state };
  }
  throw Object.assign(new Error("RaceBook draft changed during publication."), { status: 409 });
}
