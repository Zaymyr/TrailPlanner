import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { coachInviteActionResponseSchema } from "../../../../../../lib/coach-invites";
import { checkRateLimit, withSecurityHeaders } from "../../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../../../lib/supabase";

const inviteIdSchema = z.object({
  id: z.string().uuid(),
});

const coachInviteRowSchema = z.array(
  z.object({
    status: z.string(),
    invite_email: z.string().email(),
    invitee_user_id: z.string().uuid().nullable(),
  })
);

const fetchInvite = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  inviteId: string
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?id=eq.${encodeURIComponent(inviteId)}&coach_id=eq.${encodeURIComponent(
      coachId
    )}&select=invite_email,status,invitee_user_id&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load coach invite", await response.text());
    return undefined;
  }

  const parsed = coachInviteRowSchema.safeParse(await response.json());
  if (!parsed.success) {
    console.error("Unable to parse coach invite", parsed.error.flatten().fieldErrors);
    return undefined;
  }

  return parsed.data[0] ?? null;
};

const updateInviteeUserId = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  inviteId: string,
  inviteeUserId: string
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?id=eq.${encodeURIComponent(
      inviteId
    )}&coach_id=eq.${encodeURIComponent(coachId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ invitee_user_id: inviteeUserId }),
    }
  );

  if (!response.ok) {
    console.error("Unable to update coach invite", await response.text());
    return false;
  }

  return true;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const parsedParams = inviteIdSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid invite id." }, { status: 400 }));
  }

  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseAnon);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-invite-resend:${supabaseUser.id}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const invite = await fetchInvite(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    accessToken,
    supabaseUser.id,
    parsedParams.data.id
  );

  if (typeof invite === "undefined") {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load invite." }, { status: 502 }));
  }

  if (!invite) {
    return withSecurityHeaders(NextResponse.json({ message: "Invite not found." }, { status: 404 }));
  }

  if (invite.status !== "pending") {
    return withSecurityHeaders(NextResponse.json({ message: "Invite is not pending." }, { status: 409 }));
  }

  const adminClient = createClient(supabaseService.supabaseUrl, supabaseService.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(invite.invite_email, {
    redirectTo: `${request.nextUrl.origin}/reset-password`,
  });

  if (inviteResponse.error || !inviteResponse.data.user?.id) {
    console.error("Unable to resend invite", inviteResponse.error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to resend invite." }, { status: 502 }));
  }

  const invitedUserId = inviteResponse.data.user.id;

  if (invite.invitee_user_id !== invitedUserId) {
    const updated = await updateInviteeUserId(
      supabaseAnon.supabaseUrl,
      supabaseAnon.supabaseAnonKey,
      accessToken,
      supabaseUser.id,
      parsedParams.data.id,
      invitedUserId
    );

    if (!updated) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update invite." }, { status: 502 }));
    }
  }

  return withSecurityHeaders(NextResponse.json(coachInviteActionResponseSchema.parse({ status: "pending" })));
}
