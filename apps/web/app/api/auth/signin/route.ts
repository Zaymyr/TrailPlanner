import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAnonConfig, getSupabaseServiceConfig } from "../../../../lib/supabase";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-cookies";
import { normalizeSignInErrorCode, SIGN_IN_ERROR_CODES } from "../../../../lib/auth-errors";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const parsedBody = signInSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ code: SIGN_IN_ERROR_CODES.signInFailed }, { status: 400 });
  }

  const supabaseConfig = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseConfig || !supabaseService) {
    return NextResponse.json({ code: SIGN_IN_ERROR_CODES.signInFailed }, { status: 500 });
  }

  try {
    const fetchResponse = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify(parsedBody.data),
      cache: "no-store",
    });

    const result = await fetchResponse.json().catch(() => null);

    if (!fetchResponse.ok || !result) {
      return NextResponse.json(
        { code: normalizeSignInErrorCode(result) },
        { status: fetchResponse.status || 400 }
      );
    }

    const response = NextResponse.json(
      {
        user: result.user,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      },
      { status: 200 }
    );

    const cookieTtl = typeof result.expires_in === "number" ? result.expires_in : 60 * 60;
    const isSecure = process.env.NODE_ENV === "production";

    response.cookies.set(ACCESS_TOKEN_COOKIE, result.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: cookieTtl,
    });

    if (result.refresh_token) {
      response.cookies.set(REFRESH_TOKEN_COOKIE, result.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (result.user?.id) {
      void fetch(`${supabaseService.supabaseUrl}/rest/v1/rpc/increment_user_sign_in`, {
        method: "POST",
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_user_id: result.user.id }),
        cache: "no-store",
      }).catch((error) => {
        console.error("Unable to increment sign-in metrics", error);
      });
    }

    return response;
  } catch (error) {
    console.error("Unexpected Supabase error during sign in", error);
    return NextResponse.json({ code: SIGN_IN_ERROR_CODES.signInFailed }, { status: 500 });
  }
}
