import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";

const MAX_EVENT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const EVENT_IMAGE_TYPE = "image/png";

const eventImageRowSchema = z.object({
  id: z.string().uuid(),
  thumbnail_url: z.string().nullable().optional(),
});

const deleteUploadedImage = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  storagePath: string
) => {
  await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
};

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const formData = (await request.formData().catch(() => null)) as globalThis.FormData | null;
  if (!formData) return jsonError("Invalid form data.", 400);

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) return jsonError("PNG image file is required.", 400);
  if (imageFile.type !== EVENT_IMAGE_TYPE) return jsonError("Invalid image type. Use PNG.", 400);
  if (imageFile.size > MAX_EVENT_IMAGE_SIZE_BYTES) return jsonError("Image is too large (max 5 MB).", 400);

  const storagePath = `organizer-events/${parsedParams.data.id}/thumbnail-${Date.now()}.png`;
  const uploadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(auth.serviceConfig, EVENT_IMAGE_TYPE),
        "x-upsert": "true",
      },
      body: imageFile,
      cache: "no-store",
    }
  );

  if (!uploadResponse.ok) {
    console.error("Unable to upload organizer event image", await uploadResponse.text());
    return jsonError("Unable to upload image.", 502);
  }

  const publicUrl = `${auth.serviceConfig.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;
  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({ thumbnail_url: publicUrl }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update organizer event image", await updateResponse.text());
    await deleteUploadedImage(auth.serviceConfig, storagePath);
    return jsonError("Unable to update event image.", 502);
  }

  const event = z.array(eventImageRowSchema).parse(await updateResponse.json())[0] ?? null;
  return withSecurityHeaders(NextResponse.json({ thumbnailUrl: publicUrl, event }));
}
