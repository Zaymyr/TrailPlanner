import { NextResponse } from "next/server";
import { z } from "zod";

import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../lib/supabase";
import { getUserEntitlements } from "../../../lib/entitlements";

const basePlanSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required"),
  plannerValues: z.record(z.unknown()),
  elevationProfile: z
    .array(
      z.object({
        distanceKm: z.number(),
        elevationM: z.number(),
      })
    )
    .default([]),
});

const createPlanSchema = basePlanSchema;
const updatePlanSchema = basePlanSchema.extend({ id: z.string().uuid() });
const deletePlanSchema = z.object({ id: z.string().uuid() });

type SupabasePlanRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  planner_values: unknown;
  elevation_profile: unknown;
};

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const findExistingPlanByName = async (
  supabaseUrl: string,
  supabaseKey: string,
  token: string,
  userId: string,
  name: string
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/race_plans?name=eq.${encodeURIComponent(
      name
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,name,created_at,updated_at,planner_values,elevation_profile&limit=1`,
    {
      headers: buildAuthHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error("Unable to check for existing plan", message);
    return null;
  }

  const plans = (await response.json().catch(() => null)) as SupabasePlanRow[] | null;
  return plans?.[0] ?? null;
};

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  try {
    const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);

    if (!supabaseUser?.id) {
      return NextResponse.json({ message: "Invalid session." }, { status: 401 });
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?user_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&select=id,name,created_at,updated_at,planner_values,elevation_profile&order=updated_at.desc`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Unable to fetch saved plans", errorText);
      return NextResponse.json({ message: "Unable to fetch plans." }, { status: 500 });
    }

    const plans = (await response.json()) as SupabasePlanRow[];
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Unexpected Supabase error while fetching plans", error);
    return NextResponse.json({ message: "Unable to fetch plans." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  const parsedBody = createPlanSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid plan payload." }, { status: 400 });
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);

  if (!supabaseUser?.id) {
    return NextResponse.json({ message: "Invalid session." }, { status: 401 });
  }

  const entitlements = await getUserEntitlements(supabaseUser.id);

  if (Number.isFinite(entitlements.planLimit)) {
    const existingPlansResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?user_id=eq.${encodeURIComponent(
        supabaseUser.id
      )}&select=id&limit=${entitlements.planLimit}`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!existingPlansResponse.ok) {
      console.error("Unable to evaluate plan count", await existingPlansResponse.text());
      return NextResponse.json({ message: "Unable to validate plan limit." }, { status: 500 });
    }

    const existingPlans = (await existingPlansResponse.json().catch(() => [])) as SupabasePlanRow[];

    if (existingPlans.length >= entitlements.planLimit) {
      return NextResponse.json({ message: "A premium plan is required to save additional plans." }, { status: 402 });
    }
  }

  try {
    const existingPlan = await findExistingPlanByName(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      supabaseUser.id,
      parsedBody.data.name
    );

    const response = await fetch(
      existingPlan
        ? `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${existingPlan.id}`
        : `${supabaseConfig.supabaseUrl}/rest/v1/race_plans`,
      {
        method: existingPlan ? "PATCH" : "POST",
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

    const result = (await response.json().catch(() => null)) as SupabasePlanRow[] | null;

    if (!response.ok || !result?.[0]) {
      const message = result?.[0] ?? "Unable to save plan.";
      console.error("Unable to save plan", message);
      return NextResponse.json({ message: "Unable to save plan." }, { status: 500 });
    }

    return NextResponse.json({ plan: result[0] }, { status: existingPlan ? 200 : 201 });
  } catch (error) {
    console.error("Unexpected Supabase error while saving plan", error);
    return NextResponse.json({ message: "Unable to save plan." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  const parsedBody = updatePlanSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid plan payload." }, { status: 400 });
  }

  try {
    const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);

    if (!supabaseUser?.id) {
      return NextResponse.json({ message: "Invalid session." }, { status: 401 });
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
        parsedBody.data.id
      )}&user_id=eq.${encodeURIComponent(supabaseUser.id)}`,
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

    const result = (await response.json().catch(() => null)) as SupabasePlanRow[] | null;

    if (!response.ok || !result?.[0]) {
      const message = result?.[0] ?? "Unable to update plan.";
      console.error("Unable to update plan", message);
      return NextResponse.json({ message: "Unable to update plan." }, { status: 500 });
    }

    return NextResponse.json({ plan: result[0] }, { status: 200 });
  } catch (error) {
    console.error("Unexpected Supabase error while updating plan", error);
    return NextResponse.json({ message: "Unable to update plan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  const parsedBody = deletePlanSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid plan payload." }, { status: 400 });
  }

  try {
    const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);

    if (!supabaseUser?.id) {
      return NextResponse.json({ message: "Invalid session." }, { status: 401 });
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
        parsedBody.data.id
      )}&user_id=eq.${encodeURIComponent(supabaseUser.id)}`,
      {
        method: "DELETE",
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      console.error("Unable to delete plan", message);
      return NextResponse.json({ message: "Unable to delete plan." }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unexpected Supabase error while deleting plan", error);
    return NextResponse.json({ message: "Unable to delete plan." }, { status: 500 });
  }
}
