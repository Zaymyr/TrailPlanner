import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { revenueCatProviderSchema, syncRevenueCatSubscriptionForUser } from "../../../../lib/revenuecat";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const syncBodySchema = z.object({
  providerHint: revenueCatProviderSchema.nullish(),
});

export async function POST(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const payload = await request.json().catch(() => ({}));
  const parsedBody = syncBodySchema.safeParse(payload);

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  const result = await syncRevenueCatSubscriptionForUser(user.id, {
    providerHint: parsedBody.data.providerHint ?? null,
  });

  return withSecurityHeaders(NextResponse.json({ result }));
}
