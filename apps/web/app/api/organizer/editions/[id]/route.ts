import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../lib/organizer";

const updateEditionSchema = z.object({ isVisible: z.boolean() });

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean(),
  is_visible: z.boolean(),
});

const editionAccessSchema = editionSchema.pick({ id: true, event_id: true, edition_year: true });

const editionRaceSchema = z.object({
  id: z.string().uuid(),
  gpx_storage_path: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
});

const deleteResultSchema = z.object({
  deleted_edition_id: z.string().uuid(),
  next_edition_id: z.string().uuid(),
  next_edition_year: z.number().int(),
});

const getPublicRaceImageStoragePath = (supabaseUrl: string, publicUrl: string | null | undefined) => {
  if (!publicUrl) return null;
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/race-images/`;
  return publicUrl.startsWith(publicPrefix) ? publicUrl.slice(publicPrefix.length) : null;
};

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

const isRaceImageStillReferenced = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  publicUrl: string
) => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?thumbnail_url=eq.${encodeURIComponent(publicUrl)}&select=id&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  ).catch(() => null);
  if (!response?.ok) return true;
  return z.array(z.object({ id: z.string().uuid() })).parse(await response.json()).length > 0;
};

const readEdition = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  editionId: string
) => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=id,event_id,edition_year&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) return { error: jsonError("Unable to load event edition.", 502) } as const;
  const edition = z.array(editionAccessSchema).parse(await response.json())[0] ?? null;
  if (!edition) return { error: jsonError("Event edition not found.", 404) } as const;
  return { edition } as const;
};

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);

  const parsedBody = updateEditionSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid edition visibility.", 400);

  const editionRead = await readEdition(auth.serviceConfig, parsedParams.data.id);
  if ("error" in editionRead) return editionRead.error;

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, editionRead.edition.event_id);
  if (organizer !== true) return organizer.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({ is_visible: parsedBody.data.isVisible }),
      cache: "no-store",
    }
  );
  if (!response.ok) return jsonError("Unable to update edition visibility.", 502);

  const edition = z.array(editionSchema).parse(await response.json())[0] ?? null;
  if (!edition) return jsonError("Event edition not found.", 404);

  return withSecurityHeaders(NextResponse.json({ edition }));
}

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);

  const editionRead = await readEdition(auth.serviceConfig, parsedParams.data.id);
  if ("error" in editionRead) return editionRead.error;

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, editionRead.edition.event_id);
  if (organizer !== true) return organizer.error;

  const racesResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${parsedParams.data.id}&select=id,gpx_storage_path,thumbnail_url`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!racesResponse.ok) return jsonError("Unable to load edition formats before delete.", 502);
  const races = z.array(editionRaceSchema).parse(await racesResponse.json());

  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/delete_race_event_edition`,
    {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({ p_edition_id: parsedParams.data.id }),
      cache: "no-store",
    }
  );
  if (!deleteResponse.ok) {
    const errorPayload = (await deleteResponse.json().catch(() => null)) as { message?: string } | null;
    if (errorPayload?.message === "The only edition cannot be deleted.") {
      return jsonError("La seule édition ne peut pas être supprimée. Supprime plutôt la course complète.", 409);
    }
    return jsonError("Unable to delete event edition.", 502);
  }

  const result = z.array(deleteResultSchema).parse(await deleteResponse.json())[0] ?? null;
  if (!result) return jsonError("Unable to delete event edition.", 502);

  const storageDeletes = races.flatMap((race) =>
    race.gpx_storage_path
      ? [deleteStorageObject(auth.serviceConfig, "race-gpx", race.gpx_storage_path)]
      : []
  );
  const imageUrls = Array.from(new Set(races.map((race) => race.thumbnail_url).filter((url): url is string => Boolean(url))));
  for (const imageUrl of imageUrls) {
    const imagePath = getPublicRaceImageStoragePath(auth.serviceConfig.supabaseUrl, imageUrl);
    if (imagePath && !(await isRaceImageStillReferenced(auth.serviceConfig, imageUrl))) {
      storageDeletes.push(deleteStorageObject(auth.serviceConfig, "race-images", imagePath));
    }
  }
  await Promise.all(storageDeletes);

  return withSecurityHeaders(NextResponse.json({
    deletedEditionId: result.deleted_edition_id,
    selectedEditionId: result.next_edition_id,
    selectedEditionYear: result.next_edition_year,
  }));
}
