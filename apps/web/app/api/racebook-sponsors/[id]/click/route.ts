import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../lib/http";
import { serviceHeaders } from "../../../../../lib/organizer";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });
const targetSchema = z.object({ website_url: z.string().url(), edition_id: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!parsedParams.success || !raceId || !z.string().uuid().safeParse(raceId).success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid sponsor link." }, { status: 400 }));
  }
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 500 }));

  const targetResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${parsedParams.data.id}&is_active=eq.true&website_url=not.is.null&select=website_url,edition_id&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  if (!targetResponse.ok) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 502 }));
  const target = z.array(targetSchema).parse(await targetResponse.json())[0] ?? null;
  if (!target) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 410 }));

  const raceResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&edition_id=eq.${target.edition_id}&select=id&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );
  const matchingRace = raceResponse.ok
    ? z.array(z.object({ id: z.string().uuid() })).parse(await raceResponse.json())[0]
    : null;
  if (!matchingRace) return withSecurityHeaders(NextResponse.json({ message: "Sponsor link unavailable." }, { status: 410 }));

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

  const response = NextResponse.redirect(target.website_url, { status: 302 });
  response.headers.set("Cache-Control", "no-store, private");
  return withSecurityHeaders(response);
}
