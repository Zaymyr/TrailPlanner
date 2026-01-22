import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { coachCoacheeOverrideResponseSchema } from "../../../../../../lib/coach-coachee-details";
import { checkRateLimit, withSecurityHeaders } from "../../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../../../lib/supabase";

const coacheeIdSchema = z.object({
  id: z.string().uuid(),
});

const intakeTargetsInsertSchema = z.object({
  carbsPerHour: z.number().min(0).nullable(),
  waterMlPerHour: z.number().min(0).nullable(),
  sodiumMgPerHour: z.number().min(0).nullable(),
});

const coachCoacheeRowSchema = z.array(
  z.object({
    coach_id: z.string(),
    coachee_id: z.string(),
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

const ensureCoachCoacheeLink = async (
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  coachId: string,
  coacheeId: string
): Promise<boolean> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_coachees?coach_id=eq.${encodeURIComponent(
      coachId
    )}&coachee_id=eq.${encodeURIComponent(coacheeId)}&select=coach_id,coachee_id&limit=1`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify coach coachee relationship", await response.text());
    return false;
  }

  const rows = coachCoacheeRowSchema.parse(await response.json());
  return rows.length > 0;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
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

  const rateLimit = checkRateLimit(`coach-coachee-intake-targets:${supabaseUser.id}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsedBody = intakeTargetsInsertSchema.safeParse(body);

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid intake targets payload." }, { status: 400 }));
  }

  const canAccess = await ensureCoachCoacheeLink(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey,
    accessToken,
    supabaseUser.id,
    parsedParams.data.id
  );

  if (!canAccess) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_intake_targets?select=carbs_per_hour,water_ml_per_hour,sodium_mg_per_hour,created_at`,
      {
        method: "POST",
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          coach_id: supabaseUser.id,
          coachee_id: parsedParams.data.id,
          carbs_per_hour: parsedBody.data.carbsPerHour,
          water_ml_per_hour: parsedBody.data.waterMlPerHour,
          sodium_mg_per_hour: parsedBody.data.sodiumMgPerHour,
        }),
      }
    );

    if (!response.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to create coach intake targets." }, { status: 502 })
      );
    }

    const rows = intakeRowSchema.safeParse(await response.json());

    if (!rows.success) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to create coach intake targets." }, { status: 500 })
      );
    }

    const row = rows.data?.[0];

    if (!row) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to create coach intake targets." }, { status: 500 })
      );
    }

    const override = {
      carbsPerHour: normalizeNumber(row.carbs_per_hour),
      waterMlPerHour: normalizeNumber(row.water_ml_per_hour),
      sodiumMgPerHour: normalizeNumber(row.sodium_mg_per_hour),
      createdAt: row.created_at,
    };

    return withSecurityHeaders(NextResponse.json(coachCoacheeOverrideResponseSchema.parse({ override })));
  } catch (error) {
    console.error("Unable to create coach intake targets", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to create coach intake targets." }, { status: 500 })
    );
  }
}
