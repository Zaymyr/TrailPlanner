import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, getSupabaseAnonConfig } from "../../../../lib/supabase";

const supabaseCoachTierSchema = z.array(
  z.object({
    name: z.string(),
    invite_limit: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  })
);

const coachTiersResponseSchema = z.object({
  tiers: z.array(
    z.object({
      name: z.string(),
      inviteLimit: z.number().int().nonnegative(),
    })
  ),
});

export async function GET(request: NextRequest) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`coach-tiers:${rateLimitKey}`, 60, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_tiers?select=name,invite_limit&order=invite_limit.asc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach tiers." }, { status: 502 }));
    }

    const parsed = supabaseCoachTierSchema.safeParse(payload);

    if (!parsed.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach tiers." }, { status: 500 }));
    }

    const tiers = parsed.data.map((tier) => ({
      name: tier.name,
      inviteLimit: tier.invite_limit,
    }));

    return withSecurityHeaders(NextResponse.json(coachTiersResponseSchema.parse({ tiers })));
  } catch (error) {
    console.error("Unexpected error while loading coach tiers", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach tiers." }, { status: 500 }));
  }
}
