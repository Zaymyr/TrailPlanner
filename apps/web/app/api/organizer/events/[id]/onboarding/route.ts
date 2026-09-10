import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";

const membershipSchema = z.object({
  id: z.string().uuid(),
  dashboard_onboarding_completed_at: z.string().nullable(),
});

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const membershipResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?event_id=eq.${parsedParams.data.id}&user_id=eq.${auth.user.id}&revoked_at=is.null&select=id,dashboard_onboarding_completed_at&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!membershipResponse.ok) {
    console.error("Unable to load organizer onboarding membership", await membershipResponse.text());
    return jsonError("Unable to save onboarding progress.", 502);
  }

  const memberships = z.array(membershipSchema).safeParse(await membershipResponse.json().catch(() => null));
  if (!memberships.success) return jsonError("Unable to save onboarding progress.", 502);
  const membership = memberships.data[0];
  if (!membership) return jsonError("Not authorized for this event.", 403);

  if (membership.dashboard_onboarding_completed_at) {
    return withSecurityHeaders(NextResponse.json({
      completedAt: membership.dashboard_onboarding_completed_at,
    }));
  }

  const completedAt = new Date().toISOString();
  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?id=eq.${membership.id}&dashboard_onboarding_completed_at=is.null`,
    {
      method: "PATCH",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({ dashboard_onboarding_completed_at: completedAt }),
      cache: "no-store",
    },
  );
  if (!updateResponse.ok) {
    console.error("Unable to complete organizer dashboard onboarding", await updateResponse.text());
    return jsonError("Unable to save onboarding progress.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ completedAt }));
}
