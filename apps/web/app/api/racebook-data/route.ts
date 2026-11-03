import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../lib/organizer-entitlements";
import { isOrganizerModuleAvailable, ORGANIZER_MODULES } from "../../../lib/organizer-modules";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { setPrivateRacebookCacheHeaders, setPublicRacebookCacheHeaders } from "../../../lib/racebook-cache";
import { loadCurrentRacebookPublication, moduleMask, publicSnapshot } from "../../../lib/racebook-publications";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../lib/supabase";

const raceAccessSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
  race_events: z.union([z.object({ is_live: z.boolean() }), z.array(z.object({ is_live: z.boolean() }))]),
});

const jsonError = (message: string, status: number) => withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return jsonError("Invalid race id.", 400);
  const config = getSupabaseServiceConfig();
  if (!config) return jsonError("Supabase configuration is missing.", 500);

  const raceResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,race_events(is_live)&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!raceResponse.ok) return jsonError("Unable to load Race Book.", 502);
  const race = z.array(raceAccessSchema).parse(await raceResponse.json())[0] ?? null;
  if (!race || race.racebook_preview_is_visible === false) return jsonError("Race Book not available.", 404);
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  const isPublic = race.is_live && race.racebook_is_live && event?.is_live === true;
  if (!isPublic) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const anon = getSupabaseAnonConfig();
    const user = token && anon ? await fetchSupabaseUser(token, anon) : null;
    if (!user?.id || !(await isOrganizerForEvent(config, user.id, race.event_id))) return jsonError("Race Book not available.", 404);
  }

  try {
    const [{ publication }, entitlement] = await Promise.all([
      loadCurrentRacebookPublication(config, race.id),
      loadOrganizerEditionEntitlement(config, race.edition_id),
    ]);
    if (!publication) return jsonError("Race Book not available. Publish it from the organizer area.", 404);
    const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
    const allowed = Object.fromEntries(ORGANIZER_MODULES.map((module) => [module.key, isOrganizerModuleAvailable(tier, module.key)])) as Record<(typeof ORGANIZER_MODULES)[number]["key"], boolean>;
    const modules = moduleMask(publication.content.modules, allowed);
    const snapshot = publicSnapshot(publication);
    const response = withSecurityHeaders(NextResponse.json({
      ...snapshot,
      stationRows: modules.aid_stations ? snapshot.stationRows : [],
      supporterPointRows: modules.supporter_points ? snapshot.supporterPointRows : [],
      relayPointRows: modules.relay ? snapshot.relayPointRows : [],
      startWaveRows: modules.start_waves ? snapshot.startWaveRows : [],
      awardRows: modules.awards ? snapshot.awardRows : [],
      editionServiceRows: modules.services ? snapshot.editionServiceRows : [],
      sponsors: modules.sponsors ? snapshot.sponsors : [],
      branding: modules.branding ? snapshot.branding : { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
      modules,
      organizerPreview: !isPublic,
    }));
    return isPublic
      ? setPublicRacebookCacheHeaders(response, { raceId: race.id, editionId: race.edition_id, eventId: race.event_id })
      : setPrivateRacebookCacheHeaders(response);
  } catch (error) {
    console.error("Unable to load published RaceBook snapshot", error);
    return jsonError("Unable to load Race Book content.", 502);
  }
}
