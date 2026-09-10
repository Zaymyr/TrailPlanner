import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { isOrganizerForEvent, serviceHeaders } from "../../../lib/organizer";
import { hasOrganizerRacebookContent, racebookSponsorRowSchema } from "../../../lib/racebook-sponsors";
import { racebookBrandingRowSchema, toPublishedBranding } from "../../../lib/racebook-branding";
import { loadOrganizerEditionEntitlement } from "../../../lib/organizer-entitlements";
import { effectiveOrganizerModules, loadOrganizerModuleSettings } from "../../../lib/organizer-module-settings";
import { ORGANIZER_MODULES, type OrganizerModuleKey } from "../../../lib/organizer-modules";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../lib/supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
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
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,event_id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,participation_mode,organizer_details,race_events(is_live,organizer_details)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!raceResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to load RaceBook." }, { status: 502 }));
  const race = z.array(raceSchema).parse(await raceResponse.json())[0] ?? null;
  if (race?.racebook_preview_is_visible === false) {
    return withSecurityHeaders(NextResponse.json({ message: "RaceBook not available." }, { status: 404 }));
  }
  if (!race?.edition_id || !race.event_id) return withSecurityHeaders(NextResponse.json({
    loadingSponsors: [],
    bannerSponsors: [],
    branding: toPublishedBranding(null),
    modules: null,
  }));
  let modules: Record<OrganizerModuleKey, boolean> | null = null;
  try {
    const [settings, entitlement] = await Promise.all([
      loadOrganizerModuleSettings(serviceConfig, race.edition_id, [race.id]),
      loadOrganizerEditionEntitlement(serviceConfig, race.edition_id),
    ]);
    const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
    modules = effectiveOrganizerModules(tier, settings, race.id);
  } catch (error) {
    // Compatibility fallback during a rolling deployment: an older database has no module table yet.
    console.warn("Unable to load optional RaceBook module settings", error);
    modules = Object.fromEntries(ORGANIZER_MODULES.map((module) => [module.key, true])) as Record<OrganizerModuleKey, boolean>;
  }
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events;
  if (!hasOrganizerRacebookContent(event?.organizer_details, race.organizer_details, race.participation_mode, modules)) {
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

  const [sponsorResponse, brandingResponse] = await Promise.all([
    modules.sponsors ? fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?edition_id=eq.${race.edition_id}&is_active=eq.true&select=*&order=position.asc,created_at.asc`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    ) : Promise.resolve(null),
    modules.branding ? fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_branding?edition_id=eq.${race.edition_id}&select=*&limit=1`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    ) : Promise.resolve(null),
  ]);
  if (sponsorResponse && !sponsorResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Unable to load sponsors." }, { status: 502 }));
  const sponsors = sponsorResponse ? z.array(racebookSponsorRowSchema).parse(await sponsorResponse.json()) : [];
  let branding = toPublishedBranding(null);
  if (brandingResponse?.ok) {
    const parsedBranding = z.array(racebookBrandingRowSchema).safeParse(await brandingResponse.json().catch(() => null));
    if (parsedBranding.success) {
      branding = toPublishedBranding(parsedBranding.data[0] ?? null);
    } else {
      console.warn("Unable to parse optional RaceBook branding");
    }
  } else if (brandingResponse) {
    console.warn("Unable to load optional RaceBook branding", brandingResponse.status);
  }
  return withSecurityHeaders(NextResponse.json({
    loadingSponsors: sponsors.filter((sponsor) => sponsor.show_on_loading).slice(0, 2).map((sponsor) => publicSponsor(request, race.id, sponsor)),
    bannerSponsors: sponsors.filter((sponsor) => sponsor.show_in_banner).map((sponsor) => publicSponsor(request, race.id, sponsor)),
    branding,
    modules,
  }));
}
