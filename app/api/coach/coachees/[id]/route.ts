import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachCoacheeDetailResponseSchema } from "../../../../../lib/coach-coachee-details";
import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../../lib/supabase";

const coacheeIdSchema = z.object({
  id: z.string().uuid(),
});

const coachCoacheeRowSchema = z.array(
  z.object({
    status: z.string(),
    invited_email: z.string().nullable().optional(),
    coachee: z
      .object({
        full_name: z.string().nullable().optional(),
        age: z.number().nullable().optional(),
        water_bag_liters: z.union([z.number(), z.string()]).nullable().optional(),
      })
      .nullable()
      .optional(),
  })
);

const intakeRowSchema = z.array(
  z.object({
    carbs_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
    water_ml_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
    sodium_mg_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
    created_at: z.string(),
  })
);

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildAuthHeaders = (supabaseKey: string, accessToken: string) => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = coacheeIdSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid coachee id." }, { status: 400 }));
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-coachee-detail:${supabaseUser.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const coacheeId = parsedParams.data.id;
    const relationshipResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_coachees?coach_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&coachee_id=eq.${encodeURIComponent(
        coacheeId
      )}&select=status,invited_email,coachee:coachee_id(full_name,age,water_bag_liters)&limit=1`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
        cache: "no-store",
      }
    );

    if (!relationshipResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coachee." }, { status: 502 }));
    }

    const relationshipRows = coachCoacheeRowSchema.safeParse(await relationshipResponse.json());

    if (!relationshipRows.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load coachee." }, { status: 500 }));
    }

    const relationship = relationshipRows.data?.[0];

    if (!relationship) {
      return withSecurityHeaders(NextResponse.json({ message: "Coachee not found." }, { status: 404 }));
    }

    const intakeResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_intake_targets?coach_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&coachee_id=eq.${encodeURIComponent(
        coacheeId
      )}&select=carbs_per_hour,water_ml_per_hour,sodium_mg_per_hour,created_at&order=created_at.desc&limit=1`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
        cache: "no-store",
      }
    );

    if (!intakeResponse.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load coachee intake targets." }, { status: 502 })
      );
    }

    const intakeRows = intakeRowSchema.safeParse(await intakeResponse.json());

    if (!intakeRows.success) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load coachee intake targets." }, { status: 500 })
      );
    }

    const intakeRow = intakeRows.data?.[0];

    const payload = {
      coachee: {
        id: coacheeId,
        status: relationship.status,
        fullName: relationship.coachee?.full_name ?? null,
        age: relationship.coachee?.age ?? null,
        waterBagLiters: normalizeNumber(relationship.coachee?.water_bag_liters ?? null),
        invitedEmail: relationship.invited_email ?? null,
      },
      latestOverride: intakeRow
        ? {
            carbsPerHour: normalizeNumber(intakeRow.carbs_per_hour),
            waterMlPerHour: normalizeNumber(intakeRow.water_ml_per_hour),
            sodiumMgPerHour: normalizeNumber(intakeRow.sodium_mg_per_hour),
            createdAt: intakeRow.created_at,
          }
        : null,
    };

    return withSecurityHeaders(NextResponse.json(coachCoacheeDetailResponseSchema.parse(payload)));
  } catch (error) {
    console.error("Unexpected error while loading coachee", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load coachee." }, { status: 500 }));
  }
}
