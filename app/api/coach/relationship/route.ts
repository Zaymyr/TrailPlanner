import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachRelationshipResponseSchema } from "../../../../lib/coach-relationship";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const coachCoacheeRowSchema = z.array(
  z.object({
    status: z.string(),
    created_at: z.string(),
  })
);

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

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-relationship:${supabaseUser.id}`, 30, 60_000);

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
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_coachees?coachee_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&select=status,created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 502 }));
    }

    const rows = coachCoacheeRowSchema.safeParse(await response.json());

    if (!rows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 500 }));
    }

    const status = rows.data[0]?.status ?? null;

    return withSecurityHeaders(NextResponse.json(coachRelationshipResponseSchema.parse({ status })));
  } catch (error) {
    console.error("Unexpected error while loading coach relationship", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 500 }));
  }
}
