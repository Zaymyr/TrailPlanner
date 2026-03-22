import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachInvitesResponseSchema } from "../../../../lib/coach-invites";
import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

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

  const rateLimit = checkRateLimit(`coach-invites:${supabaseUser.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const inviteResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_invites?coach_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&status=neq.canceled&select=id,invite_email,status,created_at,accepted_at,invitee_user_id&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const invitePayload = (await inviteResponse.json().catch(() => null)) as unknown;

    if (!inviteResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach invites." }, { status: 502 }));
    }

    const inviteRows = coachInviteRowSchema.safeParse(invitePayload);

    if (!inviteRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach invites." }, { status: 500 }));
    }

    const invites = inviteRows.data.map((row) => ({
      id: row.id,
      email: row.invite_email,
      status: row.status,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at ?? null,
      inviteeUserId: row.invitee_user_id ?? null,
    }));

    return withSecurityHeaders(NextResponse.json(coachInvitesResponseSchema.parse({ invites })));
  } catch (error) {
    console.error("Unexpected error while loading coach invites", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coach invites." }, { status: 500 }));
  }
}
