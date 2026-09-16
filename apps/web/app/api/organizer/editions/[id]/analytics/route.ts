import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  loadOrganizerEditionCapabilityGrant,
  loadOrganizerEditionEntitlement,
  resolveOrganizerCapabilityAccess,
} from "../../../../../../lib/organizer-entitlements";
import {
  buildOrganizerAnalyticsWindow,
  loadPostHogOrganizerAnalytics,
  ORGANIZER_ANALYTICS_CACHE_TTL_SECONDS,
  organizerAnalyticsRangeSchema,
} from "../../../../../../lib/posthog-organizer-analytics";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";

const querySchema = z.object({
  range: organizerAnalyticsRangeSchema.default("30d"),
  raceId: z.string().uuid().optional(),
});

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
});

const raceSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);

  const parsedQuery = querySchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? undefined,
    raceId: request.nextUrl.searchParams.get("raceId") ?? undefined,
  });
  if (!parsedQuery.success) return jsonError("Invalid analytics filters.", 400);

  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${encodeURIComponent(
      parsedParams.data.id,
    )}&select=id,event_id,start_date,end_date&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!editionResponse.ok) {
    console.error("Unable to load organizer analytics edition", await editionResponse.text());
    return jsonError("Unable to load edition.", 502);
  }

  const editionResult = z.array(editionSchema).safeParse(await editionResponse.json().catch(() => null));
  if (!editionResult.success) return jsonError("Unable to load edition.", 502);
  const edition = editionResult.data[0] ?? null;
  if (!edition) return jsonError("Edition not found.", 404);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (organizer !== true) return organizer.error;

  try {
    const [racesResponse, entitlement, grant] = await Promise.all([
      fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${encodeURIComponent(
          edition.id,
        )}&select=id&order=id.asc`,
        { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
      ),
      loadOrganizerEditionEntitlement(auth.serviceConfig, edition.id),
      loadOrganizerEditionCapabilityGrant(auth.serviceConfig, edition.id, "racebook_analytics.view"),
    ]);

    if (!racesResponse.ok) {
      console.error("Unable to load organizer analytics formats", await racesResponse.text());
      return jsonError("Unable to load edition formats.", 502);
    }

    const racesResult = z.array(raceSchema).safeParse(await racesResponse.json().catch(() => null));
    if (!racesResult.success) return jsonError("Unable to load edition formats.", 502);
    const raceIds = racesResult.data.map((race) => race.id);

    const access = resolveOrganizerCapabilityAccess(
      entitlement,
      grant ? [grant] : [],
      "racebook_analytics.view",
    );
    if (!access.allowed || !access.source) return jsonError("Analytics access required.", 403);

    if (parsedQuery.data.raceId && !raceIds.includes(parsedQuery.data.raceId)) {
      return jsonError("Format not found for this edition.", 404);
    }

    const timing = buildOrganizerAnalyticsWindow(parsedQuery.data.range);
    const analytics = await loadPostHogOrganizerAnalytics({
      eventId: edition.event_id,
      editionId: edition.id,
      editionStartDate: edition.start_date,
      editionEndDate: edition.end_date,
      raceIds,
      selectedRaceId: parsedQuery.data.raceId ?? null,
      dateFrom: timing.from,
      dateTo: timing.to,
    });

    return withSecurityHeaders(NextResponse.json({
      access: { allowed: true, source: access.source },
      range: parsedQuery.data.range,
      raceId: parsedQuery.data.raceId ?? null,
      timing: {
        ...timing,
        generatedAt: new Date().toISOString(),
        cacheTtlSeconds: ORGANIZER_ANALYTICS_CACHE_TTL_SECONDS,
      },
      ...analytics,
    }));
  } catch (error) {
    console.error("Unable to load organizer analytics", error);
    return jsonError("Statistics are temporarily unavailable.", 502);
  }
}
