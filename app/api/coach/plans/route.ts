import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  coachPlanCreateSchema,
  coachPlanDeleteSchema,
  coachPlanResponseSchema,
  coachPlanUpdateSchema,
  coachPlansResponseSchema,
} from "../../../../lib/coach-plans";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const coachCoacheeRowSchema = z.array(
  z.object({
    coach_id: z.string(),
    coachee_id: z.string(),
  })
);

const coachPlansQuerySchema = z.object({
  coacheeId: z.string().uuid(),
});

const planRowSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    updated_at: z.string(),
    planner_values: z.record(z.unknown()),
    elevation_profile: z.array(z.unknown()),
  })
);

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

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
      headers: buildAuthHeaders(supabaseAnonKey, token, undefined),
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

const mapPlanRow = (row: z.infer<typeof planRowSchema>[number]) => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at,
  plannerValues: row.planner_values,
  elevationProfile: row.elevation_profile,
});

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

  const rateLimit = checkRateLimit(`coach-plans:${user.id}`, 30, 60_000);

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
    const parsedQuery = coachPlansQuerySchema.safeParse({
      coacheeId: searchParams.get("coacheeId") ?? "",
    });

    if (!parsedQuery.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Invalid coach plans request." }, { status: 400 }));
    }

    const coacheeId = parsedQuery.data.coacheeId;

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

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?select=id,name,updated_at,planner_values,elevation_profile&user_id=eq.${encodeURIComponent(
        coacheeId
      )}&coach_id=eq.${encodeURIComponent(user.id)}&order=updated_at.desc`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to fetch coachee plans", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch plans." }, { status: 502 }));
    }

    const rows = planRowSchema.parse(await response.json());
    const plans = rows.map(mapPlanRow);

    return withSecurityHeaders(NextResponse.json(coachPlansResponseSchema.parse({ plans })));
  } catch (error) {
    console.error("Unable to fetch coach plans", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch plans." }, { status: 500 }));
  }
}

export async function POST(request: Request) {
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

  const rateLimit = checkRateLimit(`coach-plans-create:${user.id}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachPlanCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid plan payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheeLink(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(`${supabaseConfig.supabaseUrl}/rest/v1/race_plans`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: parsedBody.data.coacheeId,
        coach_id: user.id,
        name: parsedBody.data.name,
        planner_values: parsedBody.data.plannerValues,
        elevation_profile: parsedBody.data.elevationProfile,
      }),
    });

    const result = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to create coachee plan", result);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create plan." }, { status: 502 }));
    }

    const rows = planRowSchema.parse(result);
    const plan = rows[0];

    if (!plan) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create plan." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json(coachPlanResponseSchema.parse({ plan: mapPlanRow(plan) })));
  } catch (error) {
    console.error("Unable to create coach plan", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create plan." }, { status: 500 }));
  }
}

export async function PUT(request: Request) {
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

  const rateLimit = checkRateLimit(`coach-plans-update:${user.id}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachPlanUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid plan payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheeLink(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
        parsedBody.data.id
      )}&user_id=eq.${encodeURIComponent(parsedBody.data.coacheeId)}&coach_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          name: parsedBody.data.name,
          planner_values: parsedBody.data.plannerValues,
          elevation_profile: parsedBody.data.elevationProfile,
        }),
      }
    );

    const result = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to update coachee plan", result);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update plan." }, { status: 502 }));
    }

    const rows = planRowSchema.parse(result);
    const plan = rows[0];

    if (!plan) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update plan." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json(coachPlanResponseSchema.parse({ plan: mapPlanRow(plan) })));
  } catch (error) {
    console.error("Unable to update coach plan", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update plan." }, { status: 500 }));
  }
}

export async function DELETE(request: Request) {
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

  const rateLimit = checkRateLimit(`coach-plans-delete:${user.id}`, 20, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachPlanDeleteSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid plan payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheeLink(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
        parsedBody.data.id
      )}&user_id=eq.${encodeURIComponent(parsedBody.data.coacheeId)}&coach_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "DELETE",
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
      }
    );

    if (!response.ok) {
      console.error("Unable to delete coachee plan", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to delete plan." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unable to delete coach plan", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete plan." }, { status: 500 }));
  }
}
