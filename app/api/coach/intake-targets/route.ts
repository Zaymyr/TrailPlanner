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

const coachCoacheeRowSchema = z.array(
  z.object({
    coach_id: z.string(),
    coachee_id: z.string(),
  })
);

const intakeTargetsQuerySchema = z.object({
  coacheeId: z.string().uuid().optional(),
});

const intakeTargetsUpsertSchema = z.object({
  coacheeId: z.string().uuid(),
  carbsPerHour: z.number().min(0).nullable(),
  waterMlPerHour: z.number().min(0).nullable(),
  sodiumMgPerHour: z.number().min(0).nullable(),
});

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
    )}&coachee_id=eq.${encodeURIComponent(
      coacheeId
    )}&status=eq.active&select=coach_id,coachee_id&limit=1`,
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

const fetchActiveCoachForCoachee = async (
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  coacheeId: string
): Promise<string | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_coachees?coachee_id=eq.${encodeURIComponent(
      coacheeId
    )}&status=eq.active&select=coach_id,coachee_id&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load active coach relationship", await response.text());
    return null;
  }

  const rows = coachCoacheeRowSchema.parse(await response.json());
  return rows[0]?.coach_id ?? null;
};

const fetchTargets = async (
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  coacheeId: string,
  coachId?: string | null
): Promise<{ ok: boolean; targets: { carbsPerHour: number | null; waterMlPerHour: number | null; sodiumMgPerHour: number | null } | null }> => {
  const coachFilter = coachId ? `&coach_id=eq.${encodeURIComponent(coachId)}` : "";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/coach_intake_targets?select=carbs_per_hour,water_ml_per_hour,sodium_mg_per_hour,updated_at&coachee_id=eq.${encodeURIComponent(
      coacheeId
    )}${coachFilter}&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { ok: false, targets: null };
  }

  const rows = intakeRowSchema.parse(await response.json());
  const row = rows?.[0];

  return {
    ok: true,
    targets: row
      ? {
          carbsPerHour: normalizeNumber(row.carbs_per_hour),
          waterMlPerHour: normalizeNumber(row.water_ml_per_hour),
          sodiumMgPerHour: normalizeNumber(row.sodium_mg_per_hour),
        }
      : null,
  };
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
    const { searchParams } = new URL(request.url);
    const parsedQuery = intakeTargetsQuerySchema.safeParse({
      coacheeId: searchParams.get("coacheeId") ?? undefined,
    });

    if (!parsedQuery.success) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Invalid intake targets request." }, { status: 400 })
      );
    }

    const coacheeId = parsedQuery.data.coacheeId ?? user.id;
    let coachId: string | null = null;

    if (coacheeId !== user.id) {
      const canAccess = await ensureCoachCoacheeLink(
        supabaseConfig.supabaseUrl,
        supabaseConfig.supabaseAnonKey,
        token,
        user.id,
        coacheeId
      );

      if (!canAccess) {
        return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
      }
      coachId = user.id;
    } else {
      coachId = await fetchActiveCoachForCoachee(
        supabaseConfig.supabaseUrl,
        supabaseConfig.supabaseAnonKey,
        token,
        coacheeId
      );

      if (!coachId) {
        return withSecurityHeaders(NextResponse.json(coachIntakeTargetsResponseSchema.parse({ targets: null })));
      }
    }

    const result = await fetchTargets(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      coacheeId,
      coachId
    );

    if (!result.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load coach intake targets." }, { status: 502 })
      );
    }

    return withSecurityHeaders(NextResponse.json(coachIntakeTargetsResponseSchema.parse({ targets: result.targets })));
  } catch (error) {
    console.error("Unable to load coach intake targets", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to load coach intake targets." }, { status: 500 })
    );
  }
}

const handleUpsert = async (request: Request) => {
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

  const rateLimit = checkRateLimit(`coach-intake-targets-upsert:${user.id}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsedBody = intakeTargetsUpsertSchema.safeParse(body);

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid intake targets payload." }, { status: 400 }));
  }

  const { coacheeId, carbsPerHour, waterMlPerHour, sodiumMgPerHour } = parsedBody.data;

  const canAccess = await ensureCoachCoacheeLink(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey,
    token,
    user.id,
    coacheeId
  );

  if (!canAccess) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_intake_targets?on_conflict=coach_id,coachee_id&select=carbs_per_hour,water_ml_per_hour,sodium_mg_per_hour`,
      {
        method: "POST",
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=merge-duplicates",
        },
        body: JSON.stringify({
          coach_id: user.id,
          coachee_id: coacheeId,
          carbs_per_hour: carbsPerHour,
          water_ml_per_hour: waterMlPerHour,
          sodium_mg_per_hour: sodiumMgPerHour,
        }),
      }
    );

    if (!response.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to update coach intake targets." }, { status: 502 })
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
      : {
          carbsPerHour,
          waterMlPerHour,
          sodiumMgPerHour,
        };

    return withSecurityHeaders(NextResponse.json(coachIntakeTargetsResponseSchema.parse({ targets })));
  } catch (error) {
    console.error("Unable to update coach intake targets", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to update coach intake targets." }, { status: 500 })
    );
  }
};

export async function POST(request: Request) {
  return handleUpsert(request);
}

export async function PUT(request: Request) {
  return handleUpsert(request);
}
