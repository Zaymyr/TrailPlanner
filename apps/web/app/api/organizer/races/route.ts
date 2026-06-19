import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSlug,
  jsonError,
  optionalTextOrNull,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
} from "../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../lib/http";
import {
  organizerRaceDetailsSchema,
  parseOrganizerRaceDetails,
} from "../../../../lib/organizer-dashboard-details";

const createRaceSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1),
  distanceKm: z.coerce.number().positive(),
  elevationGainM: z.coerce.number().nonnegative().default(0),
  elevationLossM: z.coerce.number().nonnegative().nullable().optional(),
  locationText: optionalTextOrNull,
  raceDate: optionalTextOrNull,
  thumbnailUrl: optionalTextOrNull,
  isLive: z.boolean().optional().default(true),
  organizerDetails: organizerRaceDetailsSchema.optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  organizer_details: z.unknown().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsed = createRaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid race fields.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (organizer !== true) return organizer.error;

  const raceId = randomUUID();
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: raceId,
      event_id: parsed.data.eventId,
      slug: buildSlug(parsed.data.name),
      name: parsed.data.name,
      distance_km: Number(parsed.data.distanceKm.toFixed(2)),
      elevation_gain_m: Math.round(parsed.data.elevationGainM),
      elevation_loss_m: Math.round(parsed.data.elevationLossM ?? 0),
      location_text: parsed.data.locationText,
      race_date: parsed.data.raceDate,
      thumbnail_url: parsed.data.thumbnailUrl,
      organizer_details: parsed.data.organizerDetails ?? null,
      gpx_path: `organizer/${parsed.data.eventId}/${raceId}.gpx`,
      gpx_hash: `manual:${raceId}`,
      gpx_storage_path: null,
      gpx_sha256: null,
      is_live: parsed.data.isLive,
      is_public: true,
      created_by: null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to create organizer race", await response.text());
    return jsonError("Unable to create race format.", 502);
  }

  const race = z.array(raceRowSchema).parse(await response.json())[0];
  return withSecurityHeaders(
    NextResponse.json(
      {
        race: {
          ...race,
          organizerDetails: parseOrganizerRaceDetails(race.organizer_details),
        },
      },
      { status: 201 }
    )
  );
}
