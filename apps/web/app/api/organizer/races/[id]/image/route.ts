import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  loadRaceForOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";

const MAX_RACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RACE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

const raceImageRowSchema = z.object({
  id: z.string().uuid(),
  thumbnail_url: z.string().nullable().optional(),
});

const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

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
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const formData = (await request.formData().catch(() => null)) as globalThis.FormData | null;
  if (!formData) return jsonError("Invalid form data.", 400);

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) return jsonError("Image file is required.", 400);
  if (!ALLOWED_RACE_IMAGE_TYPES.has(imageFile.type)) {
    return jsonError("Invalid image type. Use JPEG, PNG, WebP or AVIF.", 400);
  }
  if (imageFile.size > MAX_RACE_IMAGE_SIZE_BYTES) return jsonError("Image is too large (max 5 MB).", 400);

  const extension = IMAGE_EXTENSION_BY_TYPE[imageFile.type] ?? "png";
  const storagePath = `organizer-races/${race.event_id}/${parsedParams.data.id}/thumbnail-${Date.now()}.${extension}`;
  const uploadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(auth.serviceConfig, imageFile.type),
        "x-upsert": "true",
      },
      body: imageFile,
      cache: "no-store",
    }
  );

  if (!uploadResponse.ok) {
    console.error("Unable to upload organizer race image", await uploadResponse.text());
    return jsonError("Unable to upload image.", 502);
  }

  const publicUrl = `${auth.serviceConfig.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;
  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
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
    console.error("Unable to update organizer race image", await updateResponse.text());
    await deleteUploadedImage(auth.serviceConfig, storagePath);
    return jsonError("Unable to update race image.", 502);
  }

  const updatedRace = z.array(raceImageRowSchema).parse(await updateResponse.json())[0] ?? null;
  return withSecurityHeaders(NextResponse.json({ thumbnailUrl: publicUrl, race: updatedRace }));
}
