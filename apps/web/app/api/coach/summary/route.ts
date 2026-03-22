import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachSummaryResponseSchema } from "../../../../lib/coach-summary";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const coachProfileSchema = z.array(
  z.object({
    is_coach: z.boolean().nullable().optional(),
    coach_plan_name: z.string().nullable().optional(),
  })
);

const coachSubscriptionProfileSchema = z.array(
  z.object({
    coach_tier_id: z.string().nullable().optional(),
    subscription_status: z.string().nullable().optional(),
  })
);

const coachTierSchema = z.array(
  z.object({
    name: z.string().optional(),
    invite_limit: z.union([z.number(), z.string()]).transform((value) => Number(value)),
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

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`coach-summary:${rateLimitKey}`, 60, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!supabaseUser) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid access token." }, { status: 401 }));
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

    if (!profileResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach summary." }, { status: 502 }));
    }

    const profileRows = coachProfileSchema.safeParse(await profileResponse.json());
    const coachProfileRows = coachProfileResponse.ok
      ? coachSubscriptionProfileSchema.safeParse(await coachProfileResponse.json())
      : null;

    if (!profileRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach summary." }, { status: 500 }));
    }

    const profileRow = profileRows.data?.[0];
    const fallbackIsCoach = Boolean(profileRow?.is_coach);
    const fallbackPlanName = fallbackIsCoach ? profileRow?.coach_plan_name ?? null : null;
    const coachProfileRow = coachProfileRows?.success ? coachProfileRows.data?.[0] : null;
    const normalizedStatus = coachProfileRow?.subscription_status?.toLowerCase() ?? null;
    const isCoachFromSubscription = normalizedStatus === "active" || normalizedStatus === "trialing";
    const coachTierId = isCoachFromSubscription ? coachProfileRow?.coach_tier_id ?? null : null;
    const isCoach = isCoachFromSubscription || fallbackIsCoach;
    let planName = isCoachFromSubscription ? null : fallbackPlanName;

    let inviteLimit: number | null = null;

    if (coachTierId) {
      const tierResponse = await fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_tiers?id=eq.${encodeURIComponent(
          coachTierId
        )}&select=name,invite_limit&limit=1`,
        {
          headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      );

      if (tierResponse.ok) {
        const parsedTier = coachTierSchema.safeParse(await tierResponse.json());
        if (parsedTier.success) {
          inviteLimit = parsedTier.data?.[0]?.invite_limit ?? null;
          planName = parsedTier.data?.[0]?.name ?? planName;
        }
      }
    } else if (planName) {
      const tierResponse = await fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_tiers?name=eq.${encodeURIComponent(
          planName
        )}&select=invite_limit&limit=1`,
        {
          headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      );

      if (tierResponse.ok) {
        const parsedTier = coachTierSchema.safeParse(await tierResponse.json());
        if (parsedTier.success) {
          inviteLimit = parsedTier.data?.[0]?.invite_limit ?? null;
        }
      }
    }

    let inviteCount = 0;

    if (isCoach) {
      const inviteResponse = await fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_invites?coach_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&status=eq.pending&select=id`,
        {
          headers: {
            ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
            Prefer: "count=exact",
          },
          cache: "no-store",
        }
      );

      const invitePayload = (await inviteResponse.json().catch(() => null)) as unknown;

      if (!inviteResponse.ok) {
        return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach summary." }, { status: 502 }));
      }

      const countFromHeader = parseContentRangeCount(inviteResponse.headers.get("content-range"));
      inviteCount =
        typeof countFromHeader === "number" ? countFromHeader : Array.isArray(invitePayload) ? invitePayload.length : 0;
    }

    return withSecurityHeaders(
      NextResponse.json(
        coachSummaryResponseSchema.parse({
          summary: {
            isCoach,
            planName,
            inviteCount,
            inviteLimit,
          },
        })
      )
    );
  } catch (error) {
    console.error("Unexpected error while loading coach summary", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach summary." }, { status: 500 }));
  }
}
