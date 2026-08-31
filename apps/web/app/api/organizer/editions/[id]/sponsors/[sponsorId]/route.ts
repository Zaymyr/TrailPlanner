import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../../../../lib/organizer";
import { requireOrganizerEditionCapability } from "../../../../../../../lib/organizer-entitlements";
import {
  MAX_RACEBOOK_LOADING_SPONSORS,
  MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES,
  RACEBOOK_SPONSOR_IMAGE_TYPES,
  racebookSponsorRowSchema,
  sponsorMetadataSchema,
  toOrganizerSponsor,
} from "../../../../../../../lib/racebook-sponsors";

const paramsSchema = z.object({ id: z.string().uuid(), sponsorId: z.string().uuid() });
const editionSchema = z.object({ event_id: z.string().uuid() });

const storagePathFromPublicUrl = (supabaseUrl: string, url: string | null | undefined) => {
  const prefix = `${supabaseUrl}/storage/v1/object/public/race-images/`;
  return url?.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
};

async function authorize(request: NextRequest, editionId: string, sponsorId: string) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;
  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=event_id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!editionResponse.ok) return { error: jsonError("Unable to load edition.", 502) };
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0] ?? null;
  if (!edition) return { error: jsonError("Edition not found.", 404) };
  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (organizer !== true) return organizer;
  if (!(await requireOrganizerEditionCapability(auth.serviceConfig, editionId, "sponsors.manage"))) {
    return { error: jsonError("RaceBook Pro is required to manage sponsors.", 403) };
  }

  const sponsorResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${sponsorId}&edition_id=eq.${editionId}&select=*&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!sponsorResponse.ok) return { error: jsonError("Unable to load sponsor.", 502) };
  const sponsor = z.array(racebookSponsorRowSchema).parse(await sponsorResponse.json())[0] ?? null;
  if (!sponsor) return { error: jsonError("Sponsor not found.", 404) };
  return { ...auth, sponsor };
}

export async function PATCH(request: NextRequest, context: { params: { id?: string; sponsorId?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid sponsor id.", 400);
  const auth = await authorize(request, parsedParams.data.id, parsedParams.data.sponsorId);
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const metadata = sponsorMetadataSchema.safeParse(body);
  if (!metadata.success) return jsonError(metadata.error.issues[0]?.message ?? "Invalid sponsor.", 400);

  if (metadata.data.isActive && metadata.data.showOnLoading) {
    const loadingResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?edition_id=eq.${parsedParams.data.id}&id=neq.${parsedParams.data.sponsorId}&is_active=eq.true&show_on_loading=eq.true&select=id`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    if (!loadingResponse.ok) return jsonError("Unable to validate sponsor placements.", 502);
    const loadingRows = z.array(z.object({ id: z.string().uuid() })).parse(await loadingResponse.json());
    if (loadingRows.length >= MAX_RACEBOOK_LOADING_SPONSORS) return jsonError("Only two sponsors can appear on the loading screen.", 409);
  }

  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${parsedParams.data.sponsorId}&edition_id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        name: metadata.data.name,
        website_url: metadata.data.websiteUrl,
        is_active: metadata.data.isActive,
        show_on_loading: metadata.data.showOnLoading,
        show_in_banner: metadata.data.showInBanner,
        position: metadata.data.position,
      }),
      cache: "no-store",
    },
  );
  if (!updateResponse.ok) {
    console.error("Unable to update sponsor", await updateResponse.text());
    return jsonError("Unable to update sponsor.", 502);
  }
  const sponsor = z.array(racebookSponsorRowSchema).parse(await updateResponse.json())[0];
  return withSecurityHeaders(NextResponse.json({ sponsor: sponsor ? toOrganizerSponsor(sponsor) : null }));
}

export async function PUT(request: NextRequest, context: { params: { id?: string; sponsorId?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid sponsor id.", 400);
  const auth = await authorize(request, parsedParams.data.id, parsedParams.data.sponsorId);
  if ("error" in auth) return auth.error;
  const formData = (await request.formData().catch(() => null)) as FormData | null;
  const image = formData?.get("image");
  if (!(image instanceof File)) return jsonError("Sponsor logo is required.", 400);
  const extension = RACEBOOK_SPONSOR_IMAGE_TYPES.get(image.type);
  if (!extension) return jsonError("Use a PNG, JPEG, WebP or AVIF logo.", 400);
  if (image.size > MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES) return jsonError("Logo is too large (max 5 MB).", 400);

  const storagePath = `organizer-sponsors/${parsedParams.data.id}/${auth.sponsor.id}-${Date.now()}.${extension}`;
  const uploadResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig, image.type), "x-upsert": "false" },
    body: image,
    cache: "no-store",
  });
  if (!uploadResponse.ok) return jsonError("Unable to upload sponsor logo.", 502);
  const logoUrl = `${auth.serviceConfig.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;
  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${auth.sponsor.id}&edition_id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({ logo_url: logoUrl }),
      cache: "no-store",
    },
  );
  if (!updateResponse.ok) {
    await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
      method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store",
    }).catch(() => null);
    return jsonError("Unable to update sponsor logo.", 502);
  }
  const oldPath = storagePathFromPublicUrl(auth.serviceConfig.supabaseUrl, auth.sponsor.logo_url);
  if (oldPath) {
    await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${oldPath}`, {
      method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store",
    }).catch(() => null);
  }
  const sponsor = z.array(racebookSponsorRowSchema).parse(await updateResponse.json())[0];
  return withSecurityHeaders(NextResponse.json({ sponsor: sponsor ? toOrganizerSponsor(sponsor) : null }));
}

export async function DELETE(request: NextRequest, context: { params: { id?: string; sponsorId?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid sponsor id.", 400);
  const auth = await authorize(request, parsedParams.data.id, parsedParams.data.sponsorId);
  if ("error" in auth) return auth.error;
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${auth.sponsor.id}&edition_id=eq.${parsedParams.data.id}`,
    { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) return jsonError("Unable to delete sponsor.", 502);
  const oldPath = storagePathFromPublicUrl(auth.serviceConfig.supabaseUrl, auth.sponsor.logo_url);
  if (oldPath) {
    await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${oldPath}`, {
      method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store",
    }).catch(() => null);
  }
  return withSecurityHeaders(NextResponse.json({ deletedSponsorId: auth.sponsor.id }));
}
