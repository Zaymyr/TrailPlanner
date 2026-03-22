import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";
import { markTrialExpiredSeen } from "../../../../lib/trial-server";

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`trial-expired:${rateLimitKey}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  try {
    const trialExpiredSeenAt = await markTrialExpiredSeen({
      supabaseUrl: supabaseConfig.supabaseUrl,
      supabaseKey: supabaseConfig.supabaseAnonKey,
      token,
      userId: user.id,
    });

    return withSecurityHeaders(NextResponse.json({ trialExpiredSeenAt }));
  } catch (error) {
    console.error("Unable to update trial expired state", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update trial state." }, { status: 500 }));
  }
}
