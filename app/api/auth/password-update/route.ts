import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, getSupabaseAnonConfig } from "../../../../lib/supabase";

const passwordUpdateSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  const parsedBody = passwordUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid password update request." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`auth-update:${rateLimitKey}`, 6, 60_000);

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
    const response = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: parsedBody.data.password }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null))?.msg ?? "Unable to update password.";
      return withSecurityHeaders(NextResponse.json({ message }, { status: response.status || 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unable to update password", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update password." }, { status: 500 }));
  }
}
