import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const rateLimit = checkRateLimit(`race-thumbnail-update:${supabaseUser.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid form data." }, { status: 400 }));
  }

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) {
    return withSecurityHeaders(NextResponse.json({ message: "Image file is required." }, { status: 400 }));
  }

  const mimeType = imageFile.type;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Invalid image type. Use JPEG, PNG, WebP or AVIF." }, { status: 400 })
    );
  }

  if (imageFile.size > MAX_SIZE_BYTES) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Image is too large (max 5 MB)." }, { status: 400 })
    );
  }

  const ext = mimeType.split("/")[1] ?? "jpg";
  const storagePath = `catalog/${parsedParams.data.id}/thumbnail-${Date.now()}.${ext}`;

  const uploadResponse = await fetch(
    `${supabaseService.supabaseUrl}/storage/v1/object/race-images/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: imageFile,
    }
  );

  if (!uploadResponse.ok) {
    console.error("Unable to upload thumbnail", await uploadResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to upload image." }, { status: 502 }));
  }

  const publicUrl = `${supabaseService.supabaseUrl}/storage/v1/object/public/race-images/${storagePath}`;

  const updateResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnon.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ thumbnail_url: publicUrl }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update thumbnail_url", await updateResponse.text());
    // Best-effort cleanup
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-images/${storagePath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    }).catch(() => null);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update race thumbnail." }, { status: 502 }));
  }

  return withSecurityHeaders(NextResponse.json({ thumbnail_url: publicUrl }));
}
