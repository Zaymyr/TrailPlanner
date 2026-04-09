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
} from "../../../lib/supabase";

const aidStationInputSchema = z.object({
  name: z.string().min(1),
  distanceKm: z.number().nonnegative(),
  waterRefill: z.boolean().optional().default(true),
});

const createRaceSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  distance_km: z.number().positive(),
  elevation_gain_m: z.number().nonnegative(),
  elevation_loss_m: z.number().nonnegative().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  aid_stations: z.array(aidStationInputSchema).optional().default([]),
  gpx_content: z.string().nullable().optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  is_public: z.boolean(),
  created_by: z.string().uuid().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
});

const buildAuthHeaders = (key: string, token: string, contentType = "application/json") => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
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

const extractPostgrestErrorMessage = (errorText: string) => {
  try {
    const parsed = JSON.parse(errorText) as { message?: string; details?: string; hint?: string } | null;
    const parts = [parsed?.message, parsed?.details, parsed?.hint].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0
    );
    return parts.length > 0 ? parts.join(" ") : null;
  } catch {
    return errorText.trim() || null;
  }
};

const buildCreateRaceErrorMessage = (errorText: string) => {
  const extracted = extractPostgrestErrorMessage(errorText);
  const normalized = extracted?.toLowerCase() ?? "";

  if (normalized.includes("race_date")) {
    return "Invalid race date. Use YYYY-MM-DD.";
  }

  if (
    normalized.includes("gpx_path") ||
    normalized.includes("gpx_hash") ||
    normalized.includes("gpx_storage_path")
  ) {
    return "Unable to save the GPX file for this race. Please try another GPX file.";
  }

  if (normalized.includes("slug")) {
    return "Unable to generate the race identifier. Please try again.";
  }

  return extracted || "Unable to create race.";
};

const mapWaypointsToAidStations = (
  points: Array<{ lat: number; lng: number; distKmCum: number }>,
  waypoints: Array<{ lat: number; lng: number; name?: string | null; desc?: string | null }>
) =>
  normalizeImportedWaypoints(points, waypoints).aidStations.map((station) => ({
    name: station.name,
    distanceKm: station.distanceKm,
    waterRefill: true,
  }));

export async function GET(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  try {
    const response = await fetch(
      `${supabaseAnon.supabaseUrl}/rest/v1/races?select=id,name,location_text,distance_km,elevation_gain_m,elevation_loss_m,is_public,created_by,gpx_storage_path&is_live=eq.true&order=name.asc`,
      {
        headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load races", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load races." }, { status: 502 }));
    }

    const races = await response.json();
    return withSecurityHeaders(NextResponse.json({ races }));
  } catch (error) {
    console.error("Error loading races", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load races." }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`races-create:${user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() },
        }
      )
    );
  }

  let body: z.infer<typeof createRaceSchema>;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const gpxFile = formData.get("gpx") as File | null;
      const gpxContent = gpxFile ? await gpxFile.text() : null;
      body = createRaceSchema.parse({
        name: formData.get("name"),
        distance_km: Number(formData.get("distance_km")),
        elevation_gain_m: Number(formData.get("elevation_gain_m")),
        elevation_loss_m: formData.get("elevation_loss_m") ? Number(formData.get("elevation_loss_m")) : null,
        location_text: formData.get("location_text") || null,
        race_date: formData.get("race_date") || null,
        aid_stations: formData.get("aid_stations") ? JSON.parse(formData.get("aid_stations") as string) : [],
        gpx_content: gpxContent,
      });
    } else {
      body = createRaceSchema.parse(await request.json().catch(() => null));
    }
  } catch {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const raceId = randomUUID();
  let gpxStoragePath: string | null = null;
  let gpxPath = `manual/${user.id}/${raceId}.gpx`;
  let gpxHash = `manual:${raceId}`;
  let resolvedAidStations = body.aid_stations;
  let resolvedDistance = body.distance_km;
  let resolvedGain = body.elevation_gain_m;
  let resolvedLoss = body.elevation_loss_m ?? 0;

  if (body.gpx_content) {
    let parsedGpx;
    try {
      parsedGpx = parseGpx(body.gpx_content);
    } catch (error) {
      console.error("Unable to parse GPX in /api/races", error);
      const details = error instanceof Error ? error.message : "Unknown parse error";
      return withSecurityHeaders(NextResponse.json({ message: `Invalid GPX file: ${details}` }, { status: 422 }));
    }

    resolvedDistance = parsedGpx.stats.distanceKm || resolvedDistance;
    resolvedGain = parsedGpx.stats.gainM || resolvedGain;
    resolvedLoss = parsedGpx.stats.lossM ?? resolvedLoss;

    if (parsedGpx.pointSource !== "waypoint" && parsedGpx.waypoints.length > 0 && resolvedAidStations.length === 0) {
      resolvedAidStations = mapWaypointsToAidStations(parsedGpx.points, parsedGpx.waypoints);
    }

    gpxStoragePath = `${user.id}/${raceId}.gpx`;
    gpxPath = gpxStoragePath;
    gpxHash = createHash("sha256").update(body.gpx_content).digest("hex");
    const uploadResponse = await fetch(
      `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${gpxStoragePath}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/gpx+xml",
          "x-upsert": "true",
        },
        body: body.gpx_content,
      }
    );

    if (!uploadResponse.ok) {
      const uploadErrorText = await uploadResponse.text();
      console.error("Unable to upload race GPX", uploadErrorText);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to upload GPX file." }, { status: 502 }));
    }
  }

  const insertPayload: Record<string, unknown> = {
    id: raceId,
    slug: body.slug?.trim() || buildSlug(body.name),
    name: body.name,
    distance_km: Number(resolvedDistance.toFixed(2)),
    elevation_gain_m: Math.round(resolvedGain),
    elevation_loss_m: Math.round(resolvedLoss),
    location_text: body.location_text ?? null,
    gpx_path: gpxPath,
    gpx_hash: gpxHash,
    is_public: false,
    created_by: user.id,
    is_live: true,
    gpx_storage_path: gpxStoragePath ?? null,
    gpx_sha256: gpxStoragePath ? gpxHash : null,
  };

  if (body.race_date) {
    insertPayload.race_date = body.race_date;
  }

  const insertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
      Prefer: "return=representation",
    },
    body: JSON.stringify(insertPayload),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    const errorText = await insertResponse.text();
    console.error("Unable to create race", errorText);
    if (gpxStoragePath) {
      await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${gpxStoragePath}`, {
        method: "DELETE",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
      });
    }
    return withSecurityHeaders(
      NextResponse.json({ message: buildCreateRaceErrorMessage(errorText) }, { status: 502 })
    );
  }

  const insertedRows = await insertResponse.json();
  const race = raceRowSchema.parse(insertedRows?.[0]);

  if (resolvedAidStations.length > 0) {
    const aidInsertResponse = await fetch(`${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        resolvedAidStations.map((s, i) => ({
          race_id: raceId,
          name: s.name,
          km: s.distanceKm,
          water_available: s.waterRefill ?? true,
          order_index: i,
        }))
      ),
      cache: "no-store",
    });

    if (!aidInsertResponse.ok) {
      console.error("Unable to insert race aid stations", await aidInsertResponse.text());
    }
  }

  return withSecurityHeaders(NextResponse.json({ race, aidStations: resolvedAidStations }));
}
