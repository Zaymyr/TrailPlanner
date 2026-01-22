import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachCoacheeStatusResponseSchema } from "../../../../../../lib/coach-coachee-details";
import { checkRateLimit, withSecurityHeaders } from "../../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../../../lib/supabase";

const coacheeIdSchema = z.object({
  id: z.string().uuid(),
});

const coachCoacheeStatusRowSchema = z.array(
  z.object({
    status: z.string(),
  })
);

const updateStatus = async (request: NextRequest, coacheeId: string) => {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-coachee-disable:${supabaseUser.id}`, 10, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_coachees?coach_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&coachee_id=eq.${encodeURIComponent(coacheeId)}&select=status`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "disabled",
        }),
      }
    );

    if (!response.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update coachee." }, { status: 502 }));
    }

    const rows = coachCoacheeStatusRowSchema.safeParse(await response.json());

    if (!rows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update coachee." }, { status: 500 }));
    }

    const status = rows.data?.[0]?.status;

    if (!status) {
      return withSecurityHeaders(NextResponse.json({ message: "Coachee not found." }, { status: 404 }));
    }

    return withSecurityHeaders(NextResponse.json(coachCoacheeStatusResponseSchema.parse({ status })));
  } catch (error) {
    console.error("Unable to update coachee", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update coachee." }, { status: 500 }));
  }
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const parsedParams = coacheeIdSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid coachee id." }, { status: 400 }));
  }

  return updateStatus(request, parsedParams.data.id);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const parsedParams = coacheeIdSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid coachee id." }, { status: 400 }));
  }

  return updateStatus(request, parsedParams.data.id);
}
