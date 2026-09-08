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
import { requireOrganizerEditionCapability } from "../../../../../../lib/organizer-entitlements";
import {
  MAX_RACEBOOK_BRANDING_LOGO_SIZE_BYTES,
  RACEBOOK_BRANDING_LOGO_TYPES,
  defaultRacebookBranding,
  detectRacebookBrandingLogoType,
  racebookBrandingDraftSchema,
  racebookBrandingRowSchema,
  storagePathFromRacebookBrandingUrl,
  toOrganizerBranding,
  type RacebookBrandingRow,
} from "../../../../../../lib/racebook-branding";

const editionSchema = z.object({ id: z.string().uuid(), event_id: z.string().uuid() });

async function authorize(request: NextRequest, editionId: string) {
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
  if (!(await requireOrganizerEditionCapability(auth.serviceConfig, edition.id, "branding.manage"))) {
    return { error: jsonError("RaceBook Pro is required to manage branding.", 403) };
  }
  return { ...auth, edition };
}

async function loadBranding(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  editionId: string,
): Promise<RacebookBrandingRow | null> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_branding?edition_id=eq.${editionId}&select=*&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(await response.text());
  return z.array(racebookBrandingRowSchema).parse(await response.json())[0] ?? null;
}

async function upsertDraft(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  editionId: string,
  patch: Record<string, string | null>,
) {
  const existing = await loadBranding(serviceConfig, editionId);
  const defaults = defaultRacebookBranding();
  const response = await fetch(
    existing
      ? `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_branding?edition_id=eq.${editionId}`
      : `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_branding`,
    {
      method: existing ? "PATCH" : "POST",
      headers: {
        ...serviceHeaders(serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ...(existing
          ? {}
          : {
              edition_id: editionId,
              draft_primary_color: defaults.primaryColor,
              draft_accent_color: defaults.accentColor,
            }),
        ...patch,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(await response.text());
  return z.array(racebookBrandingRowSchema).parse(await response.json())[0] ?? null;
}

async function deleteLogoObject(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  url: string | null | undefined,
) {
  const path = storagePathFromRacebookBrandingUrl(serviceConfig.supabaseUrl, url);
  if (!path) return;
  await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-images/${path}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  }).catch(() => null);
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsed = uuidParamSchema.safeParse(context.params);
  if (!parsed.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, parsed.data.id);
  if ("error" in auth) return auth.error;
  try {
    return withSecurityHeaders(NextResponse.json({ branding: toOrganizerBranding(await loadBranding(auth.serviceConfig, auth.edition.id)) }));
  } catch (error) {
    console.error("Unable to load RaceBook branding", error);
    return jsonError("Unable to load RaceBook branding.", 502);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const parsed = uuidParamSchema.safeParse(context.params);
  if (!parsed.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, parsed.data.id);
  if ("error" in auth) return auth.error;
  const draft = racebookBrandingDraftSchema.safeParse(await request.json().catch(() => null));
  if (!draft.success) return jsonError(draft.error.issues[0]?.message ?? "Invalid RaceBook branding.", 400);
  try {
    const row = await upsertDraft(auth.serviceConfig, auth.edition.id, {
      draft_primary_color: draft.data.primaryColor,
      draft_accent_color: draft.data.accentColor,
    });
    return withSecurityHeaders(NextResponse.json({ branding: toOrganizerBranding(row) }));
  } catch (error) {
    console.error("Unable to save RaceBook branding", error);
    return jsonError("Unable to save RaceBook branding.", 502);
  }
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const parsed = uuidParamSchema.safeParse(context.params);
  if (!parsed.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, parsed.data.id);
  if ("error" in auth) return auth.error;
  const formData = (await request.formData().catch(() => null)) as FormData | null;
  const image = formData?.get("image");
  if (!(image instanceof File)) return jsonError("RaceBook logo is required.", 400);
  if (image.size === 0 || image.size > MAX_RACEBOOK_BRANDING_LOGO_SIZE_BYTES) {
    return jsonError(image.size === 0 ? "Logo is empty." : "Logo is too large (max 5 MB).", 400);
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  const detectedType = detectRacebookBrandingLogoType(bytes);
  const extension = detectedType ? RACEBOOK_BRANDING_LOGO_TYPES.get(detectedType) : null;
  if (!extension || detectedType !== image.type) return jsonError("Use a valid PNG, JPEG, WebP or AVIF logo.", 400);

  let previous: RacebookBrandingRow | null;
  try {
    previous = await loadBranding(auth.serviceConfig, auth.edition.id);
  } catch (error) {
    console.error("Unable to load current RaceBook logo", error);
    return jsonError("Unable to load current RaceBook logo.", 502);
  }

  const storagePath = `organizer-branding/${auth.edition.id}/${randomUUID()}-${Date.now()}.${extension}`;
  const uploadResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig, detectedType), "x-upsert": "false" },
    body: image,
    cache: "no-store",
  });
  if (!uploadResponse.ok) return jsonError("Unable to upload RaceBook logo.", 502);
  const logoUrl = `${auth.serviceConfig.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;

  try {
    const row = await upsertDraft(auth.serviceConfig, auth.edition.id, { draft_logo_url: logoUrl });
    if (previous?.draft_logo_url && previous.draft_logo_url !== previous.published_logo_url) {
      await deleteLogoObject(auth.serviceConfig, previous.draft_logo_url);
    }
    return withSecurityHeaders(NextResponse.json({ branding: toOrganizerBranding(row) }));
  } catch (error) {
    console.error("Unable to save RaceBook logo", error);
    await deleteLogoObject(auth.serviceConfig, logoUrl);
    return jsonError("Unable to save RaceBook logo.", 502);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const parsed = uuidParamSchema.safeParse(context.params);
  if (!parsed.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, parsed.data.id);
  if ("error" in auth) return auth.error;
  try {
    const previous = await loadBranding(auth.serviceConfig, auth.edition.id);
    const row = await upsertDraft(auth.serviceConfig, auth.edition.id, { draft_logo_url: null });
    if (previous?.draft_logo_url && previous.draft_logo_url !== previous.published_logo_url) {
      await deleteLogoObject(auth.serviceConfig, previous.draft_logo_url);
    }
    return withSecurityHeaders(NextResponse.json({ branding: toOrganizerBranding(row) }));
  } catch (error) {
    console.error("Unable to remove RaceBook logo", error);
    return jsonError("Unable to remove RaceBook logo.", 502);
  }
}

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const parsed = uuidParamSchema.safeParse(context.params);
  if (!parsed.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, parsed.data.id);
  if ("error" in auth) return auth.error;
  const action = z.object({ action: z.literal("publish") }).safeParse(await request.json().catch(() => null));
  if (!action.success) return jsonError("Invalid RaceBook branding action.", 400);

  try {
    let previous = await loadBranding(auth.serviceConfig, auth.edition.id);
    if (!previous) previous = await upsertDraft(auth.serviceConfig, auth.edition.id, {});
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/publish_racebook_edition_branding`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({ p_edition_id: auth.edition.id }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const row = racebookBrandingRowSchema.parse(Array.isArray(payload) ? payload[0] : payload);
    if (previous?.published_logo_url && previous.published_logo_url !== row.published_logo_url && previous.published_logo_url !== row.draft_logo_url) {
      await deleteLogoObject(auth.serviceConfig, previous.published_logo_url);
    }
    return withSecurityHeaders(NextResponse.json({ branding: toOrganizerBranding(row) }));
  } catch (error) {
    console.error("Unable to publish RaceBook branding", error);
    return jsonError("Unable to publish RaceBook branding.", 502);
  }
}
