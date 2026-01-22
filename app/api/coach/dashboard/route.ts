import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachDashboardResponseSchema } from "../../../../lib/coach-dashboard";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { fetchCoachTierById, fetchCoachTierByName } from "../../../../lib/coach-tiers";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const coachProfileSchema = z.array(
  z.object({
    coach_tier_id: z.string().uuid().nullable().optional(),
    subscription_status: z.string().nullable().optional(),
  })
);

const userProfileSchema = z.array(
  z.object({
    is_coach: z.boolean().nullable().optional(),
    coach_plan_name: z.string().nullable().optional(),
  })
);

const coachInviteRowSchema = z.array(
  z.object({
    id: z.string().uuid(),
    invite_email: z.string().email(),
    status: z.string(),
    created_at: z.string(),
    accepted_at: z.string().nullable().optional(),
    invitee_user_id: z.string().uuid().nullable().optional(),
  })
);

const coachCoacheeRowSchema = z.array(
  z.object({
    coachee_id: z.string().uuid(),
    status: z.string(),
    invited_email: z.string().nullable().optional(),
    created_at: z.string(),
    coachee: z
      .object({
        full_name: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
);

const buildAuthHeaders = (supabaseKey: string, accessToken: string) => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
});

const parseContentRangeCount = (contentRange: string | null): number | null => {
  if (!contentRange) return null;
  const [, total] = contentRange.split("/");
  if (!total) return null;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : null;
};

const isActiveSubscription = (subscriptionStatus?: string | null): boolean => {
  const normalizedStatus = subscriptionStatus?.toLowerCase() ?? null;
  return normalizedStatus === "active" || normalizedStatus === "trialing";
};

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

  const rateLimit = checkRateLimit(`coach-dashboard:${supabaseUser.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const [coachProfileResponse, profileResponse] = await Promise.all([
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_profiles?user_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&select=coach_tier_id,subscription_status&limit=1`,
        {
          headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      ),
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&select=is_coach,coach_plan_name&limit=1`,
        {
          headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      ),
    ]);

    if (!coachProfileResponse.ok || !profileResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to verify subscription." }, { status: 502 }));
    }

    const coachProfileRows = coachProfileSchema.safeParse(await coachProfileResponse.json());
    const profileRows = userProfileSchema.safeParse(await profileResponse.json());

    if (!coachProfileRows.success || !profileRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to verify subscription." }, { status: 500 }));
    }

    const coachProfile = coachProfileRows.data?.[0] ?? null;
    const profileRow = profileRows.data?.[0] ?? null;
    const isCoachFromSubscription = isActiveSubscription(coachProfile?.subscription_status);
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

    const [invitesResponse, coacheesResponse] = await Promise.all([
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_invites?coach_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&status=neq.canceled&select=id,invite_email,status,created_at,accepted_at,invitee_user_id&order=created_at.desc`,
        {
          headers: {
            ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
            Prefer: "count=exact",
          },
          cache: "no-store",
        }
      ),
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_coachees?coach_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&select=coachee_id,status,invited_email,created_at,coachee:coachee_id(full_name)&order=created_at.desc`,
        {
          headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      ),
    ]);

    const invitePayload = (await invitesResponse.json().catch(() => null)) as unknown;

    if (!invitesResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach dashboard." }, { status: 502 }));
    }

    if (!coacheesResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach dashboard." }, { status: 502 }));
    }

    const invitesRows = coachInviteRowSchema.safeParse(invitePayload);
    const coacheeRows = coachCoacheeRowSchema.safeParse(await coacheesResponse.json());

    if (!invitesRows.success || !coacheeRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach dashboard." }, { status: 500 }));
    }

    const countFromHeader = parseContentRangeCount(invitesResponse.headers.get("content-range"));
    const invitesUsed =
      typeof countFromHeader === "number" ? countFromHeader : invitesRows.data ? invitesRows.data.length : 0;

    const seatsRemaining = Math.max(coachTier.invite_limit - invitesUsed, 0);

    const invites = invitesRows.data.map((row) => ({
      id: row.id,
      email: row.invite_email,
      status: row.status,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at ?? null,
      inviteeUserId: row.invitee_user_id ?? null,
    }));

    const coachees = coacheeRows.data.map((row) => ({
      id: row.coachee_id,
      status: row.status,
      fullName: row.coachee?.full_name ?? null,
      invitedEmail: row.invited_email ?? null,
      createdAt: row.created_at,
    }));

    return withSecurityHeaders(
      NextResponse.json(
        coachDashboardResponseSchema.parse({
          dashboard: {
            tier: {
              name: coachTier.name,
              inviteLimit: coachTier.invite_limit,
            },
            invitesUsed,
            seatsRemaining,
            coachees,
            invites,
          },
        })
      )
    );
  } catch (error) {
    console.error("Unexpected error while loading coach dashboard", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach dashboard." }, { status: 500 }));
  }
}
