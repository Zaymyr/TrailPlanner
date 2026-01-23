import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  coachInviteCreateSchema,
  coachInviteResponseSchema,
  coachInviteUserEnvelopeSchema,
  coachInviteUserListSchema,
} from "../../../../lib/coach-invites";
import { fetchCoachTierById, fetchCoachTierByName } from "../../../../lib/coach-tiers";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";

type SupabaseCoachProfileRow = {
  coach_tier_id: string | null;
  subscription_status: string | null;
};

type SupabaseUserProfileRow = {
  is_coach: boolean | null;
  coach_plan_name: string | null;
};

type SupabaseCoachCoacheeRow = {
  coach_id: string;
  coachee_id: string;
  status: string;
  invited_email: string | null;
};

type SupabaseCoachInviteRow = {
  id: string;
  coach_id: string;
  invite_email: string;
  status: string;
  invitee_user_id: string | null;
};

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const coachProfileSchema = z.array(
  z.object({
    coach_tier_id: z.string().uuid().nullable(),
    subscription_status: z.string().nullable(),
  })
);

const userProfileSchema = z.array(
  z.object({
    is_coach: z.boolean().nullable(),
    coach_plan_name: z.string().nullable(),
  })
);

const parseContentRangeCount = (contentRange: string | null): number | null => {
  if (!contentRange) return null;
  const total = contentRange.split("/")[1];
  if (!total) return null;
  const parsed = Number.parseInt(total, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const fetchCoachProfile = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string
): Promise<SupabaseCoachProfileRow | null | undefined> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_profiles?user_id=eq.${encodeURIComponent(
      coachId
    )}&select=coach_tier_id,subscription_status&limit=1`,
    {
      headers: buildAuthHeaders(supabaseKey, accessToken, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load coach profile", await response.text());
    return undefined;
  }

  const rows = coachProfileSchema.safeParse(await response.json().catch(() => null));
  if (!rows.success) {
    console.error("Unexpected coach profile payload", rows.error);
    return undefined;
  }

  return rows.data?.[0] ?? null;
};

const fetchUserProfile = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string
): Promise<SupabaseUserProfileRow | null | undefined> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
      coachId
    )}&select=is_coach,coach_plan_name&limit=1`,
    {
      headers: buildAuthHeaders(supabaseKey, accessToken, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load user profile", await response.text());
    return undefined;
  }

  const rows = userProfileSchema.safeParse(await response.json().catch(() => null));
  if (!rows.success) {
    console.error("Unexpected user profile payload", rows.error);
    return undefined;
  }

  return rows.data?.[0] ?? null;
};

const isActiveSubscription = (coachProfile: SupabaseCoachProfileRow | null): boolean => {
  const normalizedStatus = coachProfile?.subscription_status?.toLowerCase() ?? null;
  return normalizedStatus === "active" || normalizedStatus === "trialing";
};

const fetchCoachInviteCount = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string
): Promise<number | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?coach_id=eq.${encodeURIComponent(
      coachId
    )}&status=neq.canceled&select=id`,
    {
      headers: {
        ...buildAuthHeaders(supabaseKey, accessToken, undefined),
        Prefer: "count=exact",
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    console.error("Unable to load coach invite count", payload);
    return null;
  }

  const countFromHeader = parseContentRangeCount(response.headers.get("content-range"));
  if (typeof countFromHeader === "number") {
    return countFromHeader;
  }

  return Array.isArray(payload) ? payload.length : null;
};

const fetchExistingInvite = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  email: string
): Promise<SupabaseCoachInviteRow | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?coach_id=eq.${encodeURIComponent(
      coachId
    )}&invite_email=eq.${encodeURIComponent(
      email
    )}&status=neq.canceled&select=id,coach_id,invite_email,status,invitee_user_id&limit=1`,
    {
      headers: buildAuthHeaders(supabaseKey, accessToken, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to check existing invite", await response.text());
    return null;
  }

  const rows = (await response.json().catch(() => null)) as SupabaseCoachInviteRow[] | null;
  return rows?.[0] ?? null;
};

const fetchExistingCoachee = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  coacheeId: string
): Promise<SupabaseCoachCoacheeRow | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_coachees?coach_id=eq.${encodeURIComponent(
      coachId
    )}&coachee_id=eq.${encodeURIComponent(coacheeId)}&select=coach_id,coachee_id,status,invited_email&limit=1`,
    {
      headers: buildAuthHeaders(supabaseKey, accessToken, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to check existing coachee", await response.text());
    return null;
  }

  const rows = (await response.json().catch(() => null)) as SupabaseCoachCoacheeRow[] | null;
  return rows?.[0] ?? null;
};

const insertCoachInvite = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  payload: {
    coach_id: string;
    invite_email: string;
    status: "pending" | "accepted";
    invitee_user_id?: string | null;
    accepted_at?: string | null;
  }
): Promise<{ id: string } | null> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/coach_invites`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(supabaseKey, accessToken),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      coach_id: payload.coach_id,
      invite_email: payload.invite_email,
      status: payload.status,
      invitee_user_id: payload.invitee_user_id ?? null,
      accepted_at: payload.accepted_at ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to create coach invite", await response.text());
    return null;
  }

  const rows = (await response.json().catch(() => null)) as Array<{ id?: string }> | null;
  const id = rows?.[0]?.id;
  return id ? { id } : null;
};

const updateCoachInvite = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  inviteId: string,
  payload: {
    invitee_user_id?: string | null;
    status?: "pending" | "accepted" | "canceled";
    accepted_at?: string | null;
  }
): Promise<boolean> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/coach_invites?id=eq.${encodeURIComponent(inviteId)}`, {
    method: "PATCH",
    headers: {
      ...buildAuthHeaders(supabaseKey, accessToken),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      invitee_user_id: payload.invitee_user_id,
      status: payload.status,
      accepted_at: payload.accepted_at,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to update coach invite", await response.text());
    return false;
  }

  return true;
};

const sendPasswordInvite = async (supabaseUrl: string, supabaseAnonKey: string, email: string, origin: string) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email, redirect_to: `${origin}/reset-password` }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to send password invite", await response.text());
    return false;
  }

  return true;
};

const fetchUserByEmail = async (
  supabaseUrl: string,
  serviceKey: string,
  email: string
): Promise<{ id: string; email?: string } | null> => {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    console.error("Unable to find user by email", payload);
    return null;
  }

  const envelope = coachInviteUserEnvelopeSchema.safeParse(payload);
  if (envelope.success) {
    return envelope.data.users[0] ?? null;
  }

  const list = coachInviteUserListSchema.safeParse(payload);
  if (list.success) {
    return list.data[0] ?? null;
  }

  return null;
};

export async function POST(request: NextRequest) {
  const parsedBody = coachInviteCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid invite payload." }, { status: 400 }));
  }

  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-invite:${supabaseUser.id}`, 6, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const [coachProfile, profileRow] = await Promise.all([
    fetchCoachProfile(supabaseAnon.supabaseUrl, supabaseAnon.supabaseAnonKey, token, supabaseUser.id),
    fetchUserProfile(supabaseAnon.supabaseUrl, supabaseAnon.supabaseAnonKey, token, supabaseUser.id),
  ]);

  if (coachProfile === undefined || profileRow === undefined) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify subscription." }, { status: 502 }));
  }

  const isCoachFromSubscription = isActiveSubscription(coachProfile);
  const isCoachFallback = Boolean(profileRow?.is_coach);

  if (!isCoachFromSubscription && !isCoachFallback) {
    return withSecurityHeaders(NextResponse.json({ message: "Coach subscription required." }, { status: 403 }));
  }

  const coachPlanName = isCoachFallback ? profileRow?.coach_plan_name ?? null : null;
  let coachTier = null;

  if (isCoachFromSubscription && coachProfile?.coach_tier_id) {
    coachTier = await fetchCoachTierById(coachProfile.coach_tier_id);
  }

  if (!coachTier && coachPlanName) {
    coachTier = await fetchCoachTierByName(coachPlanName);
  }

  if (!coachTier) {
    return withSecurityHeaders(NextResponse.json({ message: "Coach tier not found." }, { status: 403 }));
  }

  const inviteCount = await fetchCoachInviteCount(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    token,
    supabaseUser.id
  );

  if (inviteCount === null) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify invite count." }, { status: 502 }));
  }

  if (inviteCount >= coachTier.invite_limit) {
    return withSecurityHeaders(NextResponse.json({ message: "Invite limit reached." }, { status: 403 }));
  }

  const email = parsedBody.data.email.toLowerCase();
  const existingInvite = await fetchExistingInvite(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    token,
    supabaseUser.id,
    email
  );

  if (existingInvite) {
    return withSecurityHeaders(NextResponse.json({ message: "Invite already sent." }, { status: 409 }));
  }

  const existingUser = await fetchUserByEmail(
    supabaseService.supabaseUrl,
    supabaseService.supabaseServiceRoleKey,
    email
  );

  if (existingUser?.id) {
    if (existingUser.id === supabaseUser.id) {
      return withSecurityHeaders(NextResponse.json({ message: "Cannot invite yourself." }, { status: 400 }));
    }

    const existingCoachee = await fetchExistingCoachee(
      supabaseAnon.supabaseUrl,
      supabaseAnon.supabaseAnonKey,
      token,
      supabaseUser.id,
      existingUser.id
    );

    if (existingCoachee) {
      return withSecurityHeaders(NextResponse.json({ message: "Coachee already invited." }, { status: 409 }));
    }

    const inviteInserted = await insertCoachInvite(
      supabaseAnon.supabaseUrl,
      supabaseAnon.supabaseAnonKey,
      token,
      {
        coach_id: supabaseUser.id,
        invite_email: email,
        status: "pending",
        invitee_user_id: existingUser.id,
      }
    );

    if (!inviteInserted) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create coach invite." }, { status: 502 }));
    }

    const inviteSent = await sendPasswordInvite(
      supabaseAnon.supabaseUrl,
      supabaseAnon.supabaseAnonKey,
      email,
      request.nextUrl.origin
    );

    if (!inviteSent) {
      await updateCoachInvite(supabaseAnon.supabaseUrl, supabaseAnon.supabaseAnonKey, token, inviteInserted.id, {
        status: "canceled",
      });
      return withSecurityHeaders(NextResponse.json({ message: "Unable to invite user." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json(coachInviteResponseSchema.parse({ status: "pending" })));
  }

  const inviteInserted = await insertCoachInvite(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    token,
    {
      coach_id: supabaseUser.id,
      invite_email: email,
      status: "pending",
    }
  );

  if (!inviteInserted) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create coach invite." }, { status: 502 }));
  }

  const adminClient = createClient(supabaseService.supabaseUrl, supabaseService.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.nextUrl.origin}/reset-password`,
  });

  if (inviteResponse.error || !inviteResponse.data.user?.id) {
    console.error("Unable to invite user", inviteResponse.error);
    await updateCoachInvite(supabaseAnon.supabaseUrl, supabaseAnon.supabaseAnonKey, token, inviteInserted.id, {
      status: "canceled",
    });
    return withSecurityHeaders(NextResponse.json({ message: "Unable to invite user." }, { status: 502 }));
  }

  const invitedUserId = inviteResponse.data.user.id;

  const inviteUpdated = await updateCoachInvite(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    token,
    inviteInserted.id,
    {
      invitee_user_id: invitedUserId,
    }
  );

  if (!inviteUpdated) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create coach invite." }, { status: 502 }));
  }

  return withSecurityHeaders(NextResponse.json(coachInviteResponseSchema.parse({ status: "pending" })));
}
