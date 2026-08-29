import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  loadRaceForOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../../lib/http";
import {
  organizerRaceDetailsSchema,
  parseOrganizerRaceDetails,
} from "../../../../../lib/organizer-dashboard-details";

const optionalPatchTextOrNull = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value && value.length > 0 ? value : null));

const updateRaceSchema = z.object({
  seriesName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  distanceKm: z.coerce.number().positive().optional(),
  elevationGainM: z.coerce.number().nonnegative().optional(),
  elevationLossM: z.coerce.number().nonnegative().nullable().optional(),
  externalSiteUrl: optionalPatchTextOrNull,
  locationText: optionalPatchTextOrNull,
  raceDate: optionalPatchTextOrNull,
  thumbnailUrl: optionalPatchTextOrNull,
  organizerDetails: organizerRaceDetailsSchema.optional(),
  participationMode: z.enum(["solo", "relay", "solo_and_relay"]).optional(),
  racebookIsLive: z.boolean().optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid().nullable().optional(),
  edition_group_id: z.string().uuid(),
  series_name: z.string(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  participation_mode: z.enum(["solo", "relay", "solo_and_relay"]).nullable().optional(),
  data_status: z.enum(["draft", "complete"]).optional().default("complete"),
  missing_required_fields: z.array(z.enum(["race_date", "distance_km", "elevation_gain_m"])).optional().default([]),
  racebook_is_live: z.boolean().default(false),
  racebook_publication_approved_at: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
});

const raceDeleteReadSchema = z.object({
  id: z.string().uuid(),
  gpx_storage_path: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
});

const deleteStorageObject = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  bucket: string,
  storagePath: string
) => {
  await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
};

const getPublicRaceImageStoragePath = (supabaseUrl: string, publicUrl: string | null | undefined) => {
  if (!publicUrl) return null;
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/race-images/`;
  return publicUrl.startsWith(publicPrefix) ? publicUrl.slice(publicPrefix.length) : null;
};

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;
  const parsedBody = updateRaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid race fields.", 400);
  if (parsedBody.data.racebookIsLive === true && (race.data_status ?? "complete") === "draft") {
    return jsonError("Complète les informations minimales du format avant de publier son Racebook.", 409);
  }
  if (parsedBody.data.raceDate !== undefined && parsedBody.data.raceDate !== null) {
    if (!race.edition_id) return jsonError("This format is not attached to an event edition.", 409);
    const editionResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${race.edition_id}&select=start_date,end_date&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!editionResponse.ok) return jsonError("Unable to inspect event edition.", 502);
    const edition = z.array(z.object({ start_date: z.string(), end_date: z.string() })).parse(await editionResponse.json())[0] ?? null;
    if (!edition) return jsonError("Event edition not found.", 409);
    if (parsedBody.data.raceDate < edition.start_date || parsedBody.data.raceDate > edition.end_date) {
      return jsonError("La date du format doit rester dans la plage de l'édition.", 409);
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsedBody.data.seriesName !== undefined) updatePayload.series_name = parsedBody.data.seriesName;
  if (parsedBody.data.name !== undefined) updatePayload.name = parsedBody.data.name;
  if (parsedBody.data.distanceKm !== undefined) updatePayload.distance_km = Number(parsedBody.data.distanceKm.toFixed(2));
  if (parsedBody.data.elevationGainM !== undefined) updatePayload.elevation_gain_m = Math.round(parsedBody.data.elevationGainM);
  if (parsedBody.data.elevationLossM !== undefined) {
    updatePayload.elevation_loss_m = parsedBody.data.elevationLossM === null ? null : Math.round(parsedBody.data.elevationLossM);
  }
  if (parsedBody.data.externalSiteUrl !== undefined) updatePayload.external_site_url = parsedBody.data.externalSiteUrl;
  if (parsedBody.data.locationText !== undefined) updatePayload.location_text = parsedBody.data.locationText;
  if (parsedBody.data.raceDate !== undefined) updatePayload.race_date = parsedBody.data.raceDate;
  if (parsedBody.data.thumbnailUrl !== undefined) updatePayload.thumbnail_url = parsedBody.data.thumbnailUrl;
  if (parsedBody.data.organizerDetails !== undefined) updatePayload.organizer_details = parsedBody.data.organizerDetails;
  if (parsedBody.data.participationMode !== undefined) updatePayload.participation_mode = parsedBody.data.participationMode;

  const requiredFieldChanged =
    parsedBody.data.raceDate !== undefined ||
    parsedBody.data.distanceKm !== undefined ||
    parsedBody.data.elevationGainM !== undefined;
  const currentDataStatus = race.data_status ?? "complete";
  if (requiredFieldChanged || currentDataStatus === "draft") {
    const missingRequiredFields = new Set(race.missing_required_fields ?? []);
    if (parsedBody.data.raceDate !== undefined) {
      if (parsedBody.data.raceDate === null) missingRequiredFields.add("race_date");
      else missingRequiredFields.delete("race_date");
    }
    if (parsedBody.data.distanceKm !== undefined) missingRequiredFields.delete("distance_km");
    if (parsedBody.data.elevationGainM !== undefined) missingRequiredFields.delete("elevation_gain_m");
    const nextDataStatus = missingRequiredFields.size === 0 ? "complete" : "draft";
    updatePayload.missing_required_fields = [...missingRequiredFields];
    updatePayload.data_status = nextDataStatus;
    if (nextDataStatus === "draft") {
      updatePayload.is_live = false;
      updatePayload.racebook_is_live = false;
    } else if (currentDataStatus === "draft") {
      updatePayload.is_live = true;
      updatePayload.racebook_is_live = false;
    }
  }

  let visibilityUpdated: z.infer<typeof raceRowSchema> | null = null;
  if (parsedBody.data.racebookIsLive !== undefined) {
    const visibilityResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/set_organizer_racebook_visibility`,
      {
        method: "POST",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({
          p_user_id: auth.user.id,
          p_race_id: parsedParams.data.id,
          p_is_live: parsedBody.data.racebookIsLive,
        }),
        cache: "no-store",
      }
    );
    if (!visibilityResponse.ok) {
      console.error("Unable to update organizer Racebook visibility", await visibilityResponse.text());
      return jsonError(
        parsedBody.data.racebookIsLive
          ? "Une offre RaceBook active est requise pour publier ce format."
          : "Impossible de masquer ce Racebook.",
        403
      );
    }
    visibilityUpdated = raceRowSchema.parse(await visibilityResponse.json());
  }

  if (Object.keys(updatePayload).length === 0) {
    if (!visibilityUpdated) return jsonError("No fields to update.", 400);
    return withSecurityHeaders(
      NextResponse.json({
        race: { ...visibilityUpdated, organizerDetails: parseOrganizerRaceDetails(visibilityUpdated.organizer_details) },
      })
    );
  }

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

  if (parsedBody.data.participationMode === "solo") {
    const relayCleanupResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_relay_points?race_id=eq.${parsedParams.data.id}`,
      { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    if (!relayCleanupResponse.ok) {
      console.error("Unable to clear relay points after switching to solo", await relayCleanupResponse.text());
      return jsonError("Format updated, but unable to clear relay points.", 502);
    }
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

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const raceReadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}&select=id,gpx_storage_path,thumbnail_url&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!raceReadResponse.ok) {
    console.error("Unable to load organizer race before delete", await raceReadResponse.text());
    return jsonError("Unable to load race before delete.", 502);
  }

  const raceRow = z.array(raceDeleteReadSchema).parse(await raceReadResponse.json())[0] ?? null;
  if (!raceRow) return jsonError("Race not found.", 404);

  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "DELETE",
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete organizer race", await deleteResponse.text());
    return jsonError("Unable to delete race format.", 502);
  }

  if (raceRow.gpx_storage_path) {
    await deleteStorageObject(auth.serviceConfig, "race-gpx", raceRow.gpx_storage_path);
  }

  const raceImageStoragePath = getPublicRaceImageStoragePath(auth.serviceConfig.supabaseUrl, raceRow.thumbnail_url);
  if (raceImageStoragePath) {
    await deleteStorageObject(auth.serviceConfig, "race-images", raceImageStoragePath);
  }

  return withSecurityHeaders(NextResponse.json({ deleted: true, raceId: parsedParams.data.id, eventId: race.event_id }));
}
