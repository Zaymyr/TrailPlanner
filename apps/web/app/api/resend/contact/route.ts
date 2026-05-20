import { NextRequest, NextResponse } from "next/server";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { syncIdentifiedUserToResendContact } from "../../../../lib/resend";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
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

  const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);

  if (!supabaseUser) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (supabaseUser.isAnonymous || supabaseUser.appMetadata?.provider === "anonymous") {
    return withSecurityHeaders(NextResponse.json({ status: "skipped", reason: "anonymous-user" }));
  }

  const rateLimit = await checkRateLimitAsync(`resend-contact-sync:${supabaseUser.id}`, 6, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many Resend contact sync requests.", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      )
    );
  }

  const result = await syncIdentifiedUserToResendContact(supabaseUser);

  if (result.status === "failed") {
    console.error("Unable to sync identified user to Resend", {
      userId: supabaseUser.id,
      statusCode: result.statusCode,
      message: result.message,
    });
    return withSecurityHeaders(NextResponse.json({ message: "Unable to sync Resend contact." }, { status: 502 }));
  }

  return withSecurityHeaders(NextResponse.json(result));
}
