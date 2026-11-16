import { NextRequest, NextResponse } from "next/server";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../lib/http";
import { keepKnownAttribution, organizerDemoRequestSchema, submitOrganizerDemoRequest } from "../../../lib/organizer-demo-requests";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

const json = (body: unknown, status = 200) => withSecurityHeaders(NextResponse.json(body, { status }));

/**
 * Public demo request from /organisateurs: stores the request for the admin
 * inbox, e-mails the team and sends the organizer a receipt.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = await checkRateLimitAsync(`organizer-demo:${ip}`, 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) return json({ message: "Trop de demandes. Réessayez dans un moment." }, 429);

  const parsed = organizerDemoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ message: parsed.error.issues[0]?.message ?? "Demande invalide." }, 400);
  }
  // Bots filling the hidden field get the same success response, without any write.
  if (parsed.data.website) return json({ ok: true }, 201);

  const result = await submitOrganizerDemoRequest(getSupabaseServiceConfig(), {
    email: parsed.data.email,
    raceUrl: parsed.data.raceUrl,
    phone: parsed.data.phone,
    attribution: keepKnownAttribution(parsed.data.attribution),
  });
  if (!result.stored && result.adminEmail !== "sent") {
    return json({ message: "Impossible d’envoyer la demande pour le moment. Écrivez-nous à faustin@pace-yourself.com." }, 502);
  }
  return json({ ok: true }, 201);
}
