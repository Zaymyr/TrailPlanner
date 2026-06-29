import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../../lib/http";
import { sendOrganizerRaceUpdateNotifications } from "../../../../../../lib/push";

const createUpdateSchema = z.object({
  message: z.string().trim().min(1).max(280),
});

const eventRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const updateRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
});

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const [favoritesResponse, updatesResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/user_favorite_race_events?event_id=eq.${parsedParams.data.id}&select=user_id`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_updates?event_id=eq.${parsedParams.data.id}&select=id,event_id,message,created_at,created_by&order=created_at.desc&limit=20`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
  ]);

  if (!favoritesResponse.ok || !updatesResponse.ok) {
    console.error("Unable to load organizer event updates", {
      favorites: favoritesResponse.ok ? null : await favoritesResponse.text(),
      updates: updatesResponse.ok ? null : await updatesResponse.text(),
    });
    return jsonError("Unable to load event updates.", 502);
  }

  const favorites = (await favoritesResponse.json().catch(() => [])) as Array<{ user_id?: string }>;
  const updates = z.array(updateRowSchema).parse(await updatesResponse.json());

  return withSecurityHeaders(
    NextResponse.json({
      favoriteCount: new Set(favorites.map((row) => row.user_id).filter((value): value is string => typeof value === "string")).size,
      updates,
    })
  );
}

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const rateLimit = await checkRateLimitAsync(`organizer-event-update:${auth.user.id}:${parsedParams.data.id}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const parsedBody = createUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid update payload.", 400);

  const eventResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}&select=id,name&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!eventResponse.ok) {
    console.error("Unable to load organizer event before update notification", await eventResponse.text());
    return jsonError("Unable to load event.", 502);
  }

  const event = z.array(eventRowSchema).parse(await eventResponse.json())[0] ?? null;
  if (!event) return jsonError("Event not found.", 404);

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_updates`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      event_id: parsedParams.data.id,
      created_by: auth.user.id,
      message: parsedBody.data.message,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create organizer race update", await insertResponse.text());
    return jsonError("Unable to create event update.", 502);
  }

  const update = z.array(updateRowSchema).parse(await insertResponse.json())[0] ?? null;
  if (!update) return jsonError("Unable to create event update.", 502);

  try {
    const delivery = await sendOrganizerRaceUpdateNotifications({
      eventId: parsedParams.data.id,
      eventName: event.name,
      updateId: update.id,
      message: update.message,
    });

    return withSecurityHeaders(NextResponse.json({ update, delivery }, { status: 201 }));
  } catch (error) {
    console.error("Unable to send organizer race update notifications", error);
    return withSecurityHeaders(
      NextResponse.json(
        {
          update,
          message: "Update saved, but push notifications could not be sent.",
        },
        { status: 502 }
      )
    );
  }
}
