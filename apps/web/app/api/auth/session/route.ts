import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-cookies";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  isAnonymousUser,
} from "../../../../lib/supabase";
import { ensureTrialStatus } from "../../../../lib/trial-server";

type RefreshTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const cookieStore = cookies();

  let accessToken =
    extractBearerToken(request.headers.get("authorization")) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  let refreshToken =
    extractBearerToken(request.headers.get("x-refresh-token")) ?? cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!accessToken) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  let user = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!user && refreshToken) {
    const refreshResponse = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    const refreshData = (await refreshResponse.json().catch(() => null)) as RefreshTokenPayload | null;

    if (refreshResponse.ok && refreshData?.access_token) {
      accessToken = refreshData.access_token;
      refreshToken = refreshData.refresh_token ?? refreshToken;
      user = await fetchSupabaseUser(accessToken, supabaseConfig);
    }
  }

  if (!user) {
    return NextResponse.json({ message: "Unable to validate session." }, { status: 401 });
  }

  if (user.id) {
    try {
      await ensureTrialStatus({
        supabaseUrl: supabaseConfig.supabaseUrl,
        supabaseKey: supabaseConfig.supabaseAnonKey,
        token: accessToken,
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
      isAnonymous: isAnonymousUser(user),
    },
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  const isSecure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
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
