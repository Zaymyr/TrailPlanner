import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { GpxParseError, parseGpx } from "./gpx/parseGpx";
import type { SupabaseServiceConfig } from "./supabase";
import {
  getTraceDeTrailRaceData,
  TraceDeTrailImportError,
  type TraceDeTrailCredentials,
} from "./tracedetrail-race-import";

const existingRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  source_url: z.string().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_path: z.string().nullable().optional(),
  gpx_hash: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  gpx_sha256: z.string().nullable().optional(),
  min_alt_m: z.number().nullable().optional(),
  max_alt_m: z.number().nullable().optional(),
  start_lat: z.number().nullable().optional(),
  start_lng: z.number().nullable().optional(),
  bounds_min_lat: z.number().nullable().optional(),
  bounds_min_lng: z.number().nullable().optional(),
  bounds_max_lat: z.number().nullable().optional(),
  bounds_max_lng: z.number().nullable().optional(),
  is_live: z.boolean(),
  slug: z.string(),
  created_at: z.string().optional(),
});

export type TraceDeTrailEnrichmentErrorCode =
  | "RACE_NOT_FOUND"
  | "INVALID_PROVIDER"
  | "MISSING_TRACE_ID"
  | "TRACE_ID_MISMATCH"
  | "OFFICIAL_GPX_REQUIRED"
  | "INVALID_GPX"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_VERIFICATION_FAILED"
  | "RACE_UPDATE_FAILED"
  | "PROVIDER_ERROR";

export class TraceDeTrailEnrichmentError extends Error {
  constructor(
    public readonly code: TraceDeTrailEnrichmentErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export type TraceDeTrailEnrichmentResult = {
  race: z.infer<typeof existingRaceSchema>;
  enriched: boolean;
  unchanged: boolean;
  storageVerified: boolean;
  gpxAccessMode: "public" | "authenticated";
  preview?: {
    url: string;
    courseName: string;
    eventName: string;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    date: string | null;
    location: string | null;
    aidStationCount: number;
    gpxAccessMode: "public" | "authenticated";
  };
};

const selectColumns = [
  "id",
  "name",
  "location_text",
  "location",
  "distance_km",
  "elevation_gain_m",
  "elevation_loss_m",
  "trace_provider",
  "trace_id",
  "source_url",
  "external_site_url",
  "thumbnail_url",
  "gpx_path",
  "gpx_hash",
  "gpx_storage_path",
  "gpx_sha256",
  "min_alt_m",
  "max_alt_m",
  "start_lat",
  "start_lng",
  "bounds_min_lat",
  "bounds_min_lng",
  "bounds_max_lat",
  "bounds_max_lng",
  "is_live",
  "slug",
  "created_at",
].join(",");

const serviceHeaders = (config: SupabaseServiceConfig, contentType?: string) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const sha256 = (value: string | ArrayBuffer) =>
  createHash("sha256").update(typeof value === "string" ? value : Buffer.from(value)).digest("hex");

const storageObjectUrl = (config: SupabaseServiceConfig, storagePath: string) =>
  `${config.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`;

async function loadRace(config: SupabaseServiceConfig, raceId: string) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=${selectColumns}&limit=1`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );

  if (!response.ok) {
    console.error("Unable to load race for Trace de Trail enrichment", await response.text());
    throw new TraceDeTrailEnrichmentError("RACE_NOT_FOUND", "Impossible de charger la course ciblée.", 502);
  }

  return z.array(existingRaceSchema).parse(await response.json())[0] ?? null;
}

async function verifyStorageObject(config: SupabaseServiceConfig, storagePath: string, expectedSha: string) {
  const response = await fetch(storageObjectUrl(config, storagePath), {
    headers: serviceHeaders(config),
    cache: "no-store",
  });
  if (!response.ok) return false;
  return sha256(await response.arrayBuffer()) === expectedSha;
}

async function deleteStorageObject(config: SupabaseServiceConfig, storagePath: string) {
  const response = await fetch(storageObjectUrl(config, storagePath), {
    method: "DELETE",
    headers: serviceHeaders(config),
  });
  if (!response.ok) {
    console.error("Unable to remove failed Trace de Trail GPX upload", await response.text());
  }
}

const previousGpxPayload = (race: z.infer<typeof existingRaceSchema>) => ({
  trace_provider: race.trace_provider ?? null,
  trace_id: race.trace_id ?? null,
  source_url: race.source_url ?? null,
  gpx_path: race.gpx_path ?? null,
  gpx_hash: race.gpx_hash ?? null,
  gpx_storage_path: race.gpx_storage_path ?? null,
  gpx_sha256: race.gpx_sha256 ?? null,
  min_alt_m: race.min_alt_m ?? null,
  max_alt_m: race.max_alt_m ?? null,
  start_lat: race.start_lat ?? null,
  start_lng: race.start_lng ?? null,
  bounds_min_lat: race.bounds_min_lat ?? null,
  bounds_min_lng: race.bounds_min_lng ?? null,
  bounds_max_lat: race.bounds_max_lat ?? null,
  bounds_max_lng: race.bounds_max_lng ?? null,
});

async function patchRace(
  config: SupabaseServiceConfig,
  raceId: string,
  payload: Record<string, unknown>,
  returnRepresentation = true
) {
  return fetch(`${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(config, "application/json"),
      Prefer: returnRepresentation ? "return=representation" : "return=minimal",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function enrichExistingRaceWithTraceDeTrailGpx(options: {
  serviceConfig: SupabaseServiceConfig;
  raceId: string;
  credentials?: TraceDeTrailCredentials | null;
}): Promise<TraceDeTrailEnrichmentResult> {
  const { serviceConfig, raceId, credentials = null } = options;
  const race = await loadRace(serviceConfig, raceId);

  if (!race) {
    throw new TraceDeTrailEnrichmentError("RACE_NOT_FOUND", "Course introuvable.", 404);
  }
  if (race.trace_provider?.toLowerCase() !== "tracedetrail") {
    throw new TraceDeTrailEnrichmentError(
      "INVALID_PROVIDER",
      "Cette course n'est pas associée à Trace de Trail.",
      409
    );
  }
  if (!race.trace_id) {
    throw new TraceDeTrailEnrichmentError(
      "MISSING_TRACE_ID",
      "Cette course ne contient aucun identifiant Trace de Trail enregistré.",
      422
    );
  }

  let traceRace;
  try {
    traceRace = await getTraceDeTrailRaceData(`https://tracedetrail.fr/fr/trace/${race.trace_id}`, {
      credentials,
    });
  } catch (error) {
    if (error instanceof GpxParseError) {
      throw new TraceDeTrailEnrichmentError("INVALID_GPX", "Le fichier téléchargé n'est pas un GPX valide.", 422);
    }
    if (error instanceof TraceDeTrailImportError) {
      throw new TraceDeTrailEnrichmentError("PROVIDER_ERROR", error.message, 502);
    }
    throw error;
  }

  if (traceRace.traceId !== race.trace_id) {
    throw new TraceDeTrailEnrichmentError(
      "TRACE_ID_MISMATCH",
      "L'identifiant de la trace téléchargée ne correspond pas à la course ciblée.",
      409
    );
  }
  if (traceRace.gpxAccessMode === "embedded") {
    throw new TraceDeTrailEnrichmentError(
      "OFFICIAL_GPX_REQUIRED",
      "Le fichier GPX officiel Trace de Trail n'est pas téléchargeable pour cette course.",
      422
    );
  }

  let parsedGpx;
  try {
    parsedGpx = parseGpx(traceRace.gpxContent);
  } catch {
    throw new TraceDeTrailEnrichmentError("INVALID_GPX", "Le fichier téléchargé n'est pas un GPX valide.", 422);
  }

  const gpxSha = sha256(traceRace.gpxContent);
  if (
    race.gpx_storage_path &&
    race.gpx_sha256 === gpxSha &&
    (await verifyStorageObject(serviceConfig, race.gpx_storage_path, gpxSha))
  ) {
    return {
      race,
      enriched: false,
      unchanged: true,
      storageVerified: true,
      gpxAccessMode: traceRace.gpxAccessMode,
    };
  }

  const storagePath = `catalog/${race.id}/tracedetrail-${Date.now()}.gpx`;
  const uploadResponse = await fetch(storageObjectUrl(serviceConfig, storagePath), {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceConfig, "application/gpx+xml"),
      "x-upsert": "false",
    },
    body: traceRace.gpxContent,
  });
  if (!uploadResponse.ok) {
    console.error("Unable to upload official Trace de Trail GPX", await uploadResponse.text());
    throw new TraceDeTrailEnrichmentError(
      "STORAGE_WRITE_FAILED",
      "Impossible d'enregistrer le GPX Trace de Trail.",
      502
    );
  }

  if (!(await verifyStorageObject(serviceConfig, storagePath, gpxSha))) {
    await deleteStorageObject(serviceConfig, storagePath);
    throw new TraceDeTrailEnrichmentError(
      "STORAGE_VERIFICATION_FAILED",
      "Le GPX enregistré dans Storage n'a pas pu être vérifié.",
      502
    );
  }

  const updateResponse = await patchRace(serviceConfig, race.id, {
    trace_provider: "tracedetrail",
    trace_id: traceRace.traceId,
    source_url: traceRace.normalizedUrl,
    gpx_path: storagePath,
    gpx_hash: gpxSha,
    gpx_storage_path: storagePath,
    gpx_sha256: gpxSha,
    min_alt_m: parsedGpx.stats.minAltM,
    max_alt_m: parsedGpx.stats.maxAltM,
    start_lat: parsedGpx.stats.startLat,
    start_lng: parsedGpx.stats.startLng,
    bounds_min_lat: parsedGpx.stats.boundsMinLat,
    bounds_min_lng: parsedGpx.stats.boundsMinLng,
    bounds_max_lat: parsedGpx.stats.boundsMaxLat,
    bounds_max_lng: parsedGpx.stats.boundsMaxLng,
  });

  if (!updateResponse.ok) {
    console.error("Unable to associate official Trace de Trail GPX", await updateResponse.text());
    await deleteStorageObject(serviceConfig, storagePath);
    throw new TraceDeTrailEnrichmentError(
      "RACE_UPDATE_FAILED",
      "Impossible d'associer le GPX à la course existante.",
      502
    );
  }

  const updatedRace = z.array(existingRaceSchema).parse(await updateResponse.json())[0];
  if (!updatedRace || !(await verifyStorageObject(serviceConfig, storagePath, gpxSha))) {
    const rollbackResponse = await patchRace(serviceConfig, race.id, previousGpxPayload(race), false);
    if (!rollbackResponse.ok) {
      console.error("Unable to roll back race after Storage verification failure", await rollbackResponse.text());
    }
    await deleteStorageObject(serviceConfig, storagePath);
    throw new TraceDeTrailEnrichmentError(
      "STORAGE_VERIFICATION_FAILED",
      "Le GPX n'existe plus dans Storage après son association.",
      502
    );
  }

  return {
    race: updatedRace,
    enriched: true,
    unchanged: false,
    storageVerified: true,
    gpxAccessMode: traceRace.gpxAccessMode,
    preview: {
      url: traceRace.normalizedUrl,
      courseName: traceRace.courseName,
      eventName: traceRace.eventName,
      distanceKm: traceRace.distanceKm,
      elevationGainM: traceRace.elevationGainM,
      elevationLossM: traceRace.elevationLossM,
      date: traceRace.date,
      location: traceRace.location,
      aidStationCount: traceRace.aidStations.length,
      gpxAccessMode: traceRace.gpxAccessMode,
    },
  };
}
