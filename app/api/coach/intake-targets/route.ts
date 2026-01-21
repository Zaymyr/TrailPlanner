import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { coachIntakeTargetsResponseSchema } from "../../../../lib/coach-intake-targets";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const intakeRowSchema = z.array(
  z.object({
    carbs_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
    water_ml_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
    sodium_mg_per_hour: z.union([z.number(), z.string()]).nullable().optional(),
  })
);

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-intake-targets:${user.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_intake_targets?select=carbs_per_hour,water_ml_per_hour,sodium_mg_per_hour,updated_at&coachee_id=eq.${encodeURIComponent(
        user.id
      )}&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load coach intake targets." }, { status: 502 })
      );
    }

    const rows = intakeRowSchema.parse(await response.json());
    const row = rows?.[0];

    const targets = row
      ? {
          carbsPerHour: normalizeNumber(row.carbs_per_hour),
          waterMlPerHour: normalizeNumber(row.water_ml_per_hour),
          sodiumMgPerHour: normalizeNumber(row.sodium_mg_per_hour),
        }
      : null;

    return withSecurityHeaders(NextResponse.json(coachIntakeTargetsResponseSchema.parse({ targets })));
  } catch (error) {
    console.error("Unable to load coach intake targets", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to load coach intake targets." }, { status: 500 })
    );
  }
}
