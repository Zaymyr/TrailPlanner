import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { serviceHeaders } from "../../../../lib/organizer";
import { loadPublishedPartnerSlotTarget } from "../../../../lib/racebook-partner-slot-target";
import { racebookPartnerSlotKeySchema } from "../../../../lib/racebook-partner-slots";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

const impressionSchema = z.object({
  raceId: z.string().uuid(),
  slot: racebookPartnerSlotKeySchema,
  viewId: z.string().uuid(),
});

const noContent = () => {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store, private");
  return withSecurityHeaders(response);
};

export async function POST(request: NextRequest) {
  const input = impressionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid partner slot impression." }, { status: 400 }));
  }
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return withSecurityHeaders(NextResponse.json({ message: "Partner analytics unavailable." }, { status: 500 }));

  const partner = await loadPublishedPartnerSlotTarget(serviceConfig, input.data.raceId, input.data.slot);
  if (!partner) return noContent();

  // Same aggregate-only contract as sponsor impressions: an ephemeral per-view
  // guard plus a global ceiling, never a runner or network identifier.
  const viewLimit = checkRateLimit(
    `racebook-partner-slot-impression:${input.data.viewId}:${input.data.raceId}:${input.data.slot}`,
    1,
    6 * 60 * 60 * 1_000,
  );
  const globalLimit = checkRateLimit("racebook-partner-slot-impression-global", 600, 60_000);
  if (!viewLimit.allowed || !globalLimit.allowed) return noContent();

  const countResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/increment_racebook_partner_slot_metric`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({ p_race_id: input.data.raceId, p_slot_key: input.data.slot, p_metric: "impression" }),
    cache: "no-store",
  }).catch((error) => {
    console.error("Unable to count partner slot impression", error);
    return null;
  });
  if (countResponse && !countResponse.ok) console.warn("Partner slot impression was not accepted", countResponse.status);
  return noContent();
}
