import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../lib/http";
import { serviceHeaders } from "../../../../../lib/organizer";
import { loadOrganizerEditionCapabilityGrants, loadOrganizerEditionEntitlement } from "../../../../../lib/organizer-entitlements";
import { isOrganizerModuleAvailable } from "../../../../../lib/organizer-modules";
import { loadCurrentRacebookPublication } from "../../../../../lib/racebook-publications";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!parsedParams.success || !raceId || !z.string().uuid().safeParse(raceId).success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid sponsor link." }, { status: 400 }));
  }
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 500 }));

  const raceResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,edition_id&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  const matchingRace = raceResponse.ok
    ? z.array(z.object({ id: z.string().uuid(), edition_id: z.string().uuid() })).parse(await raceResponse.json())[0]
    : null;
  if (!matchingRace) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 410 }));
  const [{ publication }, entitlement, grantMap] = await Promise.all([
    loadCurrentRacebookPublication(serviceConfig, matchingRace.id),
    loadOrganizerEditionEntitlement(serviceConfig, matchingRace.edition_id),
    loadOrganizerEditionCapabilityGrants(serviceConfig, [matchingRace.edition_id]),
  ]);
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  const grantedFeatures = (grantMap[matchingRace.edition_id] ?? []).filter((grant) => grant.status === "active").map((grant) => grant.capabilityKey);
  const target = publication?.content.modules.sponsors && isOrganizerModuleAvailable(tier, "sponsors", grantedFeatures)
    ? publication.content.sponsors.find((sponsor) => sponsor.id === parsedParams.data.id && sponsor.destinationUrl)
    : null;
  if (!target?.destinationUrl) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 410 }));

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const networkHash = createHash("sha256").update(forwardedFor).digest("hex").slice(0, 24);
  let shouldCount = false;
  try {
    shouldCount = (await checkRateLimitAsync(`racebook-sponsor:${parsedParams.data.id}:${networkHash}`, 10, 60_000)).allowed;
  } catch (error) {
    console.error("Unable to rate limit sponsor click", error);
  }
  if (shouldCount) {
    await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/increment_racebook_sponsor_click`, {
      method: "POST",
      headers: serviceHeaders(serviceConfig),
      body: JSON.stringify({ p_sponsor_id: parsedParams.data.id, p_race_id: raceId }),
      cache: "no-store",
    }).catch((error) => console.error("Unable to count sponsor click", error));
  }

  const response = NextResponse.redirect(target.destinationUrl, { status: 302 });
  response.headers.set("Cache-Control", "no-store, private");
  return withSecurityHeaders(response);
}
