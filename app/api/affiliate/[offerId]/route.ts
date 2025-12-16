import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

const paramsSchema = z.object({ offerId: z.string().uuid() });

const offerSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  affiliate_url: z.string().url(),
  country_code: z.string().length(2).nullable(),
  active: z.boolean(),
});

export async function GET(request: NextRequest, { params }: { params: { offerId: string } }) {
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid offer." }, { status: 400 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`affiliate:${rateLimitKey}`, 40, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Too many requests." }, {
        status: 429,
        headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() },
      })
    );
  }

  const supabaseConfig = getSupabaseServiceConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const offerId = parsedParams.data.offerId;

  try {
    const offerResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/affiliate_offers?id=eq.${offerId}&select=id,product_id,affiliate_url,country_code,active`,
      {
        headers: {
          apikey: supabaseConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!offerResponse.ok) {
      console.error("Unable to load affiliate offer", await offerResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to resolve offer." }, { status: 502 }));
    }

    const offer = z.array(offerSchema).parse(await offerResponse.json())[0];

    if (!offer || !offer.active) {
      return withSecurityHeaders(NextResponse.json({ message: "Offer not available." }, { status: 410 }));
    }

    await fetch(`${supabaseConfig.supabaseUrl}/rest/v1/affiliate_click_events`, {
      method: "POST",
      headers: {
        apikey: supabaseConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseConfig.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        offer_id: offer.id,
        product_id: offer.product_id,
        country_code: offer.country_code,
        ip_address: rateLimitKey,
        user_agent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
      }),
      cache: "no-store",
    }).catch((error) => {
      console.error("Unable to log affiliate click", error);
    });

    const redirectResponse = NextResponse.redirect(offer.affiliate_url, { status: 302 });
    redirectResponse.headers.set("Cache-Control", "no-store, private");
    return withSecurityHeaders(redirectResponse);
  } catch (error) {
    console.error("Unexpected error while redirecting to affiliate link", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to resolve offer." }, { status: 500 }));
  }
}
