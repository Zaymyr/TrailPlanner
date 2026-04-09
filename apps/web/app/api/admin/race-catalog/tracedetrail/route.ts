import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../../../lib/gpx/parseGpx";
import { withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  type SupabaseServiceConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";
import {
  type TraceDeTrailCredentials,
  getTraceDeTrailRaceData,
  TraceDeTrailImportError,
} from "../../../../../lib/tracedetrail-race-import";

const credentialsSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

const requestSchema = z.object({
  url: z.string().trim().url(),
  action: z.enum(["preview", "import"]).default("preview"),
  isLive: z.boolean().optional().default(true),
  credentials: credentialsSchema.optional(),
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
  is_live: z.boolean(),
  slug: z.string(),
  created_at: z.string().optional(),
});

const raceEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
});

type SupabaseAuthContext = {
  token: string;
  anonKey: string;
  supabaseUrl: string;
};

const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `race-${suffix}`;
};

const normalizeComparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const buildRestHeaders = (context: SupabaseAuthContext, contentType = "application/json") => ({
  apikey: context.anonKey,
  Authorization: `Bearer ${context.token}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const buildServiceHeaders = (serviceConfig: SupabaseServiceConfig, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

async function requireAdmin(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return {
      error: withSecurityHeaders(
        NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
      ),
    } as const;
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return {
      error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })),
    } as const;
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return {
      error: withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 })),
    } as const;
  }

  if (!isAdminUser(supabaseUser)) {
    return {
      error: withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 })),
    } as const;
  }

  return {
    context: {
      token,
      anonKey: supabaseAnon.supabaseAnonKey,
      supabaseUrl: supabaseAnon.supabaseUrl,
    },
    serviceConfig: supabaseService,
  } as const;
}

async function findExistingRaceBySourceUrl(serviceConfig: SupabaseServiceConfig, sourceUrl: string) {
  const encoded = encodeURIComponent(sourceUrl);
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?select=id,name,slug&or=(source_url.eq.${encoded},external_site_url.eq.${encoded})&limit=1`,
    {
      headers: buildServiceHeaders(serviceConfig, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to check existing Trace de Trail race", await response.text());
    throw new Error("Unable to check existing races.");
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string; name: string; slug: string }>;
  return rows[0] ?? null;
}

async function findExistingTraceDeTrailRace(serviceConfig: SupabaseServiceConfig, traceId: number, sourceUrl: string) {
  const traceResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?select=id,name,slug&trace_provider=eq.tracedetrail&trace_id=eq.${traceId}&limit=1`,
    {
      headers: buildServiceHeaders(serviceConfig, undefined),
      cache: "no-store",
    }
  );

  if (!traceResponse.ok) {
    console.error("Unable to check existing Trace de Trail trace id", await traceResponse.text());
    throw new Error("Unable to check existing races.");
  }

  const traceRows = (await traceResponse.json().catch(() => [])) as Array<{ id: string; name: string; slug: string }>;
  if (traceRows[0]) return traceRows[0];

  return findExistingRaceBySourceUrl(serviceConfig, sourceUrl);
}

async function findExistingRaceEvent(serviceConfig: SupabaseServiceConfig, eventName: string) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date&name=ilike.*${encodeURIComponent(
      eventName
    )}*&limit=20`,
    {
      headers: buildServiceHeaders(serviceConfig, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to search race events", await response.text());
    throw new Error("Unable to load race events.");
  }

  const rows = z.array(raceEventSchema).parse(await response.json());
  const normalizedTarget = normalizeComparableName(eventName);
  return rows.find((row) => normalizeComparableName(row.name) === normalizedTarget) ?? null;
}

async function createRaceEvent(
  serviceConfig: SupabaseServiceConfig,
  payload: { name: string; location: string | null; race_date: string | null; isLive: boolean }
) {
  const basePayload = {
    name: payload.name,
    location: payload.location,
    race_date: payload.race_date,
  };

  const attempts = [{ ...basePayload, is_live: payload.isLive }, basePayload];

  for (const attempt of attempts) {
    const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_events`, {
      method: "POST",
      headers: {
        ...buildServiceHeaders(serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify(attempt),
      cache: "no-store",
    });

    if (!response.ok) {
      continue;
    }

    const rows = z.array(raceEventSchema).parse(await response.json());
    return rows[0] ?? null;
  }

  throw new Error("Unable to create race event.");
}

async function ensureRaceEventId(
  serviceConfig: SupabaseServiceConfig,
  payload: { name: string; location: string | null; race_date: string | null; isLive: boolean }
) {
  const existing = await findExistingRaceEvent(serviceConfig, payload.name);
  if (existing) return existing.id;

  const created = await createRaceEvent(serviceConfig, payload);
  return created?.id ?? null;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json().catch(() => null));
  } catch {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  try {
    const credentials: TraceDeTrailCredentials | null = body.credentials
      ? { login: body.credentials.login, password: body.credentials.password }
      : null;

    const traceRace = await getTraceDeTrailRaceData(body.url, { credentials });
    const duplicateRace = await findExistingTraceDeTrailRace(
      admin.serviceConfig,
      traceRace.traceId,
      traceRace.normalizedUrl
    );

    if (body.action === "preview") {
      return withSecurityHeaders(
        NextResponse.json({
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
          duplicateRace,
        })
      );
    }

    if (duplicateRace) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            message: "Cette course Trace de Trail existe deja dans le catalogue.",
            duplicateRace,
          },
          { status: 409 }
        )
      );
    }

    let raceEventId: string | null;
    try {
      raceEventId = await ensureRaceEventId(admin.serviceConfig, {
        name: traceRace.eventName,
        location: traceRace.location,
        race_date: traceRace.date,
        isLive: body.isLive,
      });
    } catch (error) {
      console.error("Unable to resolve Trace de Trail race event", error);
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de creer ou rattacher l'evenement Trace de Trail." }, { status: 502 })
      );
    }

    let parsedGpx;
    try {
      parsedGpx = parseGpx(traceRace.gpxContent);
    } catch (error) {
      console.error("Unable to parse Trace de Trail GPX", error);
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de parser le GPX officiel Trace de Trail." }, { status: 422 })
      );
    }

    const raceId = randomUUID();
    const storagePath = `catalog/${raceId}/tracedetrail-${Date.now()}.gpx`;
    const uploadResponse = await fetch(
      `${admin.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`,
      {
        method: "POST",
        headers: {
          apikey: admin.serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${admin.serviceConfig.supabaseServiceRoleKey}`,
          "Content-Type": "application/gpx+xml",
          "x-upsert": "true",
        },
        body: traceRace.gpxContent,
      }
    );

    if (!uploadResponse.ok) {
      console.error("Unable to upload imported Trace de Trail GPX", await uploadResponse.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible d'enregistrer le GPX Trace de Trail." }, { status: 502 })
      );
    }

    const gpxSha = createHash("sha256").update(traceRace.gpxContent).digest("hex");
    const insertResponse = await fetch(`${admin.serviceConfig.supabaseUrl}/rest/v1/races`, {
      method: "POST",
      headers: {
        ...buildServiceHeaders(admin.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: raceId,
        slug: buildSlug(traceRace.courseName),
        name: traceRace.courseName,
        event_id: raceEventId,
        race_date: traceRace.date,
        location_text: traceRace.location,
        trace_provider: "tracedetrail",
        trace_id: traceRace.traceId,
        source_url: traceRace.normalizedUrl,
        external_site_url: traceRace.officialSiteUrl ?? traceRace.normalizedUrl,
        thumbnail_url: traceRace.thumbnailUrl,
        gpx_path: storagePath,
        gpx_hash: gpxSha,
        gpx_storage_path: storagePath,
        gpx_sha256: gpxSha,
        distance_km: traceRace.distanceKm,
        elevation_gain_m: traceRace.elevationGainM,
        elevation_loss_m: traceRace.elevationLossM,
        min_alt_m: parsedGpx.stats.minAltM,
        max_alt_m: parsedGpx.stats.maxAltM,
        start_lat: parsedGpx.stats.startLat,
        start_lng: parsedGpx.stats.startLng,
        bounds_min_lat: parsedGpx.stats.boundsMinLat,
        bounds_min_lng: parsedGpx.stats.boundsMinLng,
        bounds_max_lat: parsedGpx.stats.boundsMaxLat,
        bounds_max_lng: parsedGpx.stats.boundsMaxLng,
        is_live: body.isLive,
        is_public: true,
        created_by: null,
      }),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      console.error("Unable to create imported Trace de Trail race", await insertResponse.text());
      await fetch(`${admin.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
        method: "DELETE",
        headers: {
          apikey: admin.serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${admin.serviceConfig.supabaseServiceRoleKey}`,
        },
      });
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de creer la course Trace de Trail." }, { status: 502 })
      );
    }

    const insertedRace = z.array(raceRowSchema).parse(await insertResponse.json())[0];

    if (traceRace.aidStations.length > 0) {
      const aidInsertResponse = await fetch(`${admin.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
        method: "POST",
        headers: {
          ...buildServiceHeaders(admin.serviceConfig),
          Prefer: "return=minimal",
        },
        body: JSON.stringify(
          traceRace.aidStations.map((station, index) => ({
            race_id: raceId,
            name: station.name,
            km: station.distanceKm,
            water_available: station.waterRefill,
            order_index: index,
          }))
        ),
        cache: "no-store",
      });

      if (!aidInsertResponse.ok) {
        console.error("Unable to insert imported Trace de Trail aid stations", await aidInsertResponse.text());
      }
    }

    return withSecurityHeaders(
      NextResponse.json({
        race: insertedRace,
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
      })
    );
  } catch (error) {
    if (error instanceof TraceDeTrailImportError) {
      const status =
        error.code === "INVALID_URL"
          ? 400
          : error.code === "AUTH_REQUIRED"
            ? 403
            : error.code === "AUTH_FAILED"
              ? 401
              : error.code === "INVALID_DATA"
                ? 422
                : 502;
      return withSecurityHeaders(NextResponse.json({ message: error.message }, { status }));
    }

    console.error("Unexpected Trace de Trail import error", error);
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Impossible de recuperer les donnees Trace de Trail pour cette course" },
        { status: 500 }
      )
    );
  }
}
