import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";

type EventType = "popup_open" | "click";

const bodySchema = z.object({
  eventType: z.enum(["popup_open", "click"]),
  productId: z.string().uuid(),
  offerId: z.string().uuid().optional(),
  sessionId: z.string().min(4),
  country: z.string().trim().length(2).optional(),
  merchant: z.string().trim().min(1).optional(),
  userAgent: z.string().trim().optional(),
  ipAddress: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`affiliate-events:${rateLimitKey}`, 80, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({
        message: "Too many events.",
      }, {
        status: 429,
        headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() },
      })
    );
  }

  const supabaseAnon = getSupabaseAnonConfig();
  const bearer = extractBearerToken(request.headers.get("authorization"));
  const userId = bearer && supabaseAnon ? (await fetchSupabaseUser(bearer, supabaseAnon))?.id : null;

  const payload = parsedBody.data;
  const userAgent = payload.userAgent ?? request.headers.get("user-agent") ?? undefined;
  const ipAddress = payload.ipAddress ?? rateLimitKey;

  try {
    const response = await fetch(`${supabaseService.supabaseUrl}/rest/v1/affiliate_events`, {
      method: "POST",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: payload.eventType satisfies EventType,
        product_id: payload.productId,
        offer_id: payload.offerId ?? null,
        session_id: payload.sessionId,
        country_code: payload.country ?? null,
        merchant: payload.merchant ?? null,
        user_agent: userAgent,
        ip_address: ipAddress,
        user_id: userId ?? null,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Unable to record affiliate event", await response.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to record event." }, { status: 502 })
      );
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unexpected error while recording affiliate event", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to record event." }, { status: 500 }));
  }
}
