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

const updateRaceEventSchema = z.object({
  name: z.string().trim().min(1).optional(),
  location: optionalText,
  race_date: optionalText,
  thumbnail_url: optionalUrl,
  is_live: z.boolean().optional(),
});

const raceEventRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race event id." }, { status: 400 }));
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

  const rateLimit = checkRateLimit(`race-event-patch:${supabaseUser.id}`, 30, 60_000);
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

  const parsed = updateRaceEventSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid fields." }, { status: 400 }));
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.location !== undefined) updatePayload.location = parsed.data.location;
  if (parsed.data.race_date !== undefined) updatePayload.race_date = parsed.data.race_date;
  if (parsed.data.thumbnail_url !== undefined) updatePayload.thumbnail_url = parsed.data.thumbnail_url;
  if (parsed.data.is_live !== undefined) updatePayload.is_live = parsed.data.is_live;

  if (Object.keys(updatePayload).length === 0) {
    return withSecurityHeaders(NextResponse.json({ message: "No fields to update." }, { status: 400 }));
  }

  const updateResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update race event", await updateResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update race event." }, { status: 502 }));
  }

  const updated = z.array(raceEventRowSchema).parse(await updateResponse.json())?.[0];

  if (!updated) {
    return withSecurityHeaders(NextResponse.json({ message: "Race event not found." }, { status: 404 }));
  }

  return withSecurityHeaders(NextResponse.json({ event: updated }));
}
