import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { loadOrganizerEditionCapabilityGrants, loadOrganizerEditionEntitlement } from "../../../lib/organizer-entitlements";
import { isOrganizerModuleAvailable } from "../../../lib/organizer-modules";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { setPrivateRacebookCacheHeaders, setPublicRacebookCacheHeaders } from "../../../lib/racebook-cache";
import { loadCurrentRacebookPublication, loadRacebookPublication } from "../../../lib/racebook-publications";
import { toRunnerPartnerSlots } from "../../../lib/racebook-partner-slots";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../lib/supabase";

const accessSchema = z.object({
  id: z.string().uuid(), event_id: z.string().uuid(), edition_id: z.string().uuid(),
  is_live: z.boolean(), racebook_is_live: z.boolean(), racebook_preview_is_visible: z.boolean().default(true),
  race_events: z.union([z.object({ is_live: z.boolean() }), z.array(z.object({ is_live: z.boolean() }))]),
});
const error = (message: string, status: number) => withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) return error("Invalid race id.", 400);
  const requestedPublicationId = request.nextUrl.searchParams.get("publicationId");
  if (requestedPublicationId && !z.string().uuid().safeParse(requestedPublicationId).success) return error("Invalid publication id.", 400);
  const config = getSupabaseServiceConfig();
  if (!config) return error("Supabase configuration is missing.", 500);
  const accessResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,race_events(is_live)&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!accessResponse.ok) return error("Unable to load Race Book.", 502);
  const race = z.array(accessSchema).parse(await accessResponse.json())[0] ?? null;
  if (!race || race.racebook_preview_is_visible === false) return error("Race Book not available.", 404);
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  const isPublic = race.is_live && race.racebook_is_live && event?.is_live === true;
  if (!isPublic) {
    const token = extractBearerToken(request.headers.get("authorization"));
    const anon = getSupabaseAnonConfig();
    const user = token && anon ? await fetchSupabaseUser(token, anon) : null;
    if (!user?.id || !(await isOrganizerForEvent(config, user.id, race.event_id))) return error("Race Book not available.", 404);
  }

  try {
    const [publicationResult, entitlement, grantMap] = await Promise.all([
      requestedPublicationId
        ? loadRacebookPublication(config, race.id, requestedPublicationId).then((publication) => ({ publication }))
        : loadCurrentRacebookPublication(config, race.id),
      loadOrganizerEditionEntitlement(config, race.edition_id),
      loadOrganizerEditionCapabilityGrants(config, [race.edition_id]),
    ]);
    const { publication } = publicationResult;
    if (!publication) return error("Race Book not available.", 404);
    const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
    const grantedFeatures = (grantMap[race.edition_id] ?? []).filter((grant) => grant.status === "active").map((grant) => grant.capabilityKey);
    const modules = Object.fromEntries(Object.entries(publication.content.modules).map(([key, value]) => [
      key,
      value && isOrganizerModuleAvailable(tier, key as keyof typeof publication.content.modules, grantedFeatures),
    ]));
    const sponsorModule = modules.sponsors === true;
    const sponsors = sponsorModule ? publication.content.sponsors : [];
    const mapSponsor = (sponsor: (typeof sponsors)[number]) => ({
      id: sponsor.id,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      tier: sponsor.tier,
      category: sponsor.category,
      contextualPlacement: sponsor.contextualPlacement,
      clickUrl: sponsor.destinationUrl
        ? new URL(`/api/racebook-sponsors/${sponsor.id}/click?raceId=${encodeURIComponent(race.id)}`, request.nextUrl.origin).toString()
        : null,
    });
    const payload = {
      loadingSponsors: sponsors.filter((sponsor) => sponsor.showOnLoading).slice(0, 2).map(mapSponsor),
      bannerSponsors: sponsors.filter((sponsor) => sponsor.showInBanner).map(mapSponsor),
      contextualSponsors: sponsors.filter((sponsor) => sponsor.contextualPlacement !== "none").map(mapSponsor),
      // Partner slots replace or hide the default affiliate cards; older
      // clients ignore this field and keep their affiliate presentation.
      partnerSlots: toRunnerPartnerSlots(
        publication.content.partnerSlots ?? [],
        sponsorModule,
        (slot) => new URL(`/api/racebook-partner-slots/${slot}/click?raceId=${encodeURIComponent(race.id)}`, request.nextUrl.origin).toString(),
      ),
      branding: modules.branding === true ? publication.content.branding : { logoUrl: null, primaryColor: "#2D5016", accentColor: "#3F6F8F" },
      modules,
      publicationId: publication.id,
      publicationRevision: publication.source_draft_revision,
      publishedAt: publication.published_at,
    };
    const response = withSecurityHeaders(NextResponse.json(payload));
    return isPublic
      ? setPublicRacebookCacheHeaders(response, { raceId: race.id, editionId: race.edition_id, eventId: race.event_id })
      : setPrivateRacebookCacheHeaders(response);
  } catch (cause) {
    console.error("Unable to load published RaceBook sponsors", cause);
    return error("Unable to load sponsors.", 502);
  }
}
