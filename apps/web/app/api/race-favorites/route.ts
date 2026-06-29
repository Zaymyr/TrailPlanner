import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  isAnonymousUser,
} from "../../../lib/supabase";

const favoriteRowSchema = z.array(
  z.object({
    event_id: z.string().uuid(),
  })
);

const favoriteUpdateSchema = z.object({
  eventIds: z.array(z.string().uuid()).max(200),
});

const buildHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

async function fetchFavoriteEventIds(supabaseUrl: string, supabaseKey: string, token: string) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_favorite_race_events?select=event_id&order=created_at.asc`,
    {
      headers: buildHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load race favorites.");
  }

  const rows = favoriteRowSchema.parse(await response.json());
  return rows.map((row) => row.event_id);
}

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }
  if (isAnonymousUser(user)) {
    return withSecurityHeaders(NextResponse.json({ message: "Anonymous users cannot favorite race events." }, { status: 403 }));
  }

  try {
    const eventIds = await fetchFavoriteEventIds(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, token);
    return withSecurityHeaders(NextResponse.json({ eventIds }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load race favorites.";
    return withSecurityHeaders(NextResponse.json({ message }, { status: 500 }));
  }
}

export async function PUT(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }
  if (isAnonymousUser(user)) {
    return withSecurityHeaders(NextResponse.json({ message: "Anonymous users cannot favorite race events." }, { status: 403 }));
  }

  const parsedBody = favoriteUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race favorites payload." }, { status: 400 }));
  }

  try {
    const existingEventIds = await fetchFavoriteEventIds(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, token);
    const existingIds = new Set(existingEventIds);
    const nextIds = new Set(parsedBody.data.eventIds);

    const toDelete = existingEventIds.filter((eventId) => !nextIds.has(eventId));
    const toInsert = parsedBody.data.eventIds.filter((eventId) => !existingIds.has(eventId));

    if (toDelete.length > 0) {
      const deleteFilter = toDelete.join(",");
      const deleteResponse = await fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/user_favorite_race_events?user_id=eq.${encodeURIComponent(user.id)}&event_id=in.(${deleteFilter})`,
        {
          method: "DELETE",
          headers: buildHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
        }
      );

      if (!deleteResponse.ok) {
        throw new Error("Unable to remove race favorites.");
      }
    }

    if (toInsert.length > 0) {
      const insertResponse = await fetch(`${supabaseConfig.supabaseUrl}/rest/v1/user_favorite_race_events`, {
        method: "POST",
        headers: {
          ...buildHeaders(supabaseConfig.supabaseAnonKey, token),
          Prefer: "resolution=ignore-duplicates",
        },
        body: JSON.stringify(toInsert.map((eventId) => ({ user_id: user.id, event_id: eventId }))),
      });

      if (!insertResponse.ok) {
        throw new Error("Unable to add race favorites.");
      }
    }

    return withSecurityHeaders(NextResponse.json({ eventIds: parsedBody.data.eventIds }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update race favorites.";
    return withSecurityHeaders(NextResponse.json({ message }, { status: 500 }));
  }
}
