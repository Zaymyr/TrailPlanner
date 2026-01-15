import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../lib/gpx/parseGpx";
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
  const filter = search
    ? `&or=(name.ilike.*${encodeURIComponent(search)}*,location_text.ilike.*${encodeURIComponent(
        search
      )}*,location.ilike.*${encodeURIComponent(search)}*)`
    : "";

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_catalog?select=id,name,location_text,location,distance_km,elevation_gain_m,elevation_loss_m,trace_provider,trace_id,external_site_url,thumbnail_url,gpx_storage_path&is_live=eq.true&order=name.asc${filter}`,
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

const createRaceSchema = z.object({
  name: optionalText,
  location_text: optionalText,
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

const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `race-${suffix}`;
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

  let parsedGpx;
  const gpxContent = await gpxFile.text();

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    console.error("Unable to parse uploaded GPX", error);
    return withSecurityHeaders(NextResponse.json({ message: "Invalid GPX file." }, { status: 422 }));
  }

  const raceName = parsedFields.data.name ?? parsedGpx.name ?? null;

  if (!raceName) {
    return withSecurityHeaders(NextResponse.json({ message: "Race name is required." }, { status: 400 }));
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
    return withSecurityHeaders(NextResponse.json({ message: "Unable to upload GPX file." }, { status: 502 }));
  }

  const gpxSha = createHash("sha256").update(gpxContent).digest("hex");
  const traceProvider = parsedFields.data.trace_provider ?? (parsedFields.data.trace_id ? "tracedetrail" : undefined);
  const slug = buildSlug(raceName);

  const insertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/race_catalog`, {
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
      location_text: parsedFields.data.location_text ?? null,
      trace_provider: traceProvider ?? null,
      trace_id: parsedFields.data.trace_id ?? null,
      external_site_url: parsedFields.data.external_site_url ?? null,
      thumbnail_url: parsedFields.data.thumbnail_url ?? null,
      gpx_path: storagePath,
      gpx_hash: gpxSha,
      gpx_storage_path: storagePath,
      gpx_sha256: gpxSha,
      distance_km: parsedGpx.stats.distanceKm,
      elevation_gain_m: parsedGpx.stats.gainM,
      elevation_loss_m: parsedGpx.stats.lossM,
      min_alt_m: parsedGpx.stats.minAltM,
      max_alt_m: parsedGpx.stats.maxAltM,
      start_lat: parsedGpx.stats.startLat,
      start_lng: parsedGpx.stats.startLng,
      bounds_min_lat: parsedGpx.stats.boundsMinLat,
      bounds_min_lng: parsedGpx.stats.boundsMinLng,
      bounds_max_lat: parsedGpx.stats.boundsMaxLat,
      bounds_max_lng: parsedGpx.stats.boundsMaxLng,
      is_live: parsedFields.data.is_live ?? true,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create race catalog row", await insertResponse.text());
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    });
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create race." }, { status: 502 }));
  }

  const inserted = z.array(raceRowSchema).parse(await insertResponse.json())?.[0];

  return withSecurityHeaders(NextResponse.json({ race: inserted }));
}
