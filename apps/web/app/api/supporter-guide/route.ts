import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../lib/organizer";
import { setPrivateRacebookCacheHeaders, setPublicRacebookCacheHeaders } from "../../../lib/racebook-cache";
import { loadSupporterGuide } from "../../../lib/supporter-guide";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

const raceSchema = z.object({
  id: z.string().uuid(), event_id: z.string().uuid(), edition_id: z.string().uuid(), is_live: z.boolean(),
  racebook_is_live: z.boolean(), racebook_preview_is_visible: z.boolean().default(true),
  race_events: z.union([z.object({ is_live: z.boolean() }), z.array(z.object({ is_live: z.boolean() }))]),
});

const error = (message: string, status: number) => withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return error("Invalid race id.", 400);
  const config = getSupabaseServiceConfig();
  if (!config) return error("Supabase configuration is missing.", 500);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,race_events(is_live)&limit=1`, { headers: serviceHeaders(config, ""), cache: "no-store" });
  if (!response.ok) return error("Unable to load Supporter Guide.", 502);
  const race = z.array(raceSchema).parse(await response.json())[0] ?? null;
  if (!race || !race.racebook_preview_is_visible) return error("Supporter Guide not available.", 404);
  const event = Array.isArray(race.race_events) ? race.race_events[0] : race.race_events;
  const isPublic = race.is_live && race.racebook_is_live && event?.is_live === true;
  let organizerPreview = false;
  if (!isPublic) {
    const auth = await requireOrganizerAuth(request);
    if ("error" in auth) return error("Supporter Guide not available.", 404);
    const membership = await requireEventOrganizer(config, auth.user, race.event_id);
    organizerPreview = membership === true;
    if (!organizerPreview) return error("Supporter Guide not available.", 404);
  }
  try {
    const guide = await loadSupporterGuide(config, race.edition_id, organizerPreview, request.nextUrl.origin);
    if (!guide) return error("Supporter Guide not available. Publish at least one format first.", 404);
    const result = withSecurityHeaders(NextResponse.json(guide));
    return organizerPreview
      ? setPrivateRacebookCacheHeaders(result)
      : setPublicRacebookCacheHeaders(result, { raceId: race.id, editionId: race.edition_id, eventId: race.event_id });
  } catch (cause) {
    console.error("Unable to load Supporter Guide", cause);
    return error("Unable to load Supporter Guide content.", 502);
  }
}
