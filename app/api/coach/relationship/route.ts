import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachRelationshipResponseSchema } from "../../../../lib/coach-relationship";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../lib/supabase";

const coachCoacheeRowSchema = z.array(
  z.object({
    status: z.string(),
    created_at: z.string(),
    coach: z
      .object({
        user_id: z.string(),
        full_name: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
);

const coachInviteRowSchema = z.array(
  z.object({
    coach_id: z.string(),
    created_at: z.string(),
  })
);

const coachProfileRowSchema = z.array(
  z.object({
    user_id: z.string(),
    full_name: z.string().nullable().optional(),
  })
);

const authUserSchema = z.object({
  email: z.string().email().optional(),
});

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

  const rateLimit = checkRateLimit(`coach-relationship:${supabaseUser.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const [relationshipResponse, inviteResponse] = await Promise.all([
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_coachees?coachee_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&select=status,created_at,coach:coach_id(user_id,full_name)&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseConfig.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      ),
      fetch(
        `${supabaseConfig.supabaseUrl}/rest/v1/coach_invites?invitee_user_id=eq.${encodeURIComponent(
          supabaseUser.id
        )}&status=eq.pending&select=coach_id,created_at&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseConfig.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      ),
    ]);

    if (!relationshipResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 502 }));
    }

    if (!inviteResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 502 }));
    }

    const relationshipRows = coachCoacheeRowSchema.safeParse(await relationshipResponse.json());
    const inviteRows = coachInviteRowSchema.safeParse(await inviteResponse.json());

    if (!relationshipRows.success || !inviteRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 500 }));
    }

    const relationship = relationshipRows.data[0] ?? null;
    const invite = inviteRows.data[0] ?? null;
    const status = relationship?.status ?? (invite ? "pending" : null);
    const coachId = relationship?.coach?.user_id ?? invite?.coach_id ?? null;
    let coachName = relationship?.coach?.full_name ?? null;

    let coachEmail: string | null = null;

    if (coachId) {
      const serviceConfig = getSupabaseServiceConfig();

      if (!serviceConfig) {
        return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
      }

      const [profileResponse, authResponse] = await Promise.all([
        fetch(
          `${serviceConfig.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
            coachId
          )}&select=user_id,full_name&limit=1`,
          {
            headers: {
              apikey: serviceConfig.supabaseServiceRoleKey,
              Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(`${serviceConfig.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(coachId)}`, {
          headers: {
            Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
            apikey: serviceConfig.supabaseServiceRoleKey,
          },
          cache: "no-store",
        }),
      ]);

      if (!profileResponse.ok) {
        return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 502 }));
      }

      const profileRows = coachProfileRowSchema.safeParse(await profileResponse.json());

      if (!profileRows.success) {
        return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 500 }));
      }

      if (!coachName) {
        coachName = profileRows.data[0]?.full_name ?? null;
      }

      if (authResponse.ok) {
        const authPayload = authUserSchema.safeParse(await authResponse.json());
        if (authPayload.success && authPayload.data.email) {
          coachEmail = authPayload.data.email;
        }
      }
    }

    return withSecurityHeaders(
      NextResponse.json(
        coachRelationshipResponseSchema.parse({
          status,
          coach: coachId ? { id: coachId, fullName: coachName, email: coachEmail } : null,
        })
      )
    );
  } catch (error) {
    console.error("Unexpected error while loading coach relationship", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach relationship." }, { status: 500 }));
  }
}
