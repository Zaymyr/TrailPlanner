import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseAnonConfig } from "../../../../lib/supabase";

const resetRequestSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: NextRequest) {
  const parsedBody = resetRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid reset request." }, { status: 400 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`auth-reset:${rateLimitKey}`, 8, 60_000);

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

  try {
    const redirectTo = `${request.nextUrl.origin}/reset-password`;
    const response = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify({ email: parsedBody.data.email, redirect_to: redirectTo }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null))?.msg ?? "Unable to send reset email.";
      return withSecurityHeaders(NextResponse.json({ message }, { status: response.status || 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unable to request password reset", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to send reset email." }, { status: 500 }));
  }
}
