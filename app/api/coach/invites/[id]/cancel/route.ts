import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachInviteActionResponseSchema } from "../../../../../../lib/coach-invites";
import { checkRateLimit, withSecurityHeaders } from "../../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../../../lib/supabase";

const inviteIdSchema = z.object({
  id: z.string().uuid(),
});

const coachInviteRowSchema = z.array(
  z.object({
    status: z.string(),
  })
);

const fetchInviteStatus = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  inviteId: string
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_invites?id=eq.${encodeURIComponent(inviteId)}&coach_id=eq.${encodeURIComponent(
      coachId
    )}&select=status&limit=1`,
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

const cancelInvite = async (
  supabaseUrl: string,
  supabaseKey: string,
  accessToken: string,
  coachId: string,
  inviteId: string
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
      body: JSON.stringify({ status: "canceled" }),
    }
  );

  if (!response.ok) {
    console.error("Unable to cancel coach invite", await response.text());
    return undefined;
  }

  const parsed = coachInviteRowSchema.safeParse(await response.json());
  if (!parsed.success) {
    console.error("Unable to parse canceled invite", parsed.error.flatten().fieldErrors);
    return undefined;
  }

  return parsed.data[0] ?? null;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const parsedParams = inviteIdSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid invite id." }, { status: 400 }));
  }

  const supabaseAnon = getSupabaseAnonConfig();

  if (!supabaseAnon) {
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

  const rateLimit = checkRateLimit(`coach-invite-cancel:${supabaseUser.id}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const invite = await fetchInviteStatus(
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

  const canceled = await cancelInvite(
    supabaseAnon.supabaseUrl,
    supabaseAnon.supabaseAnonKey,
    accessToken,
    supabaseUser.id,
    parsedParams.data.id
  );

  if (!canceled) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to cancel invite." }, { status: 502 }));
  }

  return withSecurityHeaders(NextResponse.json(coachInviteActionResponseSchema.parse({ status: "canceled" })));
}
