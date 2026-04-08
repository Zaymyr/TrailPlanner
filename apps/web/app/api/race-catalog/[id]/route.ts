import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => !value || /^https?:\/\//i.test(value), { message: "Invalid URL." });

const updateRaceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  event_id: z.string().uuid().nullable().optional(),
  location_text: optionalText,
  elevation_gain_m: z.number().nonnegative().optional(),
  elevation_loss_m: z.number().nonnegative().nullable().optional(),
  trace_id: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? Number(value) : null))
    .refine((value) => value === null || Number.isFinite(value), { message: "Invalid trace id." }),
  external_site_url: optionalUrl,
  thumbnail_url: optionalUrl,
  trace_provider: optionalText,
  is_live: z.boolean().optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  slug: z.string(),
});

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();

  if (!supabaseAnon) {
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

  const rateLimit = checkRateLimit(`race-catalog-patch:${supabaseUser.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request body." }, { status: 400 }));
  }

  const parsed = updateRaceSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid fields." }, { status: 400 }));
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.event_id !== undefined) updatePayload.event_id = parsed.data.event_id;
  if (parsed.data.location_text !== undefined) updatePayload.location_text = parsed.data.location_text;
  if (parsed.data.elevation_gain_m !== undefined) updatePayload.elevation_gain_m = parsed.data.elevation_gain_m;
  if (parsed.data.elevation_loss_m !== undefined) updatePayload.elevation_loss_m = parsed.data.elevation_loss_m;
  if (parsed.data.trace_id !== undefined) updatePayload.trace_id = parsed.data.trace_id;
  if (parsed.data.external_site_url !== undefined) updatePayload.external_site_url = parsed.data.external_site_url;
  if (parsed.data.thumbnail_url !== undefined) updatePayload.thumbnail_url = parsed.data.thumbnail_url;
  if (parsed.data.trace_provider !== undefined) updatePayload.trace_provider = parsed.data.trace_provider;
  if (parsed.data.is_live !== undefined) updatePayload.is_live = parsed.data.is_live;

  if (Object.keys(updatePayload).length === 0) {
    return withSecurityHeaders(NextResponse.json({ message: "No fields to update." }, { status: 400 }));
  }

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
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update race", await updateResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update race." }, { status: 502 }));
  }

  const updated = z.array(raceRowSchema).parse(await updateResponse.json())?.[0];

  if (!updated) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  return withSecurityHeaders(NextResponse.json({ race: updated }));
}

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
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

  const rateLimit = checkRateLimit(`race-catalog-delete:${supabaseUser.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  // Fetch the race to get the GPX path before deleting
  const fetchResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}&select=id,gpx_storage_path&limit=1`,
    {
      headers: {
        apikey: supabaseAnon.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!fetchResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch race." }, { status: 502 }));
  }

  const rows = z
    .array(z.object({ id: z.string().uuid(), gpx_storage_path: z.string().nullable().optional() }))
    .parse(await fetchResponse.json());
  const race = rows[0];

  if (!race) {
    return withSecurityHeaders(NextResponse.json({ message: "Race not found." }, { status: 404 }));
  }

  const detachPlansResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/race_plans?race_id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ race_id: null }),
      cache: "no-store",
    }
  );

  if (!detachPlansResponse.ok) {
    console.error("Unable to detach race plans before deleting race", await detachPlansResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to detach race plans." }, { status: 502 }));
  }

  const deleteResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete race", await deleteResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete race." }, { status: 502 }));
  }

  // Best-effort GPX cleanup
  if (race.gpx_storage_path) {
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    }).catch((err) => console.error("Unable to delete GPX file", err));
  }

  return withSecurityHeaders(NextResponse.json({ success: true }));
}
