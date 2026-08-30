import { randomUUID } from "crypto";
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
import {
  MAX_RACEBOOK_LOADING_SPONSORS,
  MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES,
  MAX_RACEBOOK_SPONSORS_PER_EDITION,
  RACEBOOK_SPONSOR_IMAGE_TYPES,
  racebookSponsorRowSchema,
  sponsorMetadataSchema,
  toOrganizerSponsor,
} from "../../../../../../lib/racebook-sponsors";

const editionSchema = z.object({ id: z.string().uuid(), event_id: z.string().uuid() });

async function loadAuthorizedEdition(
  request: NextRequest,
  editionId: string,
) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=id,event_id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) return { error: jsonError("Unable to load edition.", 502) };

  const edition = z.array(editionSchema).parse(await response.json())[0] ?? null;
  if (!edition) return { error: jsonError("Edition not found.", 404) };

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (organizer !== true) return organizer;
  return { ...auth, edition };
}

async function loadSponsors(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  editionId: string,
) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?edition_id=eq.${editionId}&select=*&order=position.asc,created_at.asc`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(await response.text());
  return z.array(racebookSponsorRowSchema).parse(await response.json());
}

const readBoolean = (formData: FormData, key: string, fallback = false) => {
  const value = formData.get(key);
  if (value === null) return fallback;
  return value === "true" || value === "1" || value === "on";
};

const deleteUploadedLogo = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  storagePath: string,
) => {
  await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
};

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);
  const auth = await loadAuthorizedEdition(request, parsedParams.data.id);
  if ("error" in auth) return auth.error;

  try {
    const sponsors = await loadSponsors(auth.serviceConfig, auth.edition.id);
    return withSecurityHeaders(NextResponse.json({ sponsors: sponsors.map(toOrganizerSponsor) }));
  } catch (error) {
    console.error("Unable to load edition sponsors", error);
    return jsonError("Unable to load sponsors.", 502);
  }
}

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);
  const auth = await loadAuthorizedEdition(request, parsedParams.data.id);
  if ("error" in auth) return auth.error;

  const formData = (await request.formData().catch(() => null)) as FormData | null;
  if (!formData) return jsonError("Invalid form data.", 400);
  const image = formData.get("image");
  if (!(image instanceof File)) return jsonError("Sponsor logo is required.", 400);
  const extension = RACEBOOK_SPONSOR_IMAGE_TYPES.get(image.type);
  if (!extension) return jsonError("Use a PNG, JPEG, WebP or AVIF logo.", 400);
  if (image.size > MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES) return jsonError("Logo is too large (max 5 MB).", 400);

  let existing;
  try {
    existing = await loadSponsors(auth.serviceConfig, auth.edition.id);
  } catch (error) {
    console.error("Unable to validate sponsor limits", error);
    return jsonError("Unable to validate sponsors.", 502);
  }
  if (existing.length >= MAX_RACEBOOK_SPONSORS_PER_EDITION) return jsonError("An edition can have at most 10 sponsors.", 409);

  const metadata = sponsorMetadataSchema.safeParse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl"),
    isActive: readBoolean(formData, "isActive", true),
    showOnLoading: readBoolean(formData, "showOnLoading"),
    showInBanner: readBoolean(formData, "showInBanner", true),
    position: existing.length,
  });
  if (!metadata.success) return jsonError(metadata.error.issues[0]?.message ?? "Invalid sponsor.", 400);
  if (
    metadata.data.isActive &&
    metadata.data.showOnLoading &&
    existing.filter((sponsor) => sponsor.is_active && sponsor.show_on_loading).length >= MAX_RACEBOOK_LOADING_SPONSORS
  ) {
    return jsonError("Only two sponsors can appear on the loading screen.", 409);
  }

  const sponsorId = randomUUID();
  const storagePath = `organizer-sponsors/${auth.edition.id}/${sponsorId}-${Date.now()}.${extension}`;
  const uploadResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig, image.type), "x-upsert": "false" },
    body: image,
    cache: "no-store",
  });
  if (!uploadResponse.ok) {
    console.error("Unable to upload sponsor logo", await uploadResponse.text());
    return jsonError("Unable to upload sponsor logo.", 502);
  }

  const logoUrl = `${auth.serviceConfig.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;
  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      id: sponsorId,
      edition_id: auth.edition.id,
      name: metadata.data.name,
      logo_url: logoUrl,
      website_url: metadata.data.websiteUrl,
      is_active: metadata.data.isActive,
      show_on_loading: metadata.data.showOnLoading,
      show_in_banner: metadata.data.showInBanner,
      position: metadata.data.position,
    }),
    cache: "no-store",
  });
  if (!insertResponse.ok) {
    console.error("Unable to create sponsor", await insertResponse.text());
    await deleteUploadedLogo(auth.serviceConfig, storagePath);
    return jsonError("Unable to create sponsor.", 502);
  }

  const sponsor = z.array(racebookSponsorRowSchema).parse(await insertResponse.json())[0];
  return withSecurityHeaders(NextResponse.json({ sponsor: sponsor ? toOrganizerSponsor(sponsor) : null }, { status: 201 }));
}
