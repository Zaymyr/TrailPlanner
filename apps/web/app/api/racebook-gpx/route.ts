import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../lib/gpx/parseGpx";
import { withSecurityHeaders } from "../../../lib/http";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { setPrivateRacebookCacheHeaders, setPublicRacebookCacheHeaders } from "../../../lib/racebook-cache";
import { loadCurrentRacebookPublication } from "../../../lib/racebook-publications";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../lib/supabase";

const accessSchema = z.object({
  id: z.string().uuid(), event_id: z.string().uuid(), edition_id: z.string().uuid(),
  is_live: z.boolean(), racebook_is_live: z.boolean(), racebook_preview_is_visible: z.boolean().default(true),
  race_events: z.union([z.object({ is_live: z.boolean() }), z.array(z.object({ is_live: z.boolean() }))]),
});

function samplePoints<T>(points: T[], maxCount: number) {
  if (points.length <= maxCount) return points;
  const step = Math.ceil(points.length / maxCount);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

const responseError = (message: string, status: number) => withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return responseError("Invalid race id.", 400);
  const config = getSupabaseServiceConfig();
  if (!config) return responseError("Supabase configuration is missing.", 500);
  const accessResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,race_events(is_live)&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!accessResponse.ok) return responseError("Unable to load Race Book.", 502);
  const race = z.array(accessSchema).parse(await accessResponse.json())[0] ?? null;
  if (!race || race.racebook_preview_is_visible === false) return responseError("Race Book not available.", 404);
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  const isPublic = race.is_live && race.racebook_is_live && event?.is_live === true;
  if (!isPublic) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const anon = getSupabaseAnonConfig();
    const user = token && anon ? await fetchSupabaseUser(token, anon) : null;
    if (!user?.id || !(await isOrganizerForEvent(config, user.id, race.event_id))) return responseError("Race Book not available.", 404);
  }

  try {
    const { publication } = await loadCurrentRacebookPublication(config, race.id);
    if (!publication) return responseError("Published GPX not available.", 404);
    const path = publication.content.assets.gpxStoragePath;
    if (!path) return responseError("Published GPX not available.", 404);
    const gpxResponse = await fetch(`${config.supabaseUrl}/storage/v1/object/race-gpx/${encodeURI(path)}`, {
      headers: serviceHeaders(config, ""),
      cache: "force-cache",
    });
    if (!gpxResponse.ok) return responseError("Unable to load published GPX.", 502);
    const parsed = parseGpx(await gpxResponse.text());
    const routePreviewPoints = samplePoints(parsed.points.map((point) => ({
      lat: point.lat, lng: point.lng, elevationM: point.ele, distanceKm: point.distKmCum,
    })), 800);
    const elevationProfile = samplePoints(parsed.points.flatMap((point) => point.ele === null
      ? []
      : [{ distanceKm: point.distKmCum, elevationM: point.ele }]), 400);
    const response = withSecurityHeaders(NextResponse.json({
      elevationProfile,
      routePreviewPoints,
      publicationId: publication.id,
      publicationRevision: publication.source_draft_revision,
      publishedAt: publication.published_at,
    }));
    return isPublic
      ? setPublicRacebookCacheHeaders(response, { raceId: race.id, editionId: race.edition_id, eventId: race.event_id })
      : setPrivateRacebookCacheHeaders(response);
  } catch (cause) {
    console.error("Unable to load published RaceBook GPX", cause);
    return responseError("Unable to load published GPX.", 502);
  }
}
