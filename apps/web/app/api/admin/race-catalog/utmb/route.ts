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
import { getUtmbRaceData, UtmbImportError } from "../../../../../lib/utmb-race-import";

const requestSchema = z.object({
  url: z.string().trim().url(),
  action: z.enum(["preview", "import"]).default("preview"),
  isLive: z.boolean().optional().default(true),
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
    console.error("Unable to check existing UTMB race", await response.text());
    throw new Error("Unable to check existing races.");
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string; name: string; slug: string }>;
  return rows[0] ?? null;
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

async function ensureRaceEventId(serviceConfig: SupabaseServiceConfig, payload: {
  name: string;
  location: string | null;
  race_date: string | null;
  isLive: boolean;
}) {
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
    const utmbRace = await getUtmbRaceData(body.url);
    const duplicateRace = await findExistingRaceBySourceUrl(admin.serviceConfig, utmbRace.normalizedUrl);

    if (body.action === "preview") {
      return withSecurityHeaders(
        NextResponse.json({
          preview: {
            url: utmbRace.normalizedUrl,
            courseName: utmbRace.courseName,
            eventName: utmbRace.eventName,
            distanceKm: utmbRace.distanceKm,
            elevationGainM: utmbRace.elevationGainM,
            elevationLossM: utmbRace.elevationLossM,
            date: utmbRace.date,
            location: utmbRace.location,
            gpxUrl: utmbRace.gpxUrl,
            aidStationCount: utmbRace.aidStations.length,
          },
          duplicateRace,
        })
      );
    }

    if (duplicateRace) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            message: "Cette course UTMB existe déjà dans le catalogue.",
            duplicateRace,
          },
          { status: 409 }
        )
      );
    }

    let raceEventId: string | null;
    try {
      raceEventId = await ensureRaceEventId(admin.serviceConfig, {
        name: utmbRace.eventName,
        location: utmbRace.location,
        race_date: utmbRace.date,
        isLive: body.isLive,
      });
    } catch (error) {
      console.error("Unable to resolve UTMB race event", error);
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de créer ou rattacher l'événement UTMB." }, { status: 502 })
      );
    }

    const gpxResponse = await fetch(utmbRace.gpxUrl, {
      cache: "no-store",
      headers: { "user-agent": "Pace Yourself UTMB Importer" },
    }).catch(() => null);

    if (!gpxResponse?.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de télécharger le GPX officiel UTMB." }, { status: 502 })
      );
    }

    const gpxContent = await gpxResponse.text();

    let parsedGpx;
    try {
      parsedGpx = parseGpx(gpxContent);
    } catch (error) {
      console.error("Unable to parse UTMB GPX", error);
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de parser le GPX officiel UTMB." }, { status: 422 })
      );
    }

    const raceId = randomUUID();
    const storagePath = `catalog/${raceId}/utmb-${Date.now()}.gpx`;
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
        body: gpxContent,
      }
    );

    if (!uploadResponse.ok) {
      console.error("Unable to upload imported UTMB GPX", await uploadResponse.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible d’enregistrer le GPX UTMB." }, { status: 502 })
      );
    }

    const gpxSha = createHash("sha256").update(gpxContent).digest("hex");
    const insertResponse = await fetch(`${admin.serviceConfig.supabaseUrl}/rest/v1/races`, {
      method: "POST",
      headers: {
        ...buildServiceHeaders(admin.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: raceId,
        slug: buildSlug(utmbRace.courseName),
        name: utmbRace.courseName,
        event_id: raceEventId,
        race_date: utmbRace.date,
        location_text: utmbRace.location,
        trace_provider: "utmb",
        source_url: utmbRace.normalizedUrl,
        external_site_url: utmbRace.normalizedUrl,
        gpx_path: storagePath,
        gpx_hash: gpxSha,
        gpx_storage_path: storagePath,
        gpx_sha256: gpxSha,
        distance_km: utmbRace.distanceKm,
        elevation_gain_m: utmbRace.elevationGainM,
        elevation_loss_m: utmbRace.elevationLossM,
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
      console.error("Unable to create imported UTMB race", await insertResponse.text());
      await fetch(`${admin.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
        method: "DELETE",
        headers: {
          apikey: admin.serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${admin.serviceConfig.supabaseServiceRoleKey}`,
        },
      });
      return withSecurityHeaders(
        NextResponse.json({ message: "Impossible de créer la course UTMB." }, { status: 502 })
      );
    }

    const insertedRace = z.array(raceRowSchema).parse(await insertResponse.json())[0];

    if (utmbRace.aidStations.length > 0) {
      const aidInsertResponse = await fetch(`${admin.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
        method: "POST",
        headers: {
          ...buildServiceHeaders(admin.serviceConfig),
          Prefer: "return=minimal",
        },
        body: JSON.stringify(
          utmbRace.aidStations.map((station, index) => ({
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
        console.error("Unable to insert imported UTMB aid stations", await aidInsertResponse.text());
      }
    }

    return withSecurityHeaders(
      NextResponse.json({
        race: insertedRace,
        preview: {
          url: utmbRace.normalizedUrl,
          courseName: utmbRace.courseName,
          eventName: utmbRace.eventName,
          distanceKm: utmbRace.distanceKm,
          elevationGainM: utmbRace.elevationGainM,
          elevationLossM: utmbRace.elevationLossM,
          date: utmbRace.date,
          location: utmbRace.location,
          aidStationCount: utmbRace.aidStations.length,
        },
      })
    );
  } catch (error) {
    if (error instanceof UtmbImportError) {
      const status =
        error.code === "INVALID_URL" ? 400 : error.code === "INVALID_DATA" ? 422 : 502;
      return withSecurityHeaders(NextResponse.json({ message: error.message }, { status }));
    }

    console.error("Unexpected UTMB import error", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Impossible de récupérer les données UTMB pour cette course" }, { status: 500 })
    );
  }
}
