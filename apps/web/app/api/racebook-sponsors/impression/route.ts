import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { serviceHeaders } from "../../../../lib/organizer";
import { isOrganizerEditionModuleEnabled } from "../../../../lib/organizer-module-settings";
import {
  racebookSponsorContextualPlacementSchema,
  racebookSponsorTierSchema,
} from "../../../../lib/racebook-sponsors";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

const impressionSchema = z.object({
  raceId: z.string().uuid(),
  sponsorId: z.string().uuid(),
  placement: z.enum(["loading", "hero", "aid_stations", "equipment", "access", "services"]),
  viewId: z.string().uuid(),
  tier: racebookSponsorTierSchema.optional(),
});

const sponsorSchema = z.object({
  edition_id: z.string().uuid(),
  show_on_loading: z.boolean(),
  show_in_banner: z.boolean(),
  contextual_placement: racebookSponsorContextualPlacementSchema,
});

const noContent = () => {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store, private");
  return withSecurityHeaders(response);
};

export async function POST(request: NextRequest) {
  const input = impressionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid sponsor impression." }, { status: 400 }));
  }

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Sponsor analytics unavailable." }, { status: 500 }));
  }

  const sponsorResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${input.data.sponsorId}&is_active=eq.true&select=edition_id,show_on_loading,show_in_banner,contextual_placement&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!sponsorResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Sponsor analytics unavailable." }, { status: 502 }));
  }
  const sponsor = z.array(sponsorSchema).parse(await sponsorResponse.json())[0] ?? null;
  if (!sponsor) return noContent();

  const eligible = input.data.placement === "loading"
    ? sponsor.show_on_loading
    : input.data.placement === "hero"
      ? sponsor.show_in_banner
      : sponsor.contextual_placement === input.data.placement;
  if (!eligible || !(await isOrganizerEditionModuleEnabled(serviceConfig, sponsor.edition_id, "sponsors"))) {
    return noContent();
  }

  // The client emits a random view UUID and already deduplicates sponsor/placement
  // pairs. Keep the server-side guard ephemeral so sponsor analytics never persist
  // a runner/network identifier or an individual impression history.
  const viewLimit = checkRateLimit(
    `racebook-sponsor-impression-view:${input.data.viewId}:${input.data.raceId}:${input.data.sponsorId}:${input.data.placement}`,
    1,
    6 * 60 * 60 * 1_000,
  );
  const globalLimit = checkRateLimit("racebook-sponsor-impression-global", 600, 60_000);
  if (!viewLimit.allowed || !globalLimit.allowed) return noContent();

  const countResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/rpc/increment_racebook_sponsor_impression`,
    {
      method: "POST",
      headers: serviceHeaders(serviceConfig),
      body: JSON.stringify({
        p_sponsor_id: input.data.sponsorId,
        p_race_id: input.data.raceId,
        p_placement: input.data.placement,
      }),
      cache: "no-store",
    },
  ).catch((error) => {
    console.error("Unable to count sponsor impression", error);
    return null;
  });

  // Analytics must never block RaceBook rendering. Invalid race/sponsor pairs and
  // temporary database failures are intentionally acknowledged without a retry loop.
  if (countResponse && !countResponse.ok) {
    console.warn("Sponsor impression was not accepted", countResponse.status);
  }
  return noContent();
}
