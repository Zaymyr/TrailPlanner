import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { hasOrganizerRacebookContent, racebookSponsorRowSchema } from "../../../lib/racebook-sponsors";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../lib/supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  participation_mode: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  race_events: z.union([
    z.object({ is_live: z.boolean(), organizer_details: z.unknown().nullable().optional() }),
    z.array(z.object({ is_live: z.boolean(), organizer_details: z.unknown().nullable().optional() })),
    z.null(),
  ]),
});

const publicSponsor = (request: NextRequest, raceId: string, sponsor: z.infer<typeof racebookSponsorRowSchema>) => ({
  id: sponsor.id,
  name: sponsor.name,
  logoUrl: sponsor.logo_url,
  clickUrl: sponsor.website_url
    ? new URL(`/api/racebook-sponsors/${sponsor.id}/click?raceId=${encodeURIComponent(raceId)}`, request.nextUrl.origin).toString()
    : null,
});

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));

  const raceResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,participation_mode,organizer_details,race_events(is_live,organizer_details)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!raceResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to load RaceBook." }, { status: 502 }));
  const race = z.array(raceSchema).parse(await raceResponse.json())[0] ?? null;
  if (!race?.edition_id || !race.event_id) return withSecurityHeaders(NextResponse.json({ loadingSponsors: [], bannerSponsors: [] }));
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  if (!hasOrganizerRacebookContent(event?.organizer_details, race.organizer_details, race.participation_mode)) {
    return withSecurityHeaders(NextResponse.json({ message: "RaceBook not available." }, { status: 404 }));
  }
  let canOpen = race.is_live && race.racebook_is_live && event?.is_live === true;

  if (!canOpen) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const anonConfig = getSupabaseAnonConfig();
    const user = token && anonConfig ? await fetchSupabaseUser(token, anonConfig) : null;
    canOpen = Boolean(user?.id && (await isOrganizerForEvent(serviceConfig, user.id, race.event_id)));
  }
  if (!canOpen) return withSecurityHeaders(NextResponse.json({ message: "RaceBook not available." }, { status: 404 }));

  const sponsorResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?edition_id=eq.${race.edition_id}&is_active=eq.true&select=*&order=position.asc,created_at.asc`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!sponsorResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to load sponsors." }, { status: 502 }));
  const sponsors = z.array(racebookSponsorRowSchema).parse(await sponsorResponse.json());
  return withSecurityHeaders(NextResponse.json({
    loadingSponsors: sponsors.filter((sponsor) => sponsor.show_on_loading).slice(0, 2).map((sponsor) => publicSponsor(request, race.id, sponsor)),
    bannerSponsors: sponsors.filter((sponsor) => sponsor.show_in_banner).map((sponsor) => publicSponsor(request, race.id, sponsor)),
  }));
}
