import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../lib/http";
import { serviceHeaders } from "../../../../../lib/organizer";
import { loadPublishedPartnerSlotTarget } from "../../../../../lib/racebook-partner-slot-target";
import { racebookPartnerSlotKeySchema } from "../../../../../lib/racebook-partner-slots";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ slot: racebookPartnerSlotKeySchema });
const unavailable = () => withSecurityHeaders(NextResponse.json({ message: "Partner link unavailable." }, { status: 410 }));

export async function GET(request: NextRequest, context: { params: { slot?: string } }) {
  const params = paramsSchema.safeParse(context.params);
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!params.success || !raceId || !z.string().uuid().safeParse(raceId).success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid partner link." }, { status: 400 }));
  }
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return withSecurityHeaders(NextResponse.json({ message: "Partner link unavailable." }, { status: 500 }));

  const partner = await loadPublishedPartnerSlotTarget(serviceConfig, raceId, params.data.slot);
  if (!partner?.destinationUrl) return unavailable();

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const networkHash = createHash("sha256").update(forwardedFor).digest("hex").slice(0, 24);
  let shouldCount = false;
  try {
    shouldCount = (await checkRateLimitAsync(`racebook-partner-slot:${raceId}:${params.data.slot}:${networkHash}`, 10, 60_000)).allowed;
  } catch (error) {
    console.error("Unable to rate limit partner slot click", error);
  }
  if (shouldCount) {
    await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/increment_racebook_partner_slot_metric`, {
      method: "POST",
      headers: serviceHeaders(serviceConfig),
      body: JSON.stringify({ p_race_id: raceId, p_slot_key: params.data.slot, p_metric: "click" }),
      cache: "no-store",
    }).catch((error) => console.error("Unable to count partner slot click", error));
  }

  const response = NextResponse.redirect(partner.destinationUrl, { status: 302 });
  response.headers.set("Cache-Control", "no-store, private");
  return withSecurityHeaders(response);
}
