import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-cookies";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";
import { ensureTrialStatus } from "../../../../lib/trial-server";

type RefreshTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type CoachInviteRow = {
  id: string;
  coach_id: string;
  invite_email: string;
};

const acceptCoachInvites = async ({
  supabaseUrl,
  serviceKey,
  userId,
  email,
}: {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  email: string;
}) => {
  const params = new URLSearchParams({
    select: "id,coach_id,invite_email",
    status: "neq.accepted",
    or: `(invitee_user_id.eq.${userId},invite_email.eq.${email})`,
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/coach_invites?${params.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to fetch coach invites", await response.text());
    return;
  }

  const invites = (await response.json().catch(() => null)) as CoachInviteRow[] | null;

  if (!invites?.length) {
    return;
  }

  const coachRows = invites.map((invite) => ({
    coach_id: invite.coach_id,
    coachee_id: userId,
    status: "active",
    invited_email: invite.invite_email,
  }));

  const insertResponse = await fetch(
    `${supabaseUrl}/rest/v1/coach_coachees?on_conflict=coach_id,coachee_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(coachRows),
      cache: "no-store",
    }
  );

  if (!insertResponse.ok) {
    console.error("Unable to create coach coachee links", await insertResponse.text());
    return;
  }

  const inviteIds = invites.map((invite) => invite.id).join(",");
  const acceptedAt = new Date().toISOString();

  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?id=in.(${inviteIds})`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "accepted",
        accepted_at: acceptedAt,
        invitee_user_id: userId,
      }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to mark coach invites as accepted", await updateResponse.text());
  }
};

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseConfig || !supabaseService) {
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

    if (user.email) {
      try {
        await acceptCoachInvites({
          supabaseUrl: supabaseService.supabaseUrl,
          serviceKey: supabaseService.supabaseServiceRoleKey,
          userId: user.id,
          email: user.email.toLowerCase(),
        });
      } catch (error) {
        console.error("Unable to accept coach invites", error);
      }
    }
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
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
