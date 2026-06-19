import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  loadRaceForOrganizer,
  optionalTextOrNull,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../../lib/http";
import {
  organizerRaceDetailsSchema,
  parseOrganizerRaceDetails,
} from "../../../../../lib/organizer-dashboard-details";

const updateRaceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  distanceKm: z.coerce.number().positive().optional(),
  elevationGainM: z.coerce.number().nonnegative().optional(),
  elevationLossM: z.coerce.number().nonnegative().nullable().optional(),
  locationText: optionalTextOrNull,
  raceDate: optionalTextOrNull,
  thumbnailUrl: optionalTextOrNull,
  isLive: z.boolean().optional(),
  organizerDetails: organizerRaceDetailsSchema.optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable().optional(),
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

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const parsedBody = updateRaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid race fields.", 400);

  const updatePayload: Record<string, unknown> = {};
  if (parsedBody.data.name !== undefined) updatePayload.name = parsedBody.data.name;
  if (parsedBody.data.distanceKm !== undefined) updatePayload.distance_km = Number(parsedBody.data.distanceKm.toFixed(2));
  if (parsedBody.data.elevationGainM !== undefined) updatePayload.elevation_gain_m = Math.round(parsedBody.data.elevationGainM);
  if (parsedBody.data.elevationLossM !== undefined) {
    updatePayload.elevation_loss_m = parsedBody.data.elevationLossM === null ? null : Math.round(parsedBody.data.elevationLossM);
  }
  if (parsedBody.data.locationText !== undefined) updatePayload.location_text = parsedBody.data.locationText;
  if (parsedBody.data.raceDate !== undefined) updatePayload.race_date = parsedBody.data.raceDate;
  if (parsedBody.data.thumbnailUrl !== undefined) updatePayload.thumbnail_url = parsedBody.data.thumbnailUrl;
  if (parsedBody.data.isLive !== undefined) updatePayload.is_live = parsedBody.data.isLive;
  if (parsedBody.data.organizerDetails !== undefined) updatePayload.organizer_details = parsedBody.data.organizerDetails;

  if (Object.keys(updatePayload).length === 0) return jsonError("No fields to update.", 400);

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to update organizer race", await response.text());
    return jsonError("Unable to update race format.", 502);
  }

  const updated = z.array(raceRowSchema).parse(await response.json())[0] ?? null;
  return withSecurityHeaders(
    NextResponse.json({
      race: updated
        ? {
            ...updated,
            organizerDetails: parseOrganizerRaceDetails(updated.organizer_details),
          }
        : null,
    })
  );
}
