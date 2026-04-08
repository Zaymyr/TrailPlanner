import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../lib/gpx/parseGpx";
import { normalizeImportedWaypoints } from "../../../lib/gpx/normalizeImportedWaypoints";
import { checkRateLimit, withSecurityHeaders } from "../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../lib/supabase";

const querySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsedQuery.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid query." }, { status: 400 }));
  }

  const search = parsedQuery.data.search;
  // Strip SQL ILIKE wildcards (%, _) and PostgREST wildcard (*) from user input
  // to prevent unintended pattern matching.
  const sanitizeSearch = (value: string) => value.replace(/[%_*\\]/g, "");
  const filter = search
    ? `&or=(name.ilike.*${encodeURIComponent(sanitizeSearch(search))}*,location_text.ilike.*${encodeURIComponent(
        sanitizeSearch(search)
      )}*,location.ilike.*${encodeURIComponent(sanitizeSearch(search))}*)`
    : "";

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/races?select=id,name,location_text,location,distance_km,elevation_gain_m,elevation_loss_m,trace_provider,trace_id,external_site_url,thumbnail_url,gpx_storage_path&is_live=eq.true&order=name.asc${filter}`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load race catalog", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load race catalog." }, { status: 502 }));
    }

    const rows = z.array(raceRowSchema).parse(await response.json());

    return withSecurityHeaders(NextResponse.json({ races: rows }));
  } catch (error) {
    console.error("Unexpected error while loading race catalog", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race catalog." }, { status: 500 }));
  }
}

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => !value || /^https?:\/\//i.test(value), { message: "Invalid URL." });

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => !value || z.string().uuid().safeParse(value).success, { message: "Invalid uuid." });

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? Number(value.replace(",", ".")) : undefined))
  .refine((value) => value === undefined || (Number.isFinite(value) && value >= 0), {
    message: "Invalid number.",
  });

const aidStationInputSchema = z.object({
  name: z.string().trim().min(1),
  distanceKm: z.number().nonnegative(),
  waterRefill: z.boolean().optional().default(true),
});

const createRaceSchema = z.object({
  name: optionalText,
  event_id: optionalUuid,
  event_name: optionalText,
  event_location: optionalText,
  event_race_date: optionalText,
  event_thumbnail_url: optionalUrl,
  race_date: optionalText,
  location_text: optionalText,
  elevation_gain_m: optionalNumber,
  elevation_loss_m: optionalNumber,
  trace_id: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? Number(value) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value), { message: "Invalid trace id." }),
  external_site_url: optionalUrl,
  thumbnail_url: optionalUrl,
  trace_provider: optionalText,
  is_live: z
    .string()
    .optional()
    .transform((value) => (value === "false" ? false : true)),
});

const raceEventRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `race-${suffix}`;
};

const parseManualAidStations = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || value.trim().length === 0) return { aidStations: [], error: null };

  try {
    const parsed = z.array(aidStationInputSchema).safeParse(JSON.parse(value));
    if (!parsed.success) return { aidStations: [], error: "Invalid aid stations." };
    return { aidStations: parsed.data, error: null };
  } catch {
    return { aidStations: [], error: "Invalid aid stations." };
  }
};

const mapGpxWaypointsToAidStations = (
  points: Array<{ lat: number; lng: number; distKmCum: number }>,
  waypoints: Array<{ lat: number; lng: number; name?: string | null; desc?: string | null }>
) =>
  normalizeImportedWaypoints(points, waypoints).aidStations.map((station) => ({
    name: station.name,
    distanceKm: station.distanceKm,
    waterRefill: true,
  }));

const validateImageFile = (imageFile: File) => {
  if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
    return "Invalid image type. Use JPEG, PNG, WebP or AVIF.";
  }

  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    return "Image is too large (max 5 MB).";
  }

  return null;
};

const uploadRaceImage = async (
  supabaseService: NonNullable<ReturnType<typeof getSupabaseServiceConfig>>,
  raceId: string,
  imageFile: File
) => {
  const mimeType = imageFile.type || "image/jpeg";
  const extension = mimeType.split("/")[1] ?? "jpg";
  const storagePath = `catalog/${raceId}/thumbnail-${Date.now()}.${extension}`;

  const uploadResponse = await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: imageFile,
  });

  if (!uploadResponse.ok) {
    console.error("Unable to upload race thumbnail", await uploadResponse.text());
    throw new Error("Unable to upload image.");
  }

  return {
    storagePath,
    publicUrl: `${supabaseService.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`,
  };
};

const deleteStorageObject = async (
  supabaseService: NonNullable<ReturnType<typeof getSupabaseServiceConfig>>,
  bucket: string,
  storagePath: string
) => {
  await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
    },
  }).catch(() => null);
};

const createRaceEvent = async (
  supabaseService: NonNullable<ReturnType<typeof getSupabaseServiceConfig>>,
  payload: {
    name: string;
    location: string | null;
    race_date: string | null;
    thumbnail_url: string | null;
    is_live: boolean;
  }
) => {
  const response = await fetch(`${supabaseService.supabaseUrl}/rest/v1/race_events`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to create race event", await response.text());
    throw new Error("Unable to create race event.");
  }

  return z.array(raceEventRowSchema).parse(await response.json())[0] ?? null;
};

const deleteRaceEvent = async (
  supabaseService: NonNullable<ReturnType<typeof getSupabaseServiceConfig>>,
  eventId: string
) => {
  await fetch(`${supabaseService.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
    },
    cache: "no-store",
  }).catch(() => null);
};

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const rateLimit = checkRateLimit(`race-catalog-admin:${supabaseUser.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid form data." }, { status: 400 }));
  }

  const gpxFile = formData.get("gpx");

  if (!(gpxFile instanceof File)) {
    return withSecurityHeaders(NextResponse.json({ message: "GPX file is required." }, { status: 400 }));
  }

  const parsedFields = createRaceSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsedFields.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid form values." }, { status: 400 }));
  }

  const parsedManualAidStations = parseManualAidStations(formData.get("aid_stations"));
  if (parsedManualAidStations.error) {
    return withSecurityHeaders(NextResponse.json({ message: parsedManualAidStations.error }, { status: 400 }));
  }

  const imageFile = formData.get("image");
  if (imageFile instanceof File) {
    const imageError = validateImageFile(imageFile);
    if (imageError) {
      return withSecurityHeaders(NextResponse.json({ message: imageError }, { status: 400 }));
    }
  } else if (imageFile !== null) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid image file." }, { status: 400 }));
  }

  let parsedGpx;
  const gpxContent = await gpxFile.text();

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    console.error("Unable to parse uploaded GPX in /api/race-catalog", error);
    const details = error instanceof Error ? error.message : "Unknown parse error";
    return withSecurityHeaders(NextResponse.json({ message: `Invalid GPX file: ${details}` }, { status: 422 }));
  }

  const raceName = parsedFields.data.name ?? parsedGpx.name ?? null;

  if (!raceName) {
    return withSecurityHeaders(NextResponse.json({ message: "Race name is required." }, { status: 400 }));
  }

  let eventId = parsedFields.data.event_id ?? null;
  let createdEventId: string | null = null;
  if (!eventId && parsedFields.data.event_name) {
    try {
      const event = await createRaceEvent(supabaseService, {
        name: parsedFields.data.event_name,
        location: parsedFields.data.event_location ?? parsedFields.data.location_text ?? null,
        race_date: parsedFields.data.event_race_date ?? parsedFields.data.race_date ?? null,
        thumbnail_url: parsedFields.data.event_thumbnail_url ?? parsedFields.data.thumbnail_url ?? null,
        is_live: parsedFields.data.is_live ?? true,
      });
      eventId = event?.id ?? null;
      createdEventId = eventId;
    } catch (error) {
      console.error("Unable to create manual race event", error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create race event." }, { status: 502 }));
    }
  }

  const raceId = randomUUID();
  const storagePath = `catalog/${raceId}/${Date.now()}.gpx`;

  const uploadResponse = await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      "Content-Type": gpxFile.type || "application/gpx+xml",
      "x-upsert": "true",
    },
    body: gpxFile,
  });

  if (!uploadResponse.ok) {
    console.error("Unable to upload GPX", await uploadResponse.text());
    if (createdEventId) {
      await deleteRaceEvent(supabaseService, createdEventId);
    }
    return withSecurityHeaders(NextResponse.json({ message: "Unable to upload GPX file." }, { status: 502 }));
  }

  let thumbnailUrl = parsedFields.data.thumbnail_url ?? null;
  let imageStoragePath: string | null = null;
  if (imageFile instanceof File) {
    try {
      const uploadedImage = await uploadRaceImage(supabaseService, raceId, imageFile);
      thumbnailUrl = uploadedImage.publicUrl;
      imageStoragePath = uploadedImage.storagePath;
    } catch (error) {
      await deleteStorageObject(supabaseService, "race-gpx", storagePath);
      if (createdEventId) {
        await deleteRaceEvent(supabaseService, createdEventId);
      }
      return withSecurityHeaders(
        NextResponse.json({ message: error instanceof Error ? error.message : "Unable to upload image." }, { status: 502 })
      );
    }
  }

  const gpxSha = createHash("sha256").update(gpxContent).digest("hex");
  const traceProvider = parsedFields.data.trace_provider ?? (parsedFields.data.trace_id ? "tracedetrail" : undefined);
  const slug = buildSlug(raceName);
  const resolvedAidStations =
    parsedManualAidStations.aidStations.length > 0
      ? parsedManualAidStations.aidStations
      : parsedGpx.waypoints.length > 0
        ? mapGpxWaypointsToAidStations(parsedGpx.points, parsedGpx.waypoints)
        : [];

  const insertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      apikey: supabaseAnon.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: raceId,
      slug,
      name: raceName,
      event_id: eventId,
      race_date: parsedFields.data.race_date ?? parsedFields.data.event_race_date ?? null,
      location_text: parsedFields.data.location_text ?? null,
      trace_provider: traceProvider ?? null,
      trace_id: parsedFields.data.trace_id ?? null,
      external_site_url: parsedFields.data.external_site_url ?? null,
      thumbnail_url: thumbnailUrl,
      gpx_path: storagePath,
      gpx_hash: gpxSha,
      gpx_storage_path: storagePath,
      gpx_sha256: gpxSha,
      distance_km: parsedGpx.stats.distanceKm,
      elevation_gain_m: parsedFields.data.elevation_gain_m ?? parsedGpx.stats.gainM,
      elevation_loss_m: parsedFields.data.elevation_loss_m ?? parsedGpx.stats.lossM,
      min_alt_m: parsedGpx.stats.minAltM,
      max_alt_m: parsedGpx.stats.maxAltM,
      start_lat: parsedGpx.stats.startLat,
      start_lng: parsedGpx.stats.startLng,
      bounds_min_lat: parsedGpx.stats.boundsMinLat,
      bounds_min_lng: parsedGpx.stats.boundsMinLng,
      bounds_max_lat: parsedGpx.stats.boundsMaxLat,
      bounds_max_lng: parsedGpx.stats.boundsMaxLng,
      is_live: parsedFields.data.is_live ?? true,
      is_public: true,
      created_by: null,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create race catalog row", await insertResponse.text());
    await deleteStorageObject(supabaseService, "race-gpx", storagePath);
    if (imageStoragePath) {
      await deleteStorageObject(supabaseService, "race-images", imageStoragePath);
    }
    if (createdEventId) {
      await deleteRaceEvent(supabaseService, createdEventId);
    }
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create race." }, { status: 502 }));
  }

  const inserted = z.array(raceRowSchema).parse(await insertResponse.json())?.[0];

  if (resolvedAidStations.length > 0) {
    const aidInsertResponse = await fetch(`${supabaseService.supabaseUrl}/rest/v1/race_aid_stations`, {
      method: "POST",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        resolvedAidStations.map((station, index) => ({
          race_id: raceId,
          name: station.name,
          km: station.distanceKm,
          water_available: station.waterRefill ?? true,
          notes: null,
          order_index: index,
        }))
      ),
      cache: "no-store",
    });

    if (!aidInsertResponse.ok) {
      console.error("Unable to insert manual race aid stations", await aidInsertResponse.text());
    }
  }

  return withSecurityHeaders(NextResponse.json({ race: inserted }));
}
