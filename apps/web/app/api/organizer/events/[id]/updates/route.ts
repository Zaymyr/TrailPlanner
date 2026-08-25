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
  raceId: z.string().uuid().nullable().optional(),
});

const deleteUpdateSchema = z.object({
  updateId: z.string().uuid(),
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
  race_id: z.string().uuid().nullable(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  name: z.string(),
  is_live: z.boolean(),
});

const parseExactCount = (response: Response) => {
  const contentRange = response.headers.get("content-range");
  const total = contentRange?.match(/\/(\d+)$/)?.[1];
  return total === undefined ? null : Number(total);
};

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const [favoritesResponse, updatesResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/user_favorite_race_events?event_id=eq.${parsedParams.data.id}&select=user_id&limit=1`,
      {
        headers: {
          ...serviceHeaders(auth.serviceConfig, ""),
          Prefer: "count=exact",
          Range: "0-0",
        },
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_updates?event_id=eq.${parsedParams.data.id}&select=id,event_id,race_id,message,created_at,created_by&order=created_at.desc&limit=20`,
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

  const favoriteCount = parseExactCount(favoritesResponse);
  if (favoriteCount === null) {
    console.error("Unable to load organizer event favorite count", {
      contentRange: favoritesResponse.headers.get("content-range"),
    });
    return jsonError("Unable to load event updates.", 502);
  }

  const updates = z.array(updateRowSchema).parse(await updatesResponse.json());

  return withSecurityHeaders(
    NextResponse.json({
      favoriteCount,
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

  const requestedRaceId = parsedBody.data.raceId ?? null;
  let race: z.infer<typeof raceRowSchema> | null = null;
  if (requestedRaceId) {
    const raceResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${requestedRaceId}&event_id=eq.${parsedParams.data.id}&is_live=eq.true&select=id,event_id,name,is_live&limit=1`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!raceResponse.ok) {
      console.error("Unable to load organizer race format before update notification", await raceResponse.text());
      return jsonError("Unable to load race format.", 502);
    }

    race = z.array(raceRowSchema).parse(await raceResponse.json())[0] ?? null;
    if (!race) return jsonError("Live race format not found for this event.", 400);
  }

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_updates`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      event_id: parsedParams.data.id,
      race_id: race?.id ?? null,
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
      raceId: race?.id ?? null,
      raceName: race?.name ?? null,
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

export async function DELETE(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const parsedQuery = deleteUpdateSchema.safeParse({
    updateId: request.nextUrl.searchParams.get("updateId"),
  });
  if (!parsedQuery.success) return jsonError("Invalid update id.", 400);

  const rateLimit = await checkRateLimitAsync(
    `organizer-event-update-delete:${auth.user.id}:${parsedParams.data.id}`,
    10,
    60_000
  );
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_updates?id=eq.${parsedQuery.data.updateId}&event_id=eq.${parsedParams.data.id}`,
    {
      method: "DELETE",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete organizer race update", await deleteResponse.text());
    return jsonError("Unable to delete event update.", 502);
  }

  const deletedUpdate = z.array(updateRowSchema).parse(await deleteResponse.json())[0] ?? null;
  if (!deletedUpdate) return jsonError("Event update not found.", 404);

  return withSecurityHeaders(NextResponse.json({ deletedUpdateId: deletedUpdate.id }));
}
