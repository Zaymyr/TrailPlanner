import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "./http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
  type SupabaseServiceConfig,
  type SupabaseUser,
} from "./supabase";

export const uuidParamSchema = z.object({ id: z.string().uuid() });

export const optionalTextOrNull = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const optionalUrlOrNull = optionalTextOrNull.refine((value) => !value || /^https?:\/\//i.test(value), {
  message: "Invalid URL.",
});

export type OrganizerAuth = {
  token: string;
  user: SupabaseUser;
  serviceConfig: SupabaseServiceConfig;
};

export const serviceHeaders = (serviceConfig: SupabaseServiceConfig, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

export const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function requireOrganizerAuth(request: NextRequest): Promise<OrganizerAuth | { error: NextResponse }> {
  const anonConfig = getSupabaseAnonConfig();
  const serviceConfig = getSupabaseServiceConfig();

  if (!anonConfig || !serviceConfig) {
    return { error: jsonError("Supabase configuration is missing.", 500) };
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return { error: jsonError("Missing access token.", 401) };
  }

  const user = await fetchSupabaseUser(token, anonConfig);
  if (!user?.id) {
    return { error: jsonError("Invalid session.", 401) };
  }

  return { token, user, serviceConfig };
}

export async function requireAdminAuth(request: NextRequest): Promise<OrganizerAuth | { error: NextResponse }> {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;

  if (!isAdminUser(auth.user)) {
    return { error: jsonError("Admin access required.", 403) };
  }

  return auth;
}

const membershipRowSchema = z.object({ id: z.string().uuid() });

const raceAccessRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  name: z.string().optional(),
});

export async function isOrganizerForEvent(
  serviceConfig: SupabaseServiceConfig,
  userId: string,
  eventId: string
) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?event_id=eq.${eventId}&user_id=eq.${userId}&revoked_at=is.null&select=id&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer membership", await response.text());
    return false;
  }

  const rows = z.array(membershipRowSchema).safeParse(await response.json().catch(() => null));
  return rows.success && rows.data.length > 0;
}

export async function requireEventOrganizer(
  serviceConfig: SupabaseServiceConfig,
  user: SupabaseUser,
  eventId: string
): Promise<true | { error: NextResponse }> {
  if (isAdminUser(user)) return true;

  const allowed = await isOrganizerForEvent(serviceConfig, user.id, eventId);
  if (!allowed) {
    return { error: jsonError("Not authorized for this event.", 403) };
  }

  return true;
}

export async function loadRaceForOrganizer(
  serviceConfig: SupabaseServiceConfig,
  user: SupabaseUser,
  raceId: string
): Promise<z.infer<typeof raceAccessRowSchema> | { error: NextResponse }> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,name&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load race before organizer mutation", await response.text());
    return { error: jsonError("Unable to load race.", 502) };
  }

  const race = z.array(raceAccessRowSchema).parse(await response.json())[0] ?? null;
  if (!race) {
    return { error: jsonError("Race not found.", 404) };
  }

  if (!race.event_id) {
    return { error: jsonError("This race is not attached to an event.", 409) };
  }

  const organizer = await requireEventOrganizer(serviceConfig, user, race.event_id);
  if (organizer !== true) return organizer;

  return race;
}

export const buildSlug = (name: string, prefix = "race") => {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const suffix = randomUUID().slice(0, 8);
  return base ? `${base}-${suffix}` : `${prefix}-${suffix}`;
};
