import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  type SupabaseServiceConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

// Creates a draft race_events/races pair from data already collected by
// scripts/scrape-betrail-organizer-emails.mjs. It never fetches BeTrail
// itself (Cloudflare blocks server-side requests) and never publishes:
// every row is forced to data_status="draft" / is_live=false so the
// existing races_draft_is_hidden database constraint keeps it out of the
// public catalog until an admin completes and reviews it.

const formatSchema = z.object({
  distance: z.string().trim().min(1),
  elevation: z.string().trim().min(1),
});

const requestSchema = z.object({
  raceUrl: z.string().trim().url(),
  raceName: z.string().trim().min(1),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  officialWebsite: z.string().trim().url().nullable().optional(),
  formats: z.array(formatSchema).min(1),
  action: z.enum(["preview", "import"]).default("preview"),
});

const raceEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  race_date: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  data_status: z.string(),
  missing_required_fields: z.array(z.string()),
  is_live: z.boolean(),
});

type SupabaseServiceContext = { serviceConfig: SupabaseServiceConfig };

const buildServiceHeaders = (serviceConfig: SupabaseServiceConfig, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const suffix = randomUUID().slice(0, 4);
  return base ? `${base}-${suffix}` : `race-${suffix}`;
};

const normalizeComparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const parseDistanceKm = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
};

export const parseElevationM = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*d\s*\+/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
};

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
    return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) } as const;
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 })) } as const;
  }

  if (!isAdminUser(supabaseUser)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 })) } as const;
  }

  return { serviceConfig: supabaseService } as const;
}

async function findExistingRaceEvent(context: SupabaseServiceContext, eventName: string) {
  const response = await fetch(
    `${context.serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,race_date,website_url&name=ilike.*${encodeURIComponent(
      eventName
    )}*&limit=20`,
    { headers: buildServiceHeaders(context.serviceConfig, undefined), cache: "no-store" }
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
  context: SupabaseServiceContext,
  payload: { name: string; race_date: string | null; website_url: string | null }
) {
  const response = await fetch(`${context.serviceConfig.supabaseUrl}/rest/v1/race_events`, {
    method: "POST",
    headers: { ...buildServiceHeaders(context.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, is_live: false }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to create draft race event", await response.text());
    throw new Error("Unable to create race event.");
  }

  const rows = z.array(raceEventSchema).parse(await response.json());
  return rows[0] ?? null;
}

async function ensureRaceEventId(
  context: SupabaseServiceContext,
  payload: { name: string; race_date: string | null; website_url: string | null }
) {
  const existing = await findExistingRaceEvent(context, payload.name);
  if (existing) return existing.id;

  const created = await createRaceEvent(context, payload);
  return created?.id ?? null;
}

async function findExistingFormatRace(
  context: SupabaseServiceContext,
  eventId: string,
  sourceUrl: string,
  distanceKm: number
) {
  const response = await fetch(
    `${context.serviceConfig.supabaseUrl}/rest/v1/races?select=id,name,slug&event_id=eq.${eventId}&source_url=eq.${encodeURIComponent(
      sourceUrl
    )}&distance_km=eq.${distanceKm}&limit=1`,
    { headers: buildServiceHeaders(context.serviceConfig, undefined), cache: "no-store" }
  );

  if (!response.ok) {
    console.error("Unable to check existing BeTrail-imported race", await response.text());
    throw new Error("Unable to check existing races.");
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string; name: string; slug: string }>;
  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const context: SupabaseServiceContext = { serviceConfig: admin.serviceConfig };

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json().catch(() => null));
  } catch {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  if (!/(^|\.)betrail\.run$/i.test(new URL(body.raceUrl).hostname)) {
    return withSecurityHeaders(NextResponse.json({ message: "raceUrl doit venir de betrail.run." }, { status: 400 }));
  }

  const date = body.date ?? null;
  const officialWebsite = body.officialWebsite ?? null;
  const parsedFormats = body.formats.map((format) => ({
    ...format,
    distanceKm: parseDistanceKm(format.distance),
    elevationGainM: parseElevationM(format.elevation),
  }));

  if (body.action === "preview") {
    let existingEvent: Awaited<ReturnType<typeof findExistingRaceEvent>> = null;
    try {
      existingEvent = await findExistingRaceEvent(context, body.raceName);
    } catch (error) {
      console.error("Unable to preview BeTrail import", error);
      return withSecurityHeaders(NextResponse.json({ message: "Impossible de prévisualiser cet import." }, { status: 502 }));
    }
    return withSecurityHeaders(
      NextResponse.json({
        preview: { raceName: body.raceName, date, officialWebsite, formats: parsedFormats },
        duplicateEvent: existingEvent,
      })
    );
  }

  let eventId: string | null;
  try {
    eventId = await ensureRaceEventId(context, { name: body.raceName, race_date: date, website_url: officialWebsite });
  } catch (error) {
    console.error("Unable to resolve BeTrail race event", error);
    return withSecurityHeaders(NextResponse.json({ message: "Impossible de créer ou rattacher l'événement." }, { status: 502 }));
  }

  if (!eventId) {
    return withSecurityHeaders(NextResponse.json({ message: "Impossible de créer l'événement." }, { status: 502 }));
  }

  const createdRaces: z.infer<typeof raceRowSchema>[] = [];
  const skippedFormats: string[] = [];

  for (const format of parsedFormats) {
    const distanceKm = format.distanceKm ?? 0;
    try {
      const duplicate = await findExistingFormatRace(context, eventId, body.raceUrl, distanceKm);
      if (duplicate) {
        skippedFormats.push(format.distance);
        continue;
      }
    } catch (error) {
      console.error("Unable to check duplicate BeTrail format", error);
      return withSecurityHeaders(NextResponse.json({ message: "Impossible de vérifier les doublons." }, { status: 502 }));
    }

    const missingRequiredFields: string[] = [];
    if (!date) missingRequiredFields.push("race_date");
    if (format.distanceKm === null) missingRequiredFields.push("distance_km");
    if (format.elevationGainM === null) missingRequiredFields.push("elevation_gain_m");

    const raceId = randomUUID();
    const raceName = `${body.raceName} ${format.distance}`.trim();

    const insertResponse = await fetch(`${context.serviceConfig.supabaseUrl}/rest/v1/races`, {
      method: "POST",
      headers: { ...buildServiceHeaders(context.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        id: raceId,
        slug: buildSlug(raceName),
        name: raceName,
        event_id: eventId,
        edition_group_id: raceId,
        series_name: raceName,
        race_date: date,
        distance_km: format.distanceKm ?? 0,
        elevation_gain_m: format.elevationGainM ?? 0,
        elevation_loss_m: 0,
        external_site_url: officialWebsite,
        source_url: body.raceUrl,
        gpx_path: `betrail-import/${eventId}/${raceId}.gpx`,
        gpx_hash: `pending:${raceId}`,
        is_live: false,
        is_public: false,
        is_published: false,
        data_status: "draft",
        missing_required_fields: missingRequiredFields,
        created_by: null,
      }),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      console.error("Unable to create draft BeTrail race", await insertResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Impossible de créer un format de course." }, { status: 502 }));
    }

    const inserted = z.array(raceRowSchema).parse(await insertResponse.json())[0];
    if (inserted) createdRaces.push(inserted);
  }

  return withSecurityHeaders(NextResponse.json({ eventId, createdRaces, skippedFormats }));
}
