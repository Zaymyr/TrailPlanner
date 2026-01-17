import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-cookies";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";
import { ensureTrialStatus } from "../../../../lib/trial-server";

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const cookieStore = cookies();

  const token =
    extractBearerToken(request.headers.get("authorization")) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken =
    extractBearerToken(request.headers.get("x-refresh-token")) ?? cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user) {
    return NextResponse.json({ message: "Unable to validate session." }, { status: 401 });
  }

  if (user.id) {
    try {
      await ensureTrialStatus({
        supabaseUrl: supabaseConfig.supabaseUrl,
        supabaseKey: supabaseConfig.supabaseAnonKey,
        token,
        userId: user.id,
      });
    } catch (error) {
      console.error("Unable to initialize trial state", error);
    }
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
    },
  });

  const isSecure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60,
  });

  if (refreshToken) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
